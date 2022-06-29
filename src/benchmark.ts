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
import {
    Entry,
    EntryModel,
    GenericResponse,
    Query,
    QueryHelper,
    ResponseStatus,
    TspClient,
} from "tsp-typescript-client";
import { fork } from "child_process";
import { performance } from "perf_hooks";
import fetch from "node-fetch";
import "colors";
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
    ms: (() => number) | number,
) => {
    // eslint-disable-next-line no-constant-condition
    while (true) {
        const query_result = await query();
        if (completed(query_result)) return query_result;
        else await sleep(typeof ms === `function` ? ms() : ms);
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
function bytesToSize(bytes: number) {
    const sizes = [`Bytes`, `KB`, `MB`, `GB`, `TB`];
    if (bytes === 0) return `n/a`;
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)) as unknown as string, 10);
    if (i === 0) return `${bytes} ${sizes[i]})`;
    return `${(bytes / 1024 ** i).toFixed(1)} ${sizes[i]}`;
}

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
        (() => {
            let i = 0;
            return () => (i++ % 2 === 0 ? 3000 : 1500);
        })(),
    );

const cpuUsageTree = (experiment: Awaited<ReturnType<typeof fetchExperimentsAndGetFirst>>) =>
    queryUntilCompleted(
        async () => {
            if (should_log) console.log(`fetchXYtree`.green);
            return await server.fetchXYTree(
                experiment.UUID,
                `org.eclipse.tracecompass.analysis.os.linux.core.cpuusage.CpuUsageDataProvider`,
                QueryHelper.timeQuery([experiment.start, experiment.end], { wait: true }),
            );
        },
        (cpu_usage_tree) =>
            cpu_usage_tree.tryGetModel(tryGetModelErrorHandler()).status ===
            ResponseStatus.COMPLETED,
        1000,
    );
const cpuUsage = (
    experiment: Awaited<ReturnType<typeof fetchExperimentsAndGetFirst>>,
    cpu_usage_tree: GenericResponse<EntryModel<Entry>>,
) =>
    queryUntilCompleted(
        async () => {
            if (should_log) console.log(`fetchXY`.green);
            return await server.fetchXY(
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
            );
        },
        (cpu_usage) =>
            cpu_usage.tryGetModel(tryGetModelErrorHandler()).status === ResponseStatus.COMPLETED,
        1000,
    );
const statistics = (
    experiment: Awaited<ReturnType<typeof fetchExperimentsAndGetFirst>>,
    step?: number,
) =>
    queryUntilCompleted(
        async () => {
            if (should_log) console.log(`fetchXYtree`.green);
            return await server.fetchXYTree(
                experiment.UUID,
                `org.eclipse.tracecompass.analysis.os.linux.core.statistics.StatisticsDataProvider`,
                QueryHelper.timeQuery([experiment.start, experiment.end], {
                    step,
                    wait: true,
                }),
            );
        },
        (statistics) =>
            statistics.tryGetModel(tryGetModelErrorHandler()).status === ResponseStatus.COMPLETED,
        1000,
    );

// benchmark execution
type BenchmarkResult = {
    trace_uris: string[];
    indexing: number;
    cpu_usage_tree: {
        result: number;
        size: string;
    };
    cpu_usage: {
        result: number;
        size: string;
    };
    statistics: {
        step?: number;
        result: number;
        size: string;
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

    const result = {
        trace_uris: TRACE_URIS,
        average_10: {
            cpu_usage_tree: 0,
            cpu_usage: 0,
            statistics: 0,
            statistics_2: 0,
        },
    } as BenchmarkResult;

    // create experiment & indexing
    let start_time = performance.now();
    if (benchmark_mode === `trace-coordinator`)
        await fetch(`${server_url}/tsp/api/dev/createExperimentsFromTraces`, {
            method: `POST`,
            headers: {
                "Content-Type": `application/json`,
            },
            body: JSON.stringify({
                parameters: {
                    uris: TRACE_URIS,
                    wait: true,
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
                        wait: true,
                    }),
                ),
            )
            .catch((e) => exitBenchmark((e as Error).toString()));
    }

    const experiment = await fetchExperimentsAndGetFirst();
    result.indexing = performance.now() - start_time;

    // CPU Usage tree
    start_time = performance.now();
    const cpu_usage_tree = await cpuUsageTree(experiment);
    result.cpu_usage_tree = {
        result: performance.now() - start_time,
        size: bytesToSize(Buffer.byteLength(cpu_usage_tree.getText(), `utf8`)),
    };

    // CPU Usage
    start_time = performance.now();
    const cpu_usage = await cpuUsage(
        experiment,
        cpu_usage_tree.tryGetModel(tryGetModelErrorHandler()),
    );
    result.cpu_usage = {
        result: performance.now() - start_time,
        size: bytesToSize(Buffer.byteLength(cpu_usage.getText(), `utf8`)),
    };

    // Statistics
    const step = benchmark_mode === `trace-coordinator` ? STATISTICS_STEP : undefined;
    start_time = performance.now();
    const stats = await statistics(experiment, step);
    result.statistics = {
        step,
        result: performance.now() - start_time,
        size: bytesToSize(Buffer.byteLength(stats.getText(), `utf8`)),
    };

    for (let i = 0; i < 10; i++) {
        // CPU Usage tree
        start_time = performance.now();
        const cpu_usage_tree = await cpuUsageTree(experiment);
        result.average_10.cpu_usage_tree += performance.now() - start_time;

        // CPU Usage
        start_time = performance.now();
        await cpuUsage(experiment, cpu_usage_tree.tryGetModel(tryGetModelErrorHandler()));
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

// main
(async () => {
    const result = await benchmark();
    const result_file = `benchmark-results.json`;
    const current_result = fs.existsSync(result_file)
        ? (JSON.parse(fs.readFileSync(result_file, `utf8`)) as Record<
              typeof benchmark_mode,
              Record<string, typeof result>
          >)
        : {
              "trace-coordinator": {},
              "trace-server": {},
          };

    let i = 0;
    while (current_result[benchmark_mode][i]) {
        i++;
    }
    current_result[benchmark_mode][i] = result;
    fs.writeFileSync(result_file, JSON.stringify(current_result, null, 4));
    console.log(`Sucessfully writed to result.${benchmark_mode}.${i}`);
    process.exit(0);
})();
