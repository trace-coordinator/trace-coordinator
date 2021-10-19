import { AggregateOutputsPayload } from "types/payload";
import { OutputDescriptor } from "tsp-typescript-client";
import { logger } from "logger";

export const aggregateOutputs = (payload: AggregateOutputsPayload): OutputDescriptor[] => {
    const end = logger.profiling(aggregateOutputs.name);
    const added = new Set<string>();
    const o = payload.response_models.flatMap((response_model) =>
        response_model.filter((o) => {
            if (!added.has(o.id)) {
                added.add(o.id);
                return true;
            }
            return false;
        }),
    );
    end();
    return o;
};
