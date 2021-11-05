import { TsTrace } from "ts-trace";
import fs from "fs";

export const tracer = new TsTrace();
tracer.pipe(fs.createWriteStream(`trace-event-format.json`, `utf8`));
process.on(`SIGINT`, function () {
    tracer.close();
    process.exit();
});
