import { logger } from "logger";

export const exitWithError = (error: unknown) => {
    logger.error(error as object);
    process.exit(1);
};

export const uuid = (() => {
    let i = 0;
    return () => i++;
})();
