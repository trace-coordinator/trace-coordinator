/* eslint-disable @typescript-eslint/ban-ts-comment */
/**
 * String.prototype.replaceAll() polyfill
 * https://gomakethings.com/how-to-replace-a-section-of-a-string-with-another-one-with-vanilla-js/
 * @author Chris Ferdinandi
 * @license MIT
 */
if (!String.prototype.replaceAll) {
    String.prototype.replaceAll = function (str, new_str) {
        // If a regex pattern
        if (
            Object.prototype.toString.call(str).toLowerCase() ===
            `[object regexp]`
        ) {
            // ts-bug: compiler doesn't understand type of new_str because of overloaded functions
            // @ts-ignore
            return this.replace(str, new_str);
        }

        // If a string
        // ts-bug: compiler doesn't understand type of new_str because of overloaded functions
        // @ts-ignore
        return this.replace(new RegExp(str, `g`), new_str);
    };
}
