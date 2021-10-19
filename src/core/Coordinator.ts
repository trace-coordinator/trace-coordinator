import { Query, TspClient, TspClientResponse } from "tsp-typescript-client";
import config from "config";
import { WithTraceServerUrl } from "types/tsp";
import { logger } from "logger";
import {
    AggregateExperimentPayload,
    AggregateExperimentsPayload,
    AggregateOutputsPayload,
    AggregateXYModelPayload,
    AggregateXYTreePayload,
} from "types/payload";
import { readdirSync } from "fs";
import path from "path";
import { exitWithError } from "lib";

class TraceCoordinatorError extends Error {
    readonly name = TraceCoordinatorError.name;
}

class TraceServerError extends Error {
    readonly name = TraceServerError.name;
    // statusCode used by fastify for response status code
    // eslint-disable-next-line @typescript-eslint/naming-convention
    constructor(msg: string, private readonly statusCode?: number) {
        super(msg);
    }
}
const newTraceServerErrorCallback = (s: string) => (msg: string, status_code?: number) =>
    new TraceServerError(`${s} ${msg}`, status_code);
const prefixErrorMsg = (url: string) => `[Trace server ${url}] `;

const newOverloadedTspClient = (url: string) => {
    const tsp = new TspClient(url + `/tsp/api`) as WithTraceServerUrl<TspClient>;
    tsp.trace_server_url = url;
    return tsp;
};

class Coordinator {
    private readonly _tsps: WithTraceServerUrl<TspClient>[];

    constructor() {
        this._tsps = config.trace_servers_configuration.map((tsc) => {
            const tsp = newOverloadedTspClient(tsc.url);
            logger.profiling(`something`);
            tsp.checkHealth()
                .then((r) => {
                    const rm = r.tryGetModel(
                        newTraceServerErrorCallback(prefixErrorMsg(tsp.trace_server_url)),
                    );
                    if (rm.status !== `UP`)
                        throw new TraceServerError(
                            `Error connecting to ${prefixErrorMsg(tsp.trace_server_url)} status: ${
                                r.getModel()?.status
                            }`,
                            500,
                        );
                })
                .catch((e) => exitWithError(e));
            return tsp;
        });
    }

    // <DEV>
    public createExperimentsFromTraces() {
        return Promise.all(
            this._tsps.map((tsp, i) => {
                if (typeof config.trace_servers_configuration[i][`traces-uri`] !== `string`)
                    throw new TraceServerError(
                        `${prefixErrorMsg(tsp.trace_server_url)} No traces uri found`,
                        500,
                    );
                Promise.all(
                    readdirSync(config.trace_servers_configuration[i][`traces-uri`], {
                        withFileTypes: true,
                    }).flatMap((dirent) =>
                        dirent.isDirectory()
                            ? tsp.openTrace(
                                  new Query({
                                      name: dirent.name,
                                      uri: path.resolve(
                                          config.trace_servers_configuration[i][`traces-uri`],
                                          dirent.name,
                                      ),
                                  }),
                              )
                            : [],
                    ),
                )
                    .then((rs) =>
                        tsp.createExperiment(
                            new Query({
                                name: `experiment`,
                                traces: rs.map(
                                    (r) =>
                                        r.tryGetModel(
                                            newTraceServerErrorCallback(prefixErrorMsg(tsp.trace_server_url)),
                                        ).UUID,
                                ),
                            }),
                        ),
                    )
                    .catch((e) => exitWithError(e));
            }),
        );
    }

    public async fetchExperiments() {
        const end = logger.profiling(this.fetchExperiments.name);
        const r = (await this._fetch(`fetchExperiments`)) as AggregateExperimentsPayload[`response_models`];
        end();
        return r;
    }

    public async fetchExperiment(exp_uuid: string) {
        const end = logger.profiling(this.fetchExperiment.name);
        const r = (await this._fetch(
            `fetchExperiment`,
            exp_uuid,
        )) as AggregateExperimentPayload[`response_models`];
        end();
        return r;
    }

    public async fetchOutputs(exp_uuid: string) {
        const end = logger.profiling(this.fetchOutputs.name);
        const r = (await this._fetch(
            `experimentOutputs`,
            exp_uuid,
        )) as AggregateOutputsPayload[`response_models`];
        end();
        return r;
    }

    public async fetchXYTree(exp_uuid: string, output_id: string, query: Query) {
        const end = logger.profiling(this.fetchXYTree.name);
        const r = (await this._fetch(
            `fetchXYTree`,
            exp_uuid,
            output_id,
            query,
        )) as AggregateXYTreePayload[`response_models`];
        end();
        return r;
    }

    public async fetchXY(exp_uuid: string, output_id: string, query: Query) {
        const end = logger.profiling(this.fetchXY.name);
        const r = (await this._fetch(
            `fetchXY`,
            exp_uuid,
            output_id,
            query,
        )) as AggregateXYModelPayload[`response_models`];
        end();
        return r;
    }

    private _fetch(op: string, ...args: unknown[]) {
        // @ts-expect-error implicit any is allowed because type is checked anyway
        if (typeof this._tsps[0][op] !== `function`) {
            throw new TraceCoordinatorError(`Method ${op} not exist on TSP client`);
        }
        return Promise.all(
            this._tsps.map((tsp) =>
                // @ts-expect-error any tsp[op] is knowned as a function
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                (tsp[op](...args) as Promise<TspClientResponse<unknown>>).then((r) => {
                    const rmwurl = r.tryGetModel(
                        newTraceServerErrorCallback(prefixErrorMsg(tsp.trace_server_url)),
                    ) as WithTraceServerUrl<unknown>;
                    rmwurl.trace_server_url = tsp.trace_server_url;
                    return rmwurl;
                }),
            ),
        );
    }
}

export const coordinator = new Coordinator();
