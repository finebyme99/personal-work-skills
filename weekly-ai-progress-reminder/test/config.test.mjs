import assert from "node:assert/strict";
import test from "node:test";

import { ALLOWED_STATUSES } from "../src/config.mjs";

test("production filter includes only 待启动 and 进行中", () => {
  assert.deepEqual([...ALLOWED_STATUSES], ["待启动", "进行中"]);
});
