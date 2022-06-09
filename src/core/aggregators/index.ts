import { AGGREGATOR_PAYLOAD_TYPE, AggregatorsPayload } from "./types/payload";
import { experiment_aggregator } from "./experiment";
import { outputs_aggregator } from "./outputs";
import { splitExperimentsPayload } from "./lib";
import { xy_model_aggregator, xy_tree_aggregator } from "./xy";

export const aggregate = (payload: AggregatorsPayload): object => {
    switch (payload.type) {
        case AGGREGATOR_PAYLOAD_TYPE.EXPERIMENTS:
            return splitExperimentsPayload(payload).map((p) => experiment_aggregator.aggregate(p));
        case AGGREGATOR_PAYLOAD_TYPE.EXPERIMENT:
            return experiment_aggregator.aggregate(payload);
        case AGGREGATOR_PAYLOAD_TYPE.OUTPUTS:
            return outputs_aggregator.aggregate(payload);
        case AGGREGATOR_PAYLOAD_TYPE.XY_TREE:
            return xy_tree_aggregator.aggregate(payload);
        case AGGREGATOR_PAYLOAD_TYPE.XY_MODEL:
            return xy_model_aggregator.aggregate(payload);
    }
};
