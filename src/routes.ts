import { FastifyPluginCallback } from "fastify";
import { coordinator } from "core/coordinator";
import { aggregate } from "core/aggregators";
import { AGGREGATOR_PAYLOAD_TYPE } from "core/aggregators/types/payload";
import { Query } from "tsp-typescript-client";
import { tracer } from "tracer";
import { logger } from "logger";

export const tspRoutes: FastifyPluginCallback = (fastify, opts, done) => {
    fastify.get<{ Body: Query }>(`/experiments`, opts, async (request) => {
        const { E } = tracer.B({ name: `${request.method} ${request.url}` });
        const result = aggregate({
            type: AGGREGATOR_PAYLOAD_TYPE.EXPERIMENTS,
            ...extractOptionalParameters(request.body),
            response_models: await coordinator.fetchExperiments(),
        });
        E();
        return result;
    });

    fastify.get<{ Body: Query; Params: { exp_uuid: string } }>(
        `/experiments/:exp_uuid`,
        opts,
        async (request) => {
            const { E } = tracer.B({ name: `${request.method} ${request.url}` });
            const result = aggregate({
                type: AGGREGATOR_PAYLOAD_TYPE.EXPERIMENT,
                ...extractOptionalParameters(request.body),
                response_models: await coordinator.fetchExperiment(request.params.exp_uuid),
            });
            E();
            return result;
        },
    );

    fastify.get<{ Body: Query; Params: { exp_uuid: string } }>(
        `/experiments/:exp_uuid/outputs`,
        opts,
        async (request) => {
            const { E } = tracer.B({ name: `${request.method} ${request.url}` });
            const result = aggregate({
                type: AGGREGATOR_PAYLOAD_TYPE.OUTPUTS,
                ...extractOptionalParameters(request.body),
                response_models: await coordinator.fetchOutputs(request.params.exp_uuid),
            });
            E();
            return result;
        },
    );

    fastify.post<{
        Body: Query;
        Params: { exp_uuid: string; output_id: string };
    }>(`/experiments/:exp_uuid/outputs/XY/:output_id/tree`, opts, async (request) => {
        const { E } = tracer.B({
            name: `${request.method} ${request.url}`,
        });
        const { operation, step } = extractOptionalParameters(request.body);
        let i = typeof step === `number` ? 0 : step;
        let result;
        do {
            result = aggregate({
                type: AGGREGATOR_PAYLOAD_TYPE.XY_TREE,
                output_url: `${request.params.output_id}/tree`,
                operation,
                step: i,
                response_models: await coordinator.fetchXYTree(
                    request.params.exp_uuid,
                    request.params.output_id,
                    insertParameters(request.body, {
                        ...result,
                        step: i,
                    }),
                ),
            });
            if (typeof i === `number`) i++;
            // @ts-expect-error comparison works regardless of type
        } while (i < step);
        E();
        return result;
    });

    fastify.post<{
        Body: Query;
        Params: { exp_uuid: string; output_id: string };
    }>(`/experiments/:exp_uuid/outputs/XY/:output_id/xy`, opts, async (request) => {
        const { E } = tracer.B({
            name: `${request.method} ${request.url}`,
        });
        const result = aggregate({
            ...extractOptionalParameters(request.body),
            type: AGGREGATOR_PAYLOAD_TYPE.XY_MODEL,
            output_url: `${request.params.output_id}/xy`,
            response_models: await coordinator.fetchXY(
                request.params.exp_uuid,
                request.params.output_id,
                request.body,
            ),
        });
        E();
        return result;
    });

    fastify.get(`/health`, opts, () => coordinator.checkHealth());

    fastify.post<{ Body: { parameters: { uris: string[]; wait: boolean } } }>(
        `/dev/createExperimentsFromTraces`,
        opts,
        async (request) => {
            const { E } = tracer.B({ name: `${request.method} ${request.url}` });
            await coordinator.createExperimentsFromTraces(
                request?.body?.parameters?.uris,
                request?.body?.parameters?.wait,
            );
            logger.debug(`done`);
            E();
            return `done`;
        },
    );

    done();
};

const extractOptionalParameters = (() => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const Typeof = {
        number: 0,
        string: ``,
    };
    const extractParameters = <T extends Record<string, typeof Typeof[keyof typeof Typeof]>>(
        request_body: Query,
        map_keys_types: T,
    ): Partial<T> => {
        Object.keys(map_keys_types).forEach((key) => {
            // @ts-expect-error access private field
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            const parameter = request_body?.parameters?.[key];
            logger.debug(
                `Extracting ${key} field in request body, expecting type ${typeof map_keys_types[
                    key
                    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                ]}, found value ${parameter} with type ${typeof parameter}`,
            );
            if (typeof parameter === typeof map_keys_types[key]) {
                map_keys_types[key as keyof T] = parameter as T[typeof key];
            } else delete map_keys_types[key];
        });
        return map_keys_types;
    };
    return (request_body: Query) =>
        extractParameters(request_body, { operation: Typeof.string, step: Typeof.number });
})();

const insertParameters = (request_body: Query, parameters: Record<string, unknown>) =>
    new Query({
        // @ts-expect-error access private field
        ...request_body?.parameters,
        ...parameters,
    } as object);
