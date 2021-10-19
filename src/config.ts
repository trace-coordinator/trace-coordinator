import fs from "fs";
import { exitWithError } from "lib";

class ParseConfigurationError extends Error {
    readonly name = ParseConfigurationError.name;
}

type TraceServerConfiguration = {
    url: string;
    [key: string]: string;
};

let config = {} as {
    port: number;
    profiling: boolean;
    trace_servers_configuration: TraceServerConfiguration[];
};

try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const package_json = JSON.parse(fs.readFileSync(`./package.json`, `utf8`));
    config = {
        // TODO: eslint bug: optional chain is used here so it shouldn't be unsafe access
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        port: Number(package_json?.[`trace-coordinator`]?.port) || 8080,
        // TODO: eslint bug: optional chain is used here so it shouldn't be unsafe access
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        profiling: Boolean(package_json?.[`trace-coordinator`]?.profiling),
        trace_servers_configuration: (() => {
            // TODO: eslint bug: optional chain is used here so it shouldn't be unsafe access
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            const tmp: unknown = package_json?.[`trace-coordinator`]?.[`trace-servers`];
            if (Array.isArray(tmp)) {
                return tmp.map((tsc: TraceServerConfiguration, i) => {
                    if (typeof tsc.url !== `string`)
                        throw new ParseConfigurationError(
                            `Trace server number ${i} base url wrong format or missing in configuration`,
                        );
                    return tsc;
                });
            } else {
                throw new ParseConfigurationError(`Trace servers configuration wrong format or missing`);
            }
        })(),
    };
} catch (e) {
    exitWithError(e);
}

export default config;
