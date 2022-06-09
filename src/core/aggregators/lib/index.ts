import {
    ExperimentAggregatorPayload,
    ExperimentsAggregatorPayload,
    AGGREGATOR_PAYLOAD_TYPE,
    WithTraceServerUrl,
} from "../types/payload";
import { ResponseStatus } from "tsp-typescript-client";

export const aggregateStatus = (status: Set<ResponseStatus>): ResponseStatus => {
    return status.has(ResponseStatus.FAILED)
        ? ResponseStatus.FAILED
        : status.has(ResponseStatus.CANCELLED)
        ? ResponseStatus.CANCELLED
        : status.has(ResponseStatus.RUNNING)
        ? ResponseStatus.RUNNING
        : status.size === 1
        ? (status.values().next().value as ResponseStatus)
        : ResponseStatus.COMPLETED;
};

export const splitExperimentsPayload = (
    payload: ExperimentsAggregatorPayload,
): ExperimentAggregatorPayload[] => {
    const result: { [exp_uuid: string]: ExperimentAggregatorPayload } = {};
    payload.response_models.forEach((response_model) => {
        response_model.forEach((experiment) => {
            if (!result[experiment.UUID])
                result[experiment.UUID] = {
                    type: AGGREGATOR_PAYLOAD_TYPE.EXPERIMENT,
                    operation: payload.operation,
                    step: payload.step,
                    response_models: [],
                };
            const exp_w_url = experiment as WithTraceServerUrl<typeof experiment>;
            exp_w_url.trace_server_url = response_model.trace_server_url;
            result[experiment.UUID].response_models.push(exp_w_url);
        });
    });
    return Object.values(result);
};
