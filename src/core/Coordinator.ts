import { Query, TspClient } from "tsp-typescript-client";
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

class TraceServerError extends Error {
    readonly name = TraceServerError.name;
    // statusCode used by fastify for response status code
    // eslint-disable-next-line @typescript-eslint/naming-convention
    constructor(readonly msg: string, readonly statusCode?: number) {
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

const handleXyModelNull = (s: string) => (r: Awaited<FetchReturn<`fetchXYTree` | `fetchXY`>>[0]) => {
    if (r.model === null) throw new TraceServerError(`${prefixErrorMsg(r.trace_server_url)} XY ${s} is null`);
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
        const r = await this._fetch({
            op: `fetchExperiments`,
        });
        E();
        return r;
    }

    public async fetchExperiment(exp_uuid: string) {
        const { E } = tracer.B({ name: `fn ${this.fetchExperiment.name}` });
        const r = await this._fetch({ op: `fetchExperiment` }, exp_uuid);
        E();
        return r;
    }

    public async fetchOutputs(exp_uuid: string) {
        const { E } = tracer.B({ name: `fn ${this.fetchOutputs.name}` });
        const r = await this._fetch({ op: `experimentOutputs` }, exp_uuid);
        E();
        return r;
    }

    public async fetchXYTree(exp_uuid: string, output_id: string, query: Query) {
        const { E } = tracer.B({ name: `fn ${this.fetchXYTree.name}` });
        const r = await this._fetch(
            { op: `fetchXYTree`, cb: handleXyModelNull(`tree model`) },
            exp_uuid,
            output_id,
            query,
        );
        E();
        return r;
    }

    public async fetchXY(exp_uuid: string, output_id: string, query: Query) {
        const { E } = tracer.B({ name: `fn ${this.fetchXY.name}` });
        const r = await this._fetch(
            { op: `fetchXY`, cb: handleXyModelNull(`model`) },
            exp_uuid,
            output_id,
            query,
        );
        E();
        return r;
    }

    private _fetch<O extends SupportedTspOps>(
        {
            op,
            cb,
        }: {
            op: O;
            cb?: (r: Awaited<FetchReturn<O>>[0]) => void;
        },
        ...args: Parameters<TspClient[O]>
    ): // TODO: ts bug: this is the same as FetchReturn<O>
    Promise<Awaited<FetchReturn<O>>[0][]> {
        return Promise.all(
            this._tsps.map((tsp) =>
                // @ts-expect-error ts bug spread arguments
                tsp[op](...args).then((r) => {
                    const rm = r.tryGetModel(
                        newTraceServerErrorFactory(prefixErrorMsg(tsp.trace_server_url)),
                    );
                    const rmwurl = rm as WithTraceServerUrl<typeof rm>;
                    rmwurl.trace_server_url = tsp.trace_server_url;
                    cb?.(rmwurl);
                    return rmwurl;
                }),
            ),
        );
    }
}

type SupportedTspOps =
    | `fetchExperiments`
    | `fetchExperiment`
    | `experimentOutputs`
    | `fetchXYTree`
    | `fetchXY`;
type FetchReturn<O> = O extends `fetchExperiments`
    ? Promise<AggregateExperimentsPayload[`response_models`]>
    : O extends `fetchExperiment`
    ? Promise<AggregateExperimentPayload[`response_models`]>
    : O extends `experimentOutputs`
    ? Promise<AggregateOutputsPayload[`response_models`]>
    : O extends `fetchXYTree`
    ? Promise<AggregateXYTreePayload[`response_models`]>
    : O extends `fetchXY`
    ? Promise<AggregateXYModelPayload[`response_models`]>
    : unknown;

export const coordinator = new Coordinator();
