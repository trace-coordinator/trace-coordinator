import { PAYLOAD_TYPE, SimplePayloadType } from "types/payload";
import { aggregateExperiment } from "./experiment";
import { aggregateOutputs } from "./outputs";
import { splitExperimentsPayload } from "./lib";
import { aggregateXyModel, aggregateXyTree } from "./xy";

export const aggregate = (
    payload: SimplePayloadType,
): Omit<SimplePayloadType[`response_models`][0], `trace_server_url`> => {
    switch (payload.type) {
        case PAYLOAD_TYPE.AGGREGATE_EXPERIMENTS:
            return splitExperimentsPayload(payload).map((p) => aggregateExperiment(p));
        case PAYLOAD_TYPE.AGGREGATE_EXPERIMENT:
            return aggregateExperiment(payload);
        case PAYLOAD_TYPE.AGGREGATE_OUTPUTS:
            return aggregateOutputs(payload);
        case PAYLOAD_TYPE.AGGREGATE_XY_TREE:
            return aggregateXyTree(payload);
        case PAYLOAD_TYPE.AGGREGATE_XY_MODEL:
            return aggregateXyModel(payload);
    }
};
