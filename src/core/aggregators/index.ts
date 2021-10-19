import { PAYLOAD_TYPE, SimplePayloadType } from "types/payload";
import { aggregateExperiment } from "./experiment";
import { aggregateOutputs } from "./outputs";
import { splitExperimentsPayload } from "./lib";
import { aggregateXyModel, aggregateXyTree } from "./xy";

export const aggregate = (
    payload: SimplePayloadType,
): Omit<SimplePayloadType[`response_models`][0], `trace_server_url`> => {
    // let r: Omit<SimplePayloadType[`response_models`][0], `trace_server_url`>;
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
        // case PAYLOAD_TYPE.AGGREGATE_STYLES:
        //     r = styles(payload);
        //     break;
        // case PAYLOAD_TYPE.AGGREGATE_ANNOTATIONS:
        //     r = annotations(payload);
        //     break;
        // case PAYLOAD_TYPE.AGGREGATE_TIMEGRAPH_TREE:
        //     r = timegraphTree(payload as AggregateTimegraphTreePayload);
        //     break;
        // case PAYLOAD_TYPE.AGGREGATE_TIMEGRAPH_STATES:
        //     r = timegraphStates(payload as AggregateTimegraphStatesPayload);
        //     break;
        // case PAYLOAD_TYPE.AGGREGATE_TIMEGRAPH_ARROWS:
        //     r = timegraphArrows(payload as AggregateTimegraphArrowsPayload);
        //     break;
        // case PAYLOAD_TYPE.AGGREGATE_XY_TREE:
        //     r = xyTree(payload as AggregateXYTreePayload);
        //     break;
        // case PAYLOAD_TYPE.AGGREGATE_XY_STATES:
        //     r = xyStates(payload as AggregateXYStatesPayload);
        //     break;
    }
};
