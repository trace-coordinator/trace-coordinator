process.on(`unhandledRejection`, (reason, promise) => {
    logger.error(`Unhandled Rejection at:`, promise, `reason:`, reason);
    process.exit(1);
});
import "lib/polyfill";
import { coordinator } from "core/Coordinator";
import { experimentsRoute, experimentRoute, outputsRoute, xyRoute } from "routes";
import config from "config";
import fastify_cors from "fastify-cors";
import { fastify } from "server";
import { logger } from "logger";
import JSB from "json-bigint";
// eslint-disable-next-line @typescript-eslint/naming-convention
const JSONbig = JSB({ useNativeBigInt: true });

/* <DEV-ONLY> */
fastify.addHook(`onRequest`, (req, _reply_, done) => {
    logger.debug({ reqId: undefined }, `[${req.id as string}].onRequest ${req.raw.url}`);
    done();
});

fastify.addHook(`onResponse`, (req, reply, done) => {
    logger.debug({ reqId: undefined }, `[${req.id as string}].onResponse ${reply.raw.statusCode}`);
    done();
});
/* </DEV-ONLY> */

// custom json parser
fastify.addContentTypeParser(`application/json`, { parseAs: `string` }, function (_req_, body, done) {
    try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const request_body = JSONbig.parse(body as string);
        logger.debug(`request.body`);
        if (logger.isLevelEnabled(`debug`)) console.log(request_body);
        done(null, request_body);
    } catch (err) {
        (err as Error & { statusCode: number }).statusCode = 400;
        done(err as Error, undefined);
    }
});
fastify.setSerializerCompiler(() => (data) => JSONbig.stringify(data));

const opts = {
    prefix: `/tsp/api`,
    // fastify only use custom serializer when having schema, so we put an empty one
    schema: {
        response: {
            "2xx": {},
        },
    },
};
void fastify.register(fastify_cors);
fastify.post(`/tsp/api/dev/createExperimentsFromTraces`, opts, async () => {
    await coordinator.createExperimentsFromTraces();
    logger.debug(`done`);
    return `done`;
});
void fastify.register(experimentsRoute, opts);
void fastify.register(experimentRoute, opts);
void fastify.register(outputsRoute, opts);
void fastify.register(xyRoute, opts);

// start server
void (async () => {
    logger.info(`NODE_ENV = ${process.env.NODE_ENV || `development`}`);
    await fastify.listen(config.port, `0.0.0.0`);
})();
