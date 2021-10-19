process.on(`unhandledRejection`, (reason, promise) => {
    console.error(`Unhandled Rejection at:`, promise, `reason:`, reason);
    process.exit(1);
});

import "lib/polyfill";
import { coordinator } from "core/Coordinator";
import { experimentsRoute, experimentRoute, outputsRoute, xyRoute } from "routes";
import config from "config";
import fastify_cors from "fastify-cors";
import { server } from "server";
import { logger } from "logger";

void server.register(fastify_cors);

/* <DEV-ONLY> */
server.addHook(`onRequest`, (req, _reply_, done) => {
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    req.log.debug({ reqId: undefined }, `[${req.id}].onRequest ${req.raw.url}`);
    done();
});

server.addHook(`onResponse`, (req, reply, done) => {
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    req.log.debug({ reqId: undefined }, `[${req.id}].onResponse ${reply.raw.statusCode}`);
    done();
});
/* </DEV-ONLY> */

const opts = { prefix: `/tsp/api` };
void server.register(experimentsRoute, opts);
void server.register(experimentRoute, opts);
void server.register(outputsRoute, opts);
void server.register(xyRoute, opts);

server.post(`/tsp/api/dev/createExperimentsFromTraces`, async () => {
    await coordinator.createExperimentsFromTraces();
    return `done`;
});

// start server
void (async () => {
    logger.info(`NODE_ENV = ${process.env.NODE_ENV || `development`}`);
    await server.listen(config.port, `0.0.0.0`);
})();
