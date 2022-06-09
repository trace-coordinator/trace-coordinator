import { logger } from "logger";

export const exitWithError = (error: unknown) => {
    logger.error(error as object);
    process.exit(1);
};
