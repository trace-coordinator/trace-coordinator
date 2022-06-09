// eslint-disable-next-line @typescript-eslint/naming-convention
const STATISTICS_STEP = undefined;
// eslint-disable-next-line @typescript-eslint/naming-convention
const TRACE_URIS = [
    `/home/baby/dev-sync/trace-coordinator/TraceCompassTutorialTraces/103-compare-package-managers/pacman`,
];

/* eslint-disable @typescript-eslint/no-floating-promises */
process.on(`unhandledRejection`, (reason, promise) => {
    console.error(`Unhandled Rejection at:`, promise, `reason:`, reason);
    process.exit(1);
});

import fs from "fs";
import { Query, QueryHelper, ResponseStatus, TspClient } from "tsp-typescript-client";
import { fork } from "child_process";
import { performance } from "perf_hooks";
import fetch from "node-fetch";
import "colors";
import path from "path";
const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));
const exitBenchmark = (msg: string) => {
    console.error(msg.red);
    process.exit(1);
};

// startup trace-coordinator
let can_continue = false;
const benchmark_mode = (() => {
    const modes = [`trace-coordinator`, `trace-server`] as const;
    const mode = process.argv[2] as typeof modes[number];
    if (modes.includes(mode)) {
        if (mode === `trace-coordinator`) {
            const child = fork(`dist/index.js`, { env: { ...process.env, NODE_ENV: `production` } })
                .on(`error`, (e) => {
                    console.error(e.toString().red);
                    exitBenchmark(`Error starting trace-coordinator, halting benchmark...`);
                })
                .on(`message`, (msg) => {
                    if (msg.toString() === `COORDINATOR-UP`) can_continue = true;
                });
            process.on(`exit`, () => child.kill());
        } else can_continue = true;
        return mode;
    }
    return exitBenchmark(`Please specify whether to run benchmark for ${modes.join(` or `)}`);
})();

// should log progress or not
const should_log = benchmark_mode === `trace-coordinator` ? false : true;

// create TspClient for this benchmark
const server_url = `http://localhost:8080`;
const server = new TspClient(server_url + `/tsp/api`);

// helper function
const queryUntilCompleted = async <T>(
    query: () => Promise<T>,
    completed: (query_result: T) => boolean,
    ms?: number | number[],
) => {
    let i_begin = 0;
    let i = i_begin;
    let sleep_time_ms = typeof ms === `number` ? ms : 100;
    // eslint-disable-next-line no-constant-condition
    while (true) {
        // gracefully iterate sleep time in provided time array
        if (Array.isArray(ms) && ms.length > 0) {
            sleep_time_ms = Number(ms[i]);
            if (i === ms.length - 1) {
                if (i_begin < ms.length - 1) i_begin++;
                i = i_begin;
            } else i++;
        }
        const query_result = await query();
        if (completed(query_result)) return query_result;
        else await sleep(sleep_time_ms);
    }
};

// helper function
const tryGetModelErrorHandler =
    (custom_msg = ``) =>
    (msg: string) => {
        console.error(custom_msg.red);
        return exitBenchmark(msg);
    };

// helper function
// const isOkNotFalse = <T extends TspClientResponse<unknown>>(response: T, operation: string) =>
//     response.isOk() ? response : exitBenchmark(`${operation} isOk() false, halting benchmark...`);

// benchmarking functions
const fetchExperimentsAndGetFirst = async () =>
    await queryUntilCompleted(
        async () => {
            if (should_log) console.log(`fetchExperiment`.green);
            return (await server.fetchExperiments()).tryGetModel(
                tryGetModelErrorHandler(`Something is wrong with experiments response model`),
            )[0];
        },
        (experiment) => {
            if (!experiment)
                return exitBenchmark(`Something is wrong, experiment is ${experiment as string}`);
            if (experiment.indexingStatus === `CLOSED`) {
                server.experimentOutputs(experiment.UUID);
                return false;
            }
            return experiment.indexingStatus === `COMPLETED` ? true : false;
        },
        1000,
    );

const cpuUsageTree = (experiment: Awaited<ReturnType<typeof fetchExperimentsAndGetFirst>>) =>
    queryUntilCompleted(
        async () => {
            if (should_log) console.log(`fetchXYtree`.green);
            return (
                await server.fetchXYTree(
                    experiment.UUID,
                    `org.eclipse.tracecompass.analysis.os.linux.core.cpuusage.CpuUsageDataProvider`,
                    QueryHelper.timeQuery([experiment.start, experiment.end], { wait: true }),
                )
            ).tryGetModel(tryGetModelErrorHandler());
        },
        (cpu_usage_tree) => cpu_usage_tree.status === ResponseStatus.COMPLETED,
        1000,
    );
const cpuUsage = (
    experiment: Awaited<ReturnType<typeof fetchExperimentsAndGetFirst>>,
    cpu_usage_tree: Awaited<ReturnType<typeof cpuUsageTree>>,
) =>
    queryUntilCompleted(
        async () => {
            if (should_log) console.log(`fetchXY`.green);
            return (
                await server.fetchXY(
                    experiment.UUID,
                    `org.eclipse.tracecompass.analysis.os.linux.core.cpuusage.CpuUsageDataProvider`,
                    QueryHelper.selectionTimeQuery(
                        // copy-paste from thei-trace-ext
                        QueryHelper.splitRangeIntoEqualParts(
                            experiment.start,
                            experiment.end,
                            Math.floor(1500 * 0.85),
                        ),
                        cpu_usage_tree.model.entries.map((e) => e.id),
                        { wait: true },
                    ),
                )
            ).tryGetModel(tryGetModelErrorHandler());
        },
        (cpu_usage) => cpu_usage.status === ResponseStatus.COMPLETED,
        1000,
    );
const statistics = (
    experiment: Awaited<ReturnType<typeof fetchExperimentsAndGetFirst>>,
    step?: number,
) =>
    queryUntilCompleted(
        async () => {
            if (should_log) console.log(`fetchXYtree`.green);
            return (
                await server.fetchXYTree(
                    experiment.UUID,
                    `org.eclipse.tracecompass.analysis.os.linux.core.statistics.StatisticsDataProvider`,
                    QueryHelper.timeQuery([experiment.start, experiment.end], {
                        step,
                        wait: true,
                    }),
                )
            ).tryGetModel(tryGetModelErrorHandler());
        },
        (statistics) => statistics.status === ResponseStatus.COMPLETED,
        1000,
    );

// benchmark execution
type BenchmarkResult = {
    trace_uris: string[];
    indexing: number;
    cpu_usage_tree: number;
    cpu_usage: number;
    statistics: {
        step?: number;
        result: number;
    };
    average_10: {
        cpu_usage_tree: number;
        cpu_usage: number;
        statistics: number;
        statistics_2: number;
    };
};
const benchmark = async () => {
    // wait until trace-coordinator is stated
    await queryUntilCompleted(
        () => Promise.resolve(can_continue),
        () => can_continue,
        100,
    );
    // check health
    if ((await server.checkHealth()).tryGetModel(tryGetModelErrorHandler())?.status !== `UP`)
        return exitBenchmark(`Server checkHealth failed`);

    // create experiment
    if (benchmark_mode === `trace-coordinator`)
        await fetch(`${server_url}/tsp/api/dev/createExperimentsFromTraces`, {
            method: `POST`,
            headers: {
                "Content-Type": `application/json`,
            },
            body: JSON.stringify({
                parameters: {
                    uris: TRACE_URIS,
                },
            }),
        });
    else {
        await Promise.all(
            TRACE_URIS.map((uri, i) => {
                return typeof uri === `string`
                    ? server.openTrace(
                          new Query({
                              name: `trace-${i}`,
                              uri,
                          }),
                      )
                    : exitBenchmark(`uri ${uri as string} is not string`);
            }),
        )
            .then((responses) =>
                server.createExperiment(
                    new Query({
                        name: `experiment`,
                        traces: responses.map(
                            (response) => response.tryGetModel(tryGetModelErrorHandler()).UUID,
                        ),
                    }),
                ),
            )
            .catch((e) => exitBenchmark((e as Error).toString()));
    }

    const result = {
        trace_uris: TRACE_URIS,
        average_10: {
            cpu_usage_tree: 0,
            cpu_usage: 0,
            statistics: 0,
            statistics_2: 0,
        },
    } as BenchmarkResult;

    // indexing
    let start_time = performance.now();
    const experiment = await fetchExperimentsAndGetFirst();
    result.indexing = performance.now() - start_time;

    // CPU Usage tree
    start_time = performance.now();
    const cpu_usage_tree = await cpuUsageTree(experiment);
    result.cpu_usage_tree = performance.now() - start_time;

    // CPU Usage
    start_time = performance.now();
    await cpuUsage(experiment, cpu_usage_tree);
    result.cpu_usage = performance.now() - start_time;

    // Statistics
    const step = benchmark_mode === `trace-coordinator` ? STATISTICS_STEP : undefined;
    start_time = performance.now();
    await statistics(experiment, step);
    result.statistics = {
        step,
        result: performance.now() - start_time,
    };

    for (let i = 0; i < 10; i++) {
        // CPU Usage tree
        start_time = performance.now();
        const cpu_usage_tree = await cpuUsageTree(experiment);
        result.average_10.cpu_usage_tree += performance.now() - start_time;

        // CPU Usage
        start_time = performance.now();
        await cpuUsage(experiment, cpu_usage_tree);
        result.average_10.cpu_usage += performance.now() - start_time;

        // Statistics
        start_time = performance.now();
        await statistics(experiment);
        result.average_10.statistics += performance.now() - start_time;

        if (benchmark_mode === `trace-coordinator`) {
            start_time = performance.now();
            await statistics(experiment, 2);
            result.average_10.statistics_2 += performance.now() - start_time;
        }
    }

    Object.keys(result.average_10).forEach((key) => {
        result.average_10[key as keyof BenchmarkResult[`average_10`]] /= 10;
    });

    return result;
};

// helper function
const ensureDirExist = (file_path: string) => {
    const dirname = path.dirname(file_path);
    if (!fs.existsSync(dirname)) {
        ensureDirExist(dirname);
        fs.mkdirSync(dirname);
    }
    return file_path;
};

// main
(async () => {
    const result = await benchmark();

    const dir = `benchmark-results/${benchmark_mode}`;
    const basename = `benchmark`;
    let i = 0;
    let filename = `${dir}/${basename}-${i}.json`;
    while (fs.existsSync(filename)) {
        i++;
        filename = `${dir}/${basename}-${i}.json`;
    }
    fs.writeFileSync(ensureDirExist(filename), JSON.stringify(result, null, 4));
    console.log(`Sucessfully writed to ${filename}`.green);
    process.exit(0);
})();
