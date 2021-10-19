import { performance } from "perf_hooks";
import config from "config";
import { server } from "server";

class ProfilingError extends Error {
    readonly name = ProfilingError.name;
}

const timestamps: { [key: string]: number } = {};

const end = function (this: typeof timestamps, key: string) {
    if (config.profiling) {
        if (!this[key]) throw new ProfilingError(`Profiling did not start for ${key}`);
        logger.info(`${key} execution time: ${performance.now() - this[key]}`);
        this[key] = NaN;
    }
}.bind(timestamps);

const start = function (this: typeof timestamps, key: string) {
    if (config.profiling) {
        if (this[key]) logger.warn(`Profiling started at multiple places for ${key}`);
        this[key] = performance.now();
        return () => end(key);
    } else
        return () => {
            // empty function, do nothing when profiling disabled
        };
}.bind(timestamps);

export const logger = Object.assign(server.log, { profiling: Object.assign(start, { end }) });
