/* global process, console */
import assert from "node:assert/strict";

// Functional checks stay hard assertions in the browser tests. Semantic and
// creative checks are observations by default because they depend on the model.
export function modelQualityChecks() {
  let checked = 0;
  const observations = [];
  const quality = Object.fromEntries(
    ["ok", "match", "doesNotMatch", "equal", "deepEqual"].map((method) => [
      method,
      (...args) => {
        checked++;
        try {
          assert[method](...args);
        } catch (error) {
          if (process.env.WORKSHOP_STRICT_MODEL === "1") throw error;
          observations.push(error.message);
        }
      },
    ]),
  );
  function report() {
    console.log(
      "MODEL QUALITY " +
        JSON.stringify({
          checked,
          passed: checked - observations.length,
          observations,
        }),
    );
  }
  return { quality, report };
}
