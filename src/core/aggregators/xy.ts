import { Aggregator } from "./types/Aggregator";
import { cpuUsageTree } from "./simple-aggregators/cpu-usage-tree";
import { cpuUsageXY } from "./simple-aggregators/cpu-usage-xy";
import { statistics, statisticsStep0, statisticsStep1 } from "./simple-aggregators/statistics";

export const xy_tree_aggregator = new Aggregator(
    {
        [`org.eclipse.tracecompass.analysis.os.linux.core.cpuusage.CpuUsageDataProvider/tree`]:
            cpuUsageTree,
        [`org.eclipse.tracecompass.analysis.os.linux.core.statistics.StatisticsDataProvider/tree/0`]:
            statisticsStep0,
        [`org.eclipse.tracecompass.analysis.os.linux.core.statistics.StatisticsDataProvider/tree/1`]:
            statisticsStep1,
        [`org.eclipse.tracecompass.analysis.os.linux.core.statistics.StatisticsDataProvider/tree`]:
            statistics,
    },
    `xy_tree_aggregator`,
);

export const xy_model_aggregator = new Aggregator(
    {
        [`org.eclipse.tracecompass.analysis.os.linux.core.cpuusage.CpuUsageDataProvider/xy`]:
            cpuUsageXY,
    },
    `xy_model_aggregator`,
);
