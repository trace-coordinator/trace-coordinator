import { Time } from "lib/Time";
import { tracer } from "tracer";
import { Entry, ResponseStatus, XYSeries } from "tsp-typescript-client";
import { AggregateXYModelPayload, AggregateXYTreePayload } from "types/payload";
import { XYModelResponseModel, XYTreeResponseModel } from "types/tsp";
import { aggregateStatus } from "./lib";

class XyAggregationError extends Error {
    readonly name = XyAggregationError.name;
}

const isSameEntry = (e1: Entry, e2: Entry) => e1.labels[0] === e2.labels[0] && e1.parentId === e2.parentId;
export const aggregateXyTree = (payload: AggregateXYTreePayload): XYTreeResponseModel => {
    if (
        payload.output_id === `org.eclipse.tracecompass.analysis.os.linux.core.cpuusage.CpuUsageDataProvider`
    ) {
        const { E } = tracer.B({ name: `fn ${aggregateXyTree.name}` });
        const status = new Set<ResponseStatus>();
        status.add(payload.response_models[0].status);
        payload.response_models[0].model.entries.map((e, i) => {
            let n = 1;
            let pct = parseFloat(e.labels[2]);
            const usage_time = new Time(e.labels[3]);
            for (let j = 1; j < payload.response_models.length; j++) {
                if (status.size < payload.response_models.length)
                    status.add(payload.response_models[j].status);
                const entries = payload.response_models[j].model.entries;
                let ee;
                if (isSameEntry(e, entries[i])) {
                    ee = entries[i];
                } else {
                    entries.forEach((entry, k) => {
                        if (k !== i && isSameEntry(e, entry)) ee = entry;
                    });
                }
                if (ee) {
                    pct += parseFloat(ee.labels[2]);
                    usage_time.plus(ee.labels[3]);
                    e.hasData = e.hasData || ee.hasData;
                    n++;
                }
            }
            e.labels[2] = `${pct / n} %`;
            e.labels[3] = usage_time.divide(n).toString();
            return e;
        });
        payload.response_models[0].status = aggregateStatus(status);
        payload.response_models[0].statusMessage =
            payload.response_models[0].status.capitalizeOnlyFirstLetter();
        E();
        return payload.response_models[0];
    }
    throw new XyAggregationError(`XY tree aggregation not exist for output id ${payload.output_id}`);
};

const isSameSerie = (se1: XYSeries, se2: XYSeries) => se1.seriesId === se2.seriesId;
export const aggregateXyModel = (payload: AggregateXYModelPayload): XYModelResponseModel => {
    if (
        payload.output_id === `org.eclipse.tracecompass.analysis.os.linux.core.cpuusage.CpuUsageDataProvider`
    ) {
        const { E } = tracer.B({ name: `fn ${aggregateXyModel.name}` });
        const status = new Set<ResponseStatus>();
        status.add(payload.response_models[0].status);
        payload.response_models[0].model.series.map((se, i) => {
            let n = 1;
            for (let j = 1; j < payload.response_models.length; j++) {
                if (status.size < payload.response_models.length)
                    status.add(payload.response_models[j].status);
                const series = payload.response_models[j].model.series;
                let sese;
                if (isSameSerie(se, series[i])) {
                    sese = series[i];
                } else {
                    series.forEach((serie, k) => {
                        if (k !== i && isSameSerie(se, serie)) sese = serie;
                    });
                }
                if (sese) {
                    // TODO: ts bug: compiler doesn't infer sese type when use inside map
                    // se.yValues.map((y, k) => y + sese.yValues[k]);
                    for (let k = 0; k < se.yValues.length; k++) {
                        se.yValues[k] += sese.yValues[k];
                    }
                    n++;
                }
            }
            se.yValues.map((y) => y / n);
            return se;
        });
        payload.response_models[0].status = aggregateStatus(status);
        payload.response_models[0].statusMessage =
            payload.response_models[0].status.capitalizeOnlyFirstLetter();
        E();
        return payload.response_models[0];
    }
    throw new XyAggregationError(`XY model aggregation not exist for output id ${payload.output_id}`);
};
