import { AggregateExperimentPayload, AggregateExperimentsPayload, PAYLOAD_TYPE } from "types/payload";
import { WithTraceServerUrl } from "types/tsp";
import { GenericResponse, OutputDescriptor, ResponseStatus } from "tsp-typescript-client";

export const aggregateStatus = (status: Set<ResponseStatus>): ResponseStatus => {
    return status.has(ResponseStatus.FAILED)
        ? ResponseStatus.FAILED
        : status.has(ResponseStatus.CANCELLED)
        ? ResponseStatus.CANCELLED
        : status.has(ResponseStatus.RUNNING)
        ? ResponseStatus.RUNNING
        : ResponseStatus.COMPLETED;
};

export const splitExperimentsPayload = (
    payload: AggregateExperimentsPayload,
): AggregateExperimentPayload[] => {
    const eps: { [exp_uuid: string]: AggregateExperimentPayload } = {};
    payload.response_models.forEach((response_model) => {
        response_model.forEach((e) => {
            if (!eps[e.UUID])
                eps[e.UUID] = {
                    type: PAYLOAD_TYPE.AGGREGATE_EXPERIMENT,
                    exp_uuid: e.UUID,
                    response_models: [],
                };
            const ewurl = e as WithTraceServerUrl<typeof e>;
            ewurl.trace_server_url = response_model.trace_server_url;
            eps[e.UUID].response_models.push(ewurl);
        });
    });
    return Object.values(eps);
};

export const newGenericResponse = <T>({
    model,
    aggregated_status,
}: {
    model: T;
    aggregated_status: Set<ResponseStatus>;
}): GenericResponse<T> => {
    const status = aggregateStatus(aggregated_status);
    return {
        model,
        output: {} as OutputDescriptor,
        status,
        statusMessage: status.capitalizeOnlyFirstLetter(),
    };
};
