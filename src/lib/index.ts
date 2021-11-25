import { logger } from "logger";

export const extractUnit = (s: string) => s.match(/[a-z]*$/)?.[0];
export const exitWithError = (e: unknown) => {
    logger.error(e as object);
    process.exit(1);
};
