// eslint-disable-next-line @typescript-eslint/naming-convention
export const PAYLOAD_TYPE = {
    AGGREGATE_EXPERIMENTS: `AGGREGATE_EXPERIMENTS`,
    AGGREGATE_EXPERIMENT: `AGGREGATE_EXPERIMENT`,
    AGGREGATE_OUTPUTS: `AGGREGATE_OUTPUTS`,
    AGGREGATE_XY_TREE: `AGGREGATE_XY_TREE`,
    AGGREGATE_XY_MODEL: `AGGREGATE_XY_MODEL`,
    AGGREGATE_STYLES: `AGGREGATE_STYLES`,
    AGGREGATE_ANNOTATIONS: `AGGREGATE_ANNOTATIONS`,
} as const;

import { Experiment, OutputDescriptor } from "tsp-typescript-client";
import { XYTreeResponseModel, XYModelResponseModel, WithTraceServerUrl } from "./tsp";

type ExpUUID = { exp_uuid: string };
type OutputID = { output_id: string };
export type AggregateExperimentsPayload = {
    type: typeof PAYLOAD_TYPE[`AGGREGATE_EXPERIMENTS`];
    response_models: WithTraceServerUrl<Experiment[]>[];
};
export type AggregateExperimentPayload = ExpUUID & {
    type: typeof PAYLOAD_TYPE[`AGGREGATE_EXPERIMENT`];
    response_models: WithTraceServerUrl<Experiment>[];
};
export type AggregateOutputsPayload = ExpUUID & {
    type: typeof PAYLOAD_TYPE[`AGGREGATE_OUTPUTS`];
    response_models: WithTraceServerUrl<OutputDescriptor[]>[];
};
export type AggregateXYTreePayload = ExpUUID &
    OutputID & {
        type: typeof PAYLOAD_TYPE[`AGGREGATE_XY_TREE`];
        response_models: WithTraceServerUrl<XYTreeResponseModel>[];
    };
export type AggregateXYModelPayload = ExpUUID &
    OutputID & {
        type: typeof PAYLOAD_TYPE[`AGGREGATE_XY_MODEL`];
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

export type SimplePayloadType =
    | AggregateExperimentsPayload
    | AggregateExperimentPayload
    | AggregateOutputsPayload
    | AggregateXYTreePayload
    | AggregateXYModelPayload;
