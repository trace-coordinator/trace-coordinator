import { OutputsAggregatorPayload } from "./types/payload";
import { OutputDescriptor } from "tsp-typescript-client";
import { Aggregator } from "./types/Aggregator";

export const outputs_aggregator = new Aggregator(
    (payload: OutputsAggregatorPayload): OutputDescriptor[] => {
        const added: Record<string, boolean> = {};
        return payload.response_models.flatMap((response_model) =>
            response_model.filter((o) => {
                if (!added[o.id]) {
                    added[o.id] = true;
                    return true;
                }
                return false;
            }),
        );
    },
    `outputs_aggregator`,
);
