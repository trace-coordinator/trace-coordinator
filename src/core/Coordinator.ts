import { GenericResponse, Query, TspClient, TspClientResponse } from "tsp-typescript-client";
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
import { tracer } from "tracer";

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
const newTraceServerErrorFactory = (prefix: string) => (msg: string, status_code?: number) =>
    new TraceServerError(`${prefix} ${msg}`, status_code);
const prefixErrorMsg = (url: string) => `[Trace server ${url}] `;

const newOverloadedTspClient = (url: string) => {
    const tsp = new TspClient(url + `/tsp/api`) as WithTraceServerUrl<TspClient>;
    tsp.trace_server_url = url;
    return tsp;
};

const handleXyModelNull = (s: string) => (r: WithTraceServerUrl<unknown>) => {
    if ((r as WithTraceServerUrl<GenericResponse<unknown>>).model === null)
        throw new TraceServerError(`${prefixErrorMsg(r.trace_server_url)} XY ${s} is null`);
};

class Coordinator {
    private readonly _tsps: WithTraceServerUrl<TspClient>[];

    constructor() {
        this._tsps = config.trace_servers_configuration.map((tsc) => {
            const tsp = newOverloadedTspClient(tsc.url);
            tsp.checkHealth()
                .then((r) => {
                    const rm = r.tryGetModel(
                        newTraceServerErrorFactory(prefixErrorMsg(tsp.trace_server_url)),
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
                    }).flatMap((dirent) => {
                        const uri = path.resolve(
                            config.trace_servers_configuration[i][`traces-uri`],
                            dirent.name,
                        );
                        logger.debug(`Import ${uri} to trace server ${tsp.trace_server_url}`);
                        return dirent.isDirectory()
                            ? tsp.openTrace(
                                  new Query({
                                      name: dirent.name,
                                      uri,
                                  }),
                              )
                            : [];
                    }),
                )
                    .then((rs) =>
                        tsp.createExperiment(
                            new Query({
                                name: `experiment`,
                                traces: rs.map(
                                    (r) =>
                                        r.tryGetModel(
                                            newTraceServerErrorFactory(prefixErrorMsg(tsp.trace_server_url)),
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
        const { E } = tracer.B({ name: `fn ${this.fetchExperiments.name}` });
        const r = (await this._fetch({
            op: `fetchExperiments`,
        })) as AggregateExperimentsPayload[`response_models`];
        E();
        return r;
    }

    public async fetchExperiment(exp_uuid: string) {
        const { E } = tracer.B({ name: `fn ${this.fetchExperiment.name}` });
        const r = (await this._fetch(
            { op: `fetchExperiment` },
            exp_uuid,
        )) as AggregateExperimentPayload[`response_models`];
        E();
        return r;
    }

    public async fetchOutputs(exp_uuid: string) {
        const { E } = tracer.B({ name: `fn ${this.fetchOutputs.name}` });
        const r = (await this._fetch(
            { op: `experimentOutputs` },
            exp_uuid,
        )) as AggregateOutputsPayload[`response_models`];
        E();
        return r;
    }

    public async fetchXYTree(exp_uuid: string, output_id: string, query: Query) {
        const { E } = tracer.B({ name: `fn ${this.fetchXYTree.name}` });
        const r = (await this._fetch(
            { op: `fetchXYTree`, cb: handleXyModelNull(`tree model`) },
            exp_uuid,
            output_id,
            query,
        )) as AggregateXYTreePayload[`response_models`];
        E();
        return r;
    }

    public async fetchXY(exp_uuid: string, output_id: string, query: Query) {
        const { E } = tracer.B({ name: `fn ${this.fetchXY.name}` });
        const r = (await this._fetch(
            { op: `fetchXY`, cb: handleXyModelNull(`model`) },
            exp_uuid,
            output_id,
            query,
        )) as AggregateXYModelPayload[`response_models`];
        E();
        return r;
    }

    private _fetch(
        { op, cb }: { op: string; cb?: (r: WithTraceServerUrl<unknown>) => void },
        ...args: unknown[]
    ) {
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
                        newTraceServerErrorFactory(prefixErrorMsg(tsp.trace_server_url)),
                    ) as WithTraceServerUrl<unknown>;
                    rmwurl.trace_server_url = tsp.trace_server_url;
                    cb?.(rmwurl);
                    return rmwurl;
                }),
            ),
        );
    }
}

export const coordinator = new Coordinator();
