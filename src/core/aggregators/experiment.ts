import { ExperimentAggregatorPayload } from "./types/payload";
import { ResponseStatus, Experiment } from "tsp-typescript-client";
import { aggregateStatus } from "core/aggregators/lib";
import { Aggregator } from "./types/Aggregator";

export const experiment_aggregator = new Aggregator(
    (payload: ExperimentAggregatorPayload): Experiment => {
        const first = payload.response_models[0];
        const status = new Set<ResponseStatus>();
        status.add(first.indexingStatus as ResponseStatus);
        let next_index = first.traces.length;
        first.traces.length *= payload.response_models.length;

        for (let i = 1; i < payload.response_models.length; i++) {
            if (payload.response_models[i].start < first.start)
                first.start = payload.response_models[i].start;
            if (payload.response_models[i].end > first.end)
                first.end = payload.response_models[i].end;
            first.nbEvents += payload.response_models[i].nbEvents;
            status.add(payload.response_models[i].indexingStatus as ResponseStatus);
            payload.response_models[i].traces.forEach((trace) => {
                first.traces[next_index] = trace;
                next_index++;
            });
            first.traces.length = next_index;
        }

        first.indexingStatus = aggregateStatus(status) as string;
        return first;
    },
    `experiment_aggregator`,
);
