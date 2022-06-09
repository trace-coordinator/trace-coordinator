import { Experiment, OutputDescriptor } from "tsp-typescript-client";
import { XYTreeResponseModel, XYModelResponseModel } from "../../../types/tsp";

// eslint-disable-next-line @typescript-eslint/naming-convention
export const AGGREGATOR_PAYLOAD_TYPE = {
    EXPERIMENTS: `EXPERIMENTS`,
    EXPERIMENT: `EXPERIMENT`,
    OUTPUTS: `OUTPUTS`,
    XY_TREE: `XY_TREE`,
    XY_MODEL: `XY_MODEL`,
    STYLES: `STYLES`,
    ANNOTATIONS: `ANNOTATIONS`,
} as const;

export type WithTraceServerUrl<T> = T & {
    trace_server_url: string;
};

// type ExpUUID = { exp_uuid: string };
export type OutputUrl = { output_url: string };
export type Optional = { operation?: string; step?: number };
export type ExperimentsAggregatorPayload = Optional & {
    type: typeof AGGREGATOR_PAYLOAD_TYPE[`EXPERIMENTS`];
    response_models: WithTraceServerUrl<Experiment[]>[];
};
export type ExperimentAggregatorPayload = Optional & {
    type: typeof AGGREGATOR_PAYLOAD_TYPE[`EXPERIMENT`];
    response_models: WithTraceServerUrl<Experiment>[];
};
export type OutputsAggregatorPayload = Optional & {
    type: typeof AGGREGATOR_PAYLOAD_TYPE[`OUTPUTS`];
    response_models: WithTraceServerUrl<OutputDescriptor[]>[];
};
export type XYTreeAggregatorPayload = OutputUrl &
    Optional & {
        type: typeof AGGREGATOR_PAYLOAD_TYPE[`XY_TREE`];
        response_models: WithTraceServerUrl<XYTreeResponseModel>[];
    };
export type XYModelAggregatorPayload = OutputUrl &
    Optional & {
        type: typeof AGGREGATOR_PAYLOAD_TYPE[`XY_MODEL`];
        response_models: WithTraceServerUrl<XYModelResponseModel>[];
    };
// export type AggregateStylesPayload = ExpUUID &
//     OutputID & {
//         type: typeof PAYLOAD_TYPE[`AGGREGATE_STYLES`];
//         response_models: WithTraceServerUrl<StylesResponseModel>[];
//     };
// export type AggregateAnnotationsPayload = ExpUUID &
//     OutputID & {
//         type: typeof PAYLOAD_TYPE[`AGGREGATE_ANNOTATIONS`];
//         response_models: WithTraceServerUrl<AnnotationsResponseModel>[];
//     };

export type AggregatorsPayload =
    | ExperimentsAggregatorPayload
    | ExperimentAggregatorPayload
    | OutputsAggregatorPayload
    | XYTreeAggregatorPayload
    | XYModelAggregatorPayload;
