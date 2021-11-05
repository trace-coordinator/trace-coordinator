import { AggregateOutputsPayload } from "types/payload";
import { OutputDescriptor } from "tsp-typescript-client";
import { logger } from "logger";
import { ts_trace } from "tracer";

export const aggregateOutputs = (payload: AggregateOutputsPayload): OutputDescriptor[] => {
    // const end = logger.profiling(aggregateOutputs.name);
    const { E } = ts_trace.B({ name: aggregateOutputs.name });
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
    // end();
    E();
    return o;
};
