import { XYTreeAggregatorPayload } from "../types/payload";
import { AggregatorError } from "../types/Aggregator";
import { XYTreeResponseModel } from "types/tsp";
import { Entry, ResponseStatus } from "tsp-typescript-client";
import { aggregateStatus } from "../lib";

export const statisticsStep0 = (payload: XYTreeAggregatorPayload): { total: number } => {
    for (let i = 0; i < payload.response_models[0].model.entries.length; i++) {
        const original_entry = payload.response_models[0].model.entries[i];
        if (original_entry.parentId === -1) {
            let total = Number(original_entry.labels[1]);
            for (let j = 1; j < payload.response_models.length; j++) {
                const entries = payload.response_models[j].model.entries;
                let similar_entry: typeof original_entry | undefined;
                if (entries[i].parentId === -1) {
                    similar_entry = entries[i];
                } else {
                    entries.forEach((entry, k) => {
                        if (k !== i && entry.parentId === -1) similar_entry = entry;
                    });
                }
                if (similar_entry) {
                    total += Number(similar_entry.labels[1]);
                }
            }
            return { total };
        }
    }
    throw new AggregatorError(`Can't compute global total number of events`);
};

export const statisticsStep1 = (
    payload: XYTreeAggregatorPayload,
    transform = (entry: Entry) => entry,
): XYTreeResponseModel => {
    const status = new Set<ResponseStatus>(payload.response_models.map((rm) => rm.status));
    payload.response_models[0].status = aggregateStatus(status);
    payload.response_models[0].statusMessage =
        payload.response_models[0].status.capitalizeOnlyFirstLetter();

    let next_index = payload.response_models[0].model.entries.length;
    payload.response_models[0].model.entries.length *= payload.response_models.length;

    for (let i = 1; i < payload.response_models.length; i++) {
        payload.response_models[i].model.entries.forEach((entry) => {
            payload.response_models[0].model.entries[next_index] = transform(entry);
            next_index++;
        });
    }
    payload.response_models[0].model.entries.length = next_index;
    return payload.response_models[0];
};

const computeNewPercentage = (entry: Entry, total: number) => {
    entry.labels[2] = String((100 * Number(entry.labels[1])) / total);
    return entry;
};

export const statistics = (payload: XYTreeAggregatorPayload): XYTreeResponseModel => {
    const { total } = statisticsStep0(payload);
    payload.response_models[0].model.entries.forEach((entry) => {
        computeNewPercentage(entry, total);
    });
    return statisticsStep1(payload, (entry) => computeNewPercentage(entry, total));
};
