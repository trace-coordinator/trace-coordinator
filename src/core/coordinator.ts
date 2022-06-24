import { GenericResponse, Query, TspClient } from "tsp-typescript-client";
import config from "config";
import { logger } from "logger";
import {
    ExperimentAggregatorPayload,
    ExperimentsAggregatorPayload,
    OutputsAggregatorPayload,
    XYModelAggregatorPayload,
    XYTreeAggregatorPayload,
    WithTraceServerUrl,
} from "./aggregators/types/payload";
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
const tryGetModelErrorHandler = (prefix: string) => (msg: string, status_code?: number) => {
    throw new TraceServerError(`${prefix} ${msg}`, status_code);
};
const prefixErrorMsg = (url: string) => `[Trace server ${url}] `;

const newOverloadedTspClient = (url: string) => {
    const tsp = new TspClient(url + `/tsp/api`) as WithTraceServerUrl<TspClient>;
    tsp.trace_server_url = url;
    return tsp;
};

const handleModelNull =
    (model_name: string) => (response_model: WithTraceServerUrl<GenericResponse<unknown>>) => {
        if (response_model.model === null)
            throw new TraceServerError(
                `${prefixErrorMsg(response_model.trace_server_url)} ${model_name} is null`,
            );
    };

class Coordinator {
    private readonly _tsps = config.trace_servers_configuration.map((tsc) =>
        newOverloadedTspClient(tsc.url),
    );

    // <DEV>
    public createExperimentsFromTraces(trace_uris: string[] | undefined, wait = false) {
        if (!Array.isArray(trace_uris))
            throw new TraceServerError(`uris must be an array of string`, 400);
        return Promise.all(
            this._tsps.map((tsp) =>
                Promise.all(
                    trace_uris.map((uri, i) => {
                        if (typeof uri !== `string`)
                            throw new TraceServerError(
                                `${prefixErrorMsg(tsp.trace_server_url)} uri ${
                                    uri as string
                                } is not string`,
                                400,
                            );
                        return tsp.openTrace(
                            new Query({
                                name: `${tsp.trace_server_url}-${i}`,
                                uri,
                            }),
                        );
                    }),
                )
                    .then((responses) =>
                        tsp.createExperiment(
                            new Query({
                                name: `experiment`,
                                wait,
                                traces: responses.map(
                                    (response) =>
                                        response.tryGetModel(
                                            tryGetModelErrorHandler(
                                                prefixErrorMsg(tsp.trace_server_url),
                                            ),
                                        ).UUID,
                                ),
                            }),
                        ),
                    )
                    .catch((e) => exitWithError(e)),
            ),
        );
    }

    public async fetchExperiments() {
        const { E } = tracer.B({ name: `fn ${this.fetchExperiments.name}` });
        const result = await this._fetch({
            operation: `fetchExperiments`,
        });
        E();
        return result;
    }

    public async fetchExperiment(exp_uuid: string) {
        const { E } = tracer.B({ name: `fn ${this.fetchExperiment.name}` });
        const result = await this._fetch({ operation: `fetchExperiment` }, exp_uuid);
        E();
        return result;
    }

    public async fetchOutputs(exp_uuid: string) {
        const { E } = tracer.B({ name: `fn ${this.fetchOutputs.name}` });
        const result = await this._fetch({ operation: `experimentOutputs` }, exp_uuid);
        E();
        return result;
    }

    public async fetchXYTree(exp_uuid: string, output_id: string, query: Query) {
        const { E } = tracer.B({ name: `fn ${this.fetchXYTree.name}` });
        const result = await this._fetch(
            { operation: `fetchXYTree`, cb: handleModelNull(`XY tree model`) },
            exp_uuid,
            output_id,
            query,
        );
        E();
        return result;
    }

    public async fetchXY(exp_uuid: string, output_id: string, query: Query) {
        const { E } = tracer.B({ name: `fn ${this.fetchXY.name}` });
        const result = await this._fetch(
            { operation: `fetchXY`, cb: handleModelNull(`XY model`) },
            exp_uuid,
            output_id,
            query,
        );
        E();
        return result;
    }

    public async checkHealth(): Promise<{ status: `UP` | `DOWN` }> {
        for (const tsp of this._tsps) {
            const status = (await tsp.checkHealth()).tryGetModel(
                tryGetModelErrorHandler(prefixErrorMsg(tsp.trace_server_url)),
            ).status;
            if (status !== `UP`) {
                logger.error(
                    new TraceServerError(
                        `${prefixErrorMsg(tsp.trace_server_url)} status: ${status}`,
                        500,
                    ) as object,
                );
                return {
                    status: `DOWN`,
                };
            }
        }
        return {
            status: `UP`,
        };
    }

    private _fetch<O extends TspOperations>(
        {
            operation: op,
            cb,
        }: {
            operation: O;
            cb?: (response_model: WithTraceServerUrl<FetchReturn<O>[0]>) => void;
        },
        ...args: Parameters<TspClient[O]>
    ): // TODO: ts bug: this is the same as FetchReturn<O>
    Promise<FetchReturn<O>[0][]> {
        return Promise.all(
            this._tsps.map((tsp) =>
                // @ts-expect-error ts bug spread arguments
                tsp[op](...args).then((response) => {
                    const response_model = response.tryGetModel(
                        tryGetModelErrorHandler(prefixErrorMsg(tsp.trace_server_url)),
                    );
                    const response_model_w_url = response_model as WithTraceServerUrl<
                        typeof response_model
                    >;
                    response_model_w_url.trace_server_url = tsp.trace_server_url;
                    cb?.(response_model_w_url);
                    return response_model_w_url;
                }),
            ),
        );
    }
}

type TspOperations =
    | `fetchExperiments`
    | `fetchExperiment`
    | `experimentOutputs`
    | `fetchXYTree`
    | `fetchXY`;
type FetchReturn<TspOperation> = TspOperation extends `fetchExperiments`
    ? ExperimentsAggregatorPayload[`response_models`]
    : TspOperation extends `fetchExperiment`
    ? ExperimentAggregatorPayload[`response_models`]
    : TspOperation extends `experimentOutputs`
    ? OutputsAggregatorPayload[`response_models`]
    : TspOperation extends `fetchXYTree`
    ? XYTreeAggregatorPayload[`response_models`]
    : TspOperation extends `fetchXY`
    ? XYModelAggregatorPayload[`response_models`]
    : unknown;

export const coordinator = new Coordinator();
