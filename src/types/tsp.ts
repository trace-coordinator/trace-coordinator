import { GenericResponse, EntryModel, Entry, XYModel } from "tsp-typescript-client";

export type XYTreeResponseModel = GenericResponse<EntryModel<Entry>>;
export type XYModelResponseModel = GenericResponse<XYModel>;
// export type StylesResponseModel = GenericResponse<OutputStyleModel>;
// export type AnnotationsResponseModel = GenericResponse<AnnotationModel>;

export type WithTraceServerUrl<T> = T & {
    trace_server_url: string;
};
