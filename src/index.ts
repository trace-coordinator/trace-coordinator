/* eslint-disable @typescript-eslint/no-floating-promises */
import "lib/polyfill";
import { tspRoutes } from "routes";
import config from "config";
import fastify_cors from "fastify-cors";
import { fastify } from "server";
import { logger } from "logger";
import { JSONB } from "when-json-met-bigint";
import { exitWithError, uuid } from "lib";
import { tracer } from "tracer";
process.on(`unhandledRejection`, (reason) => {
    logger.error(`Unhandled Rejection reason:`);
    exitWithError(reason);
});

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
fastify.addContentTypeParser(
    `application/json`,
    { parseAs: `string` },
    function (_req_, body, done) {
        const { E } = tracer.B({ name: `fn JSONB.parse ${uuid()}` });
        try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const request_body = JSONB.parse(body as string);
            logger.debug(`request.body`);
            if (logger.isLevelEnabled(`debug`)) console.log(request_body);
            done(null, request_body);
        } catch (e) {
            (e as Error & { statusCode: number }).statusCode = 400;
            done(e as Error, undefined);
        } finally {
            E();
        }
    },
);
fastify.setSerializerCompiler(() => (data) => {
    const { E } = tracer.B({ name: `fn JSONB.stringify ${uuid()}` });
    const result = JSONB.stringify(data) as string;
    E();
    return result;
});

const opts = {
    prefix: `/tsp/api`,
    // fastify only use custom serializer when having schema, so we put an empty one
    schema: {
        response: {
            "2xx": {},
        },
    },
};
fastify.register(fastify_cors);
fastify.register(tspRoutes, opts);

// start server
logger.info(`NODE_ENV = ${process.env.NODE_ENV || `development`}`);
fastify.listen(config.port, `0.0.0.0`).then(() => {
    if (process.send) process.send(`COORDINATOR-UP`);
});
