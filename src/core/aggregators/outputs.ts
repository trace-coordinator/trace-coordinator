import { AggregateOutputsPayload } from "types/payload";
import { OutputDescriptor } from "tsp-typescript-client";
import { tracer } from "tracer";

export const aggregateOutputs = (payload: AggregateOutputsPayload): OutputDescriptor[] => {
    const { E } = tracer.B({ name: `fn ${aggregateOutputs.name}` });
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
    E();
    return o;
};
