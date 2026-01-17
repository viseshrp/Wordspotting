/**
 * Smoke-test options helpers by loading file in JSDOM and using exported utils.
 */
import * as utils from "../src/js/utils.js";
import { partitionSitePatterns } from "../src/js/options.js";

describe("options helpers", () => {
    test("partitionSitePatterns filters invalid", () => {
        const { valid, invalid } = partitionSitePatterns(["*good*", ""], utils.buildSiteRegex);
        expect(valid).toContain("*good*");
        expect(invalid).toContain("");
    });
});
