import { TsTrace } from "ts-trace";
import fs from "fs";

export const ts_trace = new TsTrace();
ts_trace.pipe(fs.createWriteStream(`trace-event-format.json`, `utf8`));
