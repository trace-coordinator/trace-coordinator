import { ResponseStatus, XYSeries } from "tsp-typescript-client";
import { XYModelAggregatorPayload } from "../types/payload";
import { XYModelResponseModel } from "types/tsp";
import { aggregateStatus } from "../lib";

const isSameSerie = (se1: XYSeries, se2: XYSeries) => se2 && se1.seriesId === se2.seriesId;
export const cpuUsageXY = (payload: XYModelAggregatorPayload): XYModelResponseModel => {
    const status = new Set<ResponseStatus>(payload.response_models.map((rm) => rm.status));
    payload.response_models[0].status = aggregateStatus(status);
    payload.response_models[0].statusMessage =
        payload.response_models[0].status.capitalizeOnlyFirstLetter();

    payload.response_models[0].model.series.forEach((original_serie, i) => {
        let number_of_similar_serie = 1;
        for (let j = 1; j < payload.response_models.length; j++) {
            const series = payload.response_models[j].model.series;
            let similar_serie: typeof original_serie | undefined;
            if (isSameSerie(original_serie, series[i])) {
                similar_serie = series[i];
            } else {
                similar_serie = series[series.length - 1];
                // series.forEach((serie, k) => {
                //     if (k !== i && isSameSerie(original_serie, serie)) similar_serie = serie;
                // });
            }
            if (similar_serie) {
                // TODO: ts bug: compiler doesn't infer similar_serie type when use inside map
                // original_serie.yValues.map((y, k) => y + similar_serie.yValues[k]);
                for (let k = 0; k < original_serie.yValues.length; k++) {
                    original_serie.yValues[k] += similar_serie.yValues[k];
                }
                number_of_similar_serie++;
            }
        }
        original_serie.yValues.map((y) => y / number_of_similar_serie);
    });
    return payload.response_models[0];
};
