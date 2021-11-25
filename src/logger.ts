import { fastify } from "server";
import { Logger } from "pino";

export const logger = fastify.log as Logger;
