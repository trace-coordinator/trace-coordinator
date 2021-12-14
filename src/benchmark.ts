/* eslint-disable @typescript-eslint/no-floating-promises */
process.on(`unhandledRejection`, (reason, promise) => {
    console.error(`Unhandled Rejection at:`, promise, `reason:`, reason);
    process.exit(1);
});

import fs from "fs";
import path from "path";
import config from "config";
import {
    Query,
    QueryHelper,
    ResponseStatus,
    TspClient,
    TspClientResponse,
} from "tsp-typescript-client";
import { fork } from "child_process";
import { performance } from "perf_hooks";
import fetch from "node-fetch";
import "colors";
const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

let can_continue = false;

const mode = (() => {
    const modes = [`trace-coordinator`, `trace-server`] as const;
    if (modes.includes(process.argv[2] as typeof modes[number])) {
        if ((process.argv[2] as typeof modes[number]) === `trace-coordinator`) {
            const child = fork(`dist/index.js`, { env: { ...process.env, NODE_ENV: `production` } })
                .on(`error`, (e) => {
                    console.error(e.toString().red);
                    console.error(`error fork trace-coordinator, halting benchmark...`.red);
                    process.exit(1);
                })
                .on(`message`, (msg) => {
                    if (msg.toString() === `COORDINATOR-UP`) can_continue = true;
                });
            process.on(`exit`, () => {
                child.kill();
            });
        } else {
            can_continue = true;
        }
        return process.argv[2] as typeof modes[number];
    }
    console.error(`Please specify whether to run benchmark for ${modes.join(` or `)}`.red);
    process.exit(1);
})();

const url =
    mode === `trace-coordinator`
        ? `http://localhost:8080`
        : config.trace_servers_configuration[0].url;
const server = new TspClient(url + `/tsp/api`);

const queryUntilCompleted = async <M>(
    query: () => Promise<M>,
    completed: (m: NonNullable<M>) => boolean,
    ms?: number | number[],
) => {
    let begin = 0;
    let i = begin;
    let sleep_time_ms = typeof ms === `number` ? ms : 100;
    const has_array_ms = Array.isArray(ms) && ms.length > 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
        if (has_array_ms) {
            sleep_time_ms = ms[i];
            if (i === ms.length - 1) {
                if (begin < ms.length - 1) begin++;
                i = begin;
            } else {
                i++;
            }
        }
        const r = await query();
        if (r && completed(r as unknown as NonNullable<M>)) {
            return r as unknown as NonNullable<M>;
        } else await sleep(sleep_time_ms);
    }
};

const checkIsOkFalse = <T extends TspClientResponse<unknown>>(r: T, op: string) => {
    if (!r.isOk()) {
        console.error(`${op} isOk() false, halting benchmark...`.red);
        process.exit(1);
    }
    return r;
};

const fetchExperiment = async (should_log: boolean) =>
    await queryUntilCompleted(
        async () => {
            if (should_log) console.log(`fetchExperiment`.red);
            const r = checkIsOkFalse(await server.fetchExperiments(), `Fetch experiment`);
            const e = r.getModel();
            return e ? e[0] : null;
        },
        (e) => (e.indexingStatus === `COMPLETED` || e.indexingStatus === `CLOSED` ? true : false),
        [20000, 10000, 5000, 5000, 3000, 2000, 1000, 1000, 500],
    );

type R = {
    indexing: number;
    cpu_usage_tree: number;
    cpu_usage: number;
    // ram_tree: number;
    // ram_states: number;
    total: number;
};
type Result = [R, Omit<R, `indexing` | `total`>];
const benchmark = async () => {
    await queryUntilCompleted(
        () => Promise.resolve(can_continue),
        () => can_continue,
        500,
    );
    try {
        const r = await server.checkHealth();
        if (!r.isOk() || r.getModel()?.status !== `UP`)
            throw new Error(`Server checkHealth failed at ${url}`);
    } catch (e) {
        console.error((e as Error).toString().red);
        process.exit(1);
    }

    let should_log = false;
    if (mode === `trace-coordinator`)
        await fetch(`${url}/tsp/api/dev/createExperimentsFromTraces`, {
            method: `POST`,
        });
    else {
        should_log = true;
        await Promise.all(
            fs
                .readdirSync(
                    `/home/ubuntu/trace-coordinator-test-set/original-clones/trace-server`,
                    {
                        withFileTypes: true,
                    },
                )
                .flatMap((dirent) => {
                    const uri = path.resolve(
                        `/home/ubuntu/trace-coordinator-test-set/original-clones/trace-server`,
                        dirent.name,
                    );
                    console.log(`Import ${uri} to trace server ${url}`);
                    return dirent.isDirectory()
                        ? server.openTrace(
                              new Query({
                                  name: dirent.name,
                                  uri,
                              }),
                          )
                        : [];
                }),
        )
            .then((rs) =>
                server.createExperiment(
                    new Query({
                        name: `experiment`,
                        traces: rs.map(
                            (r) =>
                                r.tryGetModel(() => {
                                    throw new Error();
                                }).UUID,
                        ),
                    }),
                ),
            )
            .catch((e) => {
                console.error((e as Error).toString().red);
                process.exit(1);
            });
    }

    // indexing
    const result = [{}, {}] as Result;
    let start_time = performance.now();
    let experiment = await fetchExperiment(should_log);
    result[0].indexing = performance.now() - start_time;

    const start_time_total = performance.now();
    await server.experimentOutputs(experiment.UUID);

    // re-fetch experiment if trace-server was closed before benchmark
    if (experiment.end === 0n) {
        start_time = performance.now();
        experiment = await fetchExperiment(should_log);
        result[0].indexing = performance.now() - start_time;
    }

    // XY tree
    start_time = performance.now();
    const cpu_usage_tree = await queryUntilCompleted(
        async () => {
            if (should_log) console.log(`fetchXYtree`.red);
            return checkIsOkFalse(
                await server.fetchXYTree(
                    experiment.UUID,
                    `org.eclipse.tracecompass.analysis.os.linux.core.cpuusage.CpuUsageDataProvider`,
                    QueryHelper.timeQuery([experiment.start, experiment.end]),
                ),
                `Fetch xy tree`,
            ).getModel();
        },
        (cpu_usage_tree) => cpu_usage_tree.status === ResponseStatus.COMPLETED,
        [3000, 2000, 1000, 300],
    );
    result[0].cpu_usage_tree = performance.now() - start_time;
    result[1].cpu_usage_tree = cpu_usage_tree.model.entries.length;

    // XY
    start_time = performance.now();
    const cpu_usage = await queryUntilCompleted(
        async () => {
            if (should_log) console.log(`fetchXY`.red);
            return checkIsOkFalse(
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
                    ),
                ),
                `Fetch xy`,
            ).getModel();
        },
        (cpu_usage) => cpu_usage.status === ResponseStatus.COMPLETED,
        [500, 300, 100],
    );
    result[0].cpu_usage = performance.now() - start_time;
    result[1].cpu_usage = cpu_usage.model.series.length;

    result[0].total = performance.now() - start_time_total;
    return result;
};

(async () => {
    const result = await benchmark();

    const other_result_file =
        mode === `trace-coordinator`
            ? `${benchmark.name}-trace-server.txt`
            : `${benchmark.name}-trace-coordinator.txt`;
    const benchmark_vs = `benchmark-vs.txt`;
    if (!fs.existsSync(other_result_file)) {
        fs.writeFileSync(`${benchmark.name}-${mode}.txt`, JSON.stringify(result, null, 4));
        try {
            fs.unlinkSync(benchmark_vs);
        } catch (e) {
            e;
        }
        console.log(`${other_result_file} not exist, produce it first to obtain a comparison`.red);
    } else {
        const other_result = JSON.parse(fs.readFileSync(other_result_file, `utf8`)) as Result;
        fs.unlinkSync(other_result_file);
        const result_comparison: R = {
            indexing: result[0].indexing / other_result[0].indexing,
            cpu_usage_tree: result[0].cpu_usage_tree / other_result[0].cpu_usage_tree,
            cpu_usage: result[0].cpu_usage / other_result[0].cpu_usage,
            total: result[0].total / other_result[0].total,
        };

        let msg;
        msg = `${mode} is slower by \n${JSON.stringify(result_comparison, null, 4)}\n`;
        console.log(msg.red);
        fs.writeFileSync(benchmark_vs, msg);
        const query_count = `query count`;
        const first = `${mode} ${query_count}`;
        const second = `${
            mode === `trace-coordinator` ? `trace-server` : `trace-coordinator`
        } ${query_count}`;
        msg = JSON.stringify({ [first]: result[1], [second]: other_result[1] }, null, 4) + `\n`;
        console.log(msg.red);
        fs.appendFileSync(benchmark_vs, msg);
    }
    process.exit(0);
})();
