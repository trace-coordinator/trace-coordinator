import { TsTrace } from "ts-trace-event";
import fs from "fs";
import path from "path";

const ensureDirExist = (file_path: string) => {
    const dirname = path.dirname(file_path);
    if (!fs.existsSync(dirname)) {
        ensureDirExist(dirname);
        fs.mkdirSync(dirname);
    }
    return file_path;
};

const basename = `trace-event-formats/trace`;
let i = 0;
while (fs.existsSync(`${basename}-${i}.json`)) {
    i++;
}

export const tracer = new TsTrace();
tracer.pipe(fs.createWriteStream(ensureDirExist(`${basename}-${i}.json`), `utf8`));
process.on(`SIGINT`, () => process.exit(0));
process.on(`exit`, (code) => {
    tracer.close();
    process.exit(code);
});
