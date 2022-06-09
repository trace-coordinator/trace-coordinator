import { Time } from "../lib/Time";
import { Entry, ResponseStatus } from "tsp-typescript-client";
import { XYTreeAggregatorPayload } from "../types/payload";
import { XYTreeResponseModel } from "types/tsp";
import { aggregateStatus } from "../lib";

const isSameEntry = (e1: Entry, e2: Entry) =>
    e2 && e1.labels[0] === e2.labels[0] && e1.parentId === e2.parentId;

export const cpuUsageTree = (payload: XYTreeAggregatorPayload): XYTreeResponseModel => {
    const status = new Set<ResponseStatus>(payload.response_models.map((rm) => rm.status));
    payload.response_models[0].status = aggregateStatus(status);
    payload.response_models[0].statusMessage =
        payload.response_models[0].status.capitalizeOnlyFirstLetter();

    payload.response_models[0].model.entries.forEach((original_entry, i) => {
        let number_of_similar_entry = 1;
        let percentage = parseFloat(original_entry.labels[2]);
        const usage_time = new Time(original_entry.labels[3]);
        for (let j = 1; j < payload.response_models.length; j++) {
            const entries = payload.response_models[j].model.entries;
            let similar_entry: typeof original_entry | undefined;
            if (isSameEntry(original_entry, entries[i])) {
                similar_entry = entries[i];
            } else {
                entries.forEach((entry, k) => {
                    if (k !== i && isSameEntry(original_entry, entry)) similar_entry = entry;
                });
            }
            if (similar_entry) {
                percentage += parseFloat(similar_entry.labels[2]);
                usage_time.plus(similar_entry.labels[3]);
                original_entry.hasData = original_entry.hasData || similar_entry.hasData;
                number_of_similar_entry++;
            }
        }
        original_entry.labels[2] = `${percentage / number_of_similar_entry} %`;
        original_entry.labels[3] = usage_time.divide(number_of_similar_entry).toString();
    });
    return payload.response_models[0];
};
