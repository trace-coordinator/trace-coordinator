import Fastify, { FastifyInstance } from "fastify";
import pino from "pino";

export const fastify: FastifyInstance = Fastify({
    logger: pino({
        level: process.env.NODE_ENV ? `info` : `trace`,
        /* <DEV-ONLY> */
        prettyPrint: { ignore: `pid,hostname` },
        timestamp: () => `,"time":"${new Date(Date.now()).toISOString()}"`,
        /* </DEV-ONLY> */
    }),
    /* <DEV-ONLY> */
    disableRequestLogging: true,
    /* </DEV-ONLY> */
});
