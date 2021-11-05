import { FastifyPluginCallback } from "fastify";
import { coordinator } from "core/Coordinator";
import { aggregate } from "core/aggregators";
import { PAYLOAD_TYPE } from "types/payload";
import { logger } from "logger";
import { Query } from "tsp-typescript-client";
import { ts_trace } from "tracer";

export const experimentsRoute: FastifyPluginCallback = (fastify, opts, done) => {
    fastify.get(`/experiments`, opts, async () => {
        // const end = logger.profiling(`request GET /experiments`);
        const { E } = ts_trace.B({ name: `request GET /experiments` });
        const r = aggregate({
            type: PAYLOAD_TYPE.AGGREGATE_EXPERIMENTS,
            response_models: await coordinator.fetchExperiments(),
        });
        E();
        // end();
        return r;
    });
    done();
};

export const experimentRoute: FastifyPluginCallback = (fastify, opts, done) => {
    fastify.get<{ Params: { exp_uuid: string } }>(`/experiments/:exp_uuid`, opts, async (request) => {
        // const end = logger.profiling(`request GET /experiments/${request.params.exp_uuid}`);
        const { E } = ts_trace.B({ name: `request GET /experiments/${request.params.exp_uuid}` });
        const r = aggregate({
            type: PAYLOAD_TYPE.AGGREGATE_EXPERIMENT,
            exp_uuid: request.params.exp_uuid,
            response_models: await coordinator.fetchExperiment(request.params.exp_uuid),
        });
        // end();
        E();
        return r;
    });
    done();
};

export const outputsRoute: FastifyPluginCallback = (fastify, opts, done) => {
    fastify.get<{ Params: { exp_uuid: string } }>(`/experiments/:exp_uuid/outputs`, opts, async (request) => {
        // const end = logger.profiling(`request GET /experiments/${request.params.exp_uuid}/outputs`);
        const { E } = ts_trace.B({ name: `request GET /experiments/${request.params.exp_uuid}/outputs` });
        const r = aggregate({
            type: PAYLOAD_TYPE.AGGREGATE_OUTPUTS,
            exp_uuid: request.params.exp_uuid,
            response_models: await coordinator.fetchOutputs(request.params.exp_uuid),
        });
        // end();
        E();
        return r;
    });
    done();
};

export const xyRoute: FastifyPluginCallback = (fastify, opts, done) => {
    fastify.post<{
        Body: Query;
        Params: { exp_uuid: string; output_id: string };
    }>(`/experiments/:exp_uuid/outputs/XY/:output_id/tree`, opts, async (request) => {
        // const end = logger.profiling(
        //     `request GET /experiments/${request.params.exp_uuid}/outputs/XY/${request.params.output_id}/tree`,
        // );
        const { E } = ts_trace.B({
            name: `request GET /experiments/${request.params.exp_uuid}/outputs/XY/${request.params.output_id}/tree`,
        });
        const r = aggregate({
            type: PAYLOAD_TYPE.AGGREGATE_XY_TREE,
            exp_uuid: request.params.exp_uuid,
            output_id: request.params.output_id,
            response_models: await coordinator.fetchXYTree(
                request.params.exp_uuid,
                request.params.output_id,
                request.body,
            ),
        });
        // end();
        E();
        return r;
    });

    fastify.post<{
        Body: Query;
        Params: { exp_uuid: string; output_id: string };
    }>(`/experiments/:exp_uuid/outputs/XY/:output_id/xy`, opts, async (request) => {
        // const end = logger.profiling(
        //     `request GET /experiments/${request.params.exp_uuid}/outputs/XY/${request.params.output_id}/xy`,
        // );
        const { E } = ts_trace.B({
            name: `request GET /experiments/${request.params.exp_uuid}/outputs/XY/${request.params.output_id}/xy`,
        });
        const r = aggregate({
            type: PAYLOAD_TYPE.AGGREGATE_XY_MODEL,
            exp_uuid: request.params.exp_uuid,
            output_id: request.params.output_id,
            response_models: await coordinator.fetchXY(
                request.params.exp_uuid,
                request.params.output_id,
                request.body,
            ),
        });
        // end();
        E();
        return r;
    });

    done();
};
