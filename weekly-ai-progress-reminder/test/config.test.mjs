import assert from "node:assert/strict";
import test from "node:test";

import { ALLOWED_STATUSES, UPDATE_VIEW_URL } from "../src/config.mjs";

test("production filter includes only 待启动 and 进行中", () => {
  assert.deepEqual([...ALLOWED_STATUSES], ["待启动", "进行中"]);
});

test("record update links use the customized 心愿排名全景 view", () => {
  const url = new URL(UPDATE_VIEW_URL);

  assert.equal(url.searchParams.get("table"), "tbl9WJyxl9bbtYjb");
  assert.equal(url.searchParams.get("view"), "vewKWNtKDJ");
});
