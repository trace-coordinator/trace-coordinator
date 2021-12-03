import { TsTrace } from "ts-trace";
import fs from "fs";

export const tracer = new TsTrace();
tracer.pipe(fs.createWriteStream(`trace-event-format.json`, `utf8`));
process.on(`SIGINT`, () => process.exit(0));
process.on(`exit`, (code) => {
    tracer.close();
    process.exit(code);
});
