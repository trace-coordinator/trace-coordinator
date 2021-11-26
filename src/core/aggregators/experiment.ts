import { AggregateExperimentPayload } from "types/payload";
import { Trace, ResponseStatus, Experiment } from "tsp-typescript-client";
import { aggregateStatus } from "core/aggregators/lib";
import { tracer } from "tracer";

export const aggregateExperiment = (payload: AggregateExperimentPayload): Experiment => {
    const { E } = tracer.B({ name: `fn ${aggregateExperiment.name}` });
    const e = {
        start: -1n,
        end: 0n,
        nbEvents: 0,
        traces: new Array<Trace>(payload.response_models[0].traces.length * payload.response_models.length),
    };
    const status = new Set<ResponseStatus>();
    let gi = 0;
    payload.response_models.forEach((response_model) => {
        if (e.start === -1n || response_model.start < e.start) e.start = response_model.start;
        if (response_model.end > e.end) e.end = response_model.end;
        e.nbEvents += response_model.nbEvents;
        status.add(response_model.indexingStatus as ResponseStatus);
        response_model.traces.forEach((trace, i) => {
            e.traces[gi + i] = trace;
        });
        gi += response_model.traces.length;
    });
    e.traces.length = gi;
    const r = {
        name: payload.response_models[0].name,
        UUID: payload.exp_uuid,
        indexingStatus: aggregateStatus(status) as string,
        ...e,
    };
    E();
    return r;
};
