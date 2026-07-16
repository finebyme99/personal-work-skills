import assert from "node:assert/strict";
import test from "node:test";

import {
  buildLogMarkdown,
  buildReminderMarkdown,
  filterAndGroupRecords,
  formatDate,
  runReminder,
} from "../src/core.mjs";

const allowedStatuses = new Set([
  "进行中",
  "试点上线",
  "推广上线",
  "待启动",
  "开放认领",
]);

function record(fields, recordId = "rec_1") {
  return { record_id: recordId, fields };
}

test("filterAndGroupRecords filters statuses and empty owners, and duplicates multi-owner rows", () => {
  const records = [
    record({
      场景名称: "智能排班",
      落地进展: "进行中",
      AI对接人: [
        { id: "ou_alice", name: "Alice" },
        { open_id: "ou_bob", name: "Bob" },
      ],
    }),
    record({
      场景名称: "无负责人",
      落地进展: "待启动",
      AI对接人: [],
    }, "rec_2"),
    record({
      场景名称: "已完成",
      落地进展: "完成",
      AI对接人: [{ id: "ou_alice", name: "Alice" }],
    }, "rec_3"),
  ];

  const result = filterAndGroupRecords(records, allowedStatuses);

  assert.equal(result.matchedRecordCount, 1);
  assert.equal(result.groups.size, 2);
  assert.equal(result.groups.get("ou_alice").records[0].record_id, "rec_1");
  assert.equal(result.groups.get("ou_bob").records[0].record_id, "rec_1");
});

test("buildReminderMarkdown includes bold fields and a customized-view update link for each record", () => {
  const markdown = buildReminderMarkdown({
    ownerName: "Alice",
    records: [
      record({
        场景名称: "智能排班",
        落地进展: "试点上线",
        计划试点日期: 1786032000000,
        进展备注: "等待验收",
      }),
      record({ 场景名称: "知识助手", 落地进展: "待启动" }, "rec_2"),
    ],
    baseUrl: "https://example.com/wiki/node?table=tbl_1&view=vew_custom",
    timeZone: "Asia/Shanghai",
  });

  assert.match(markdown, /\*\*落地进展\*\*/);
  assert.match(markdown, /\*\*预计试点上线日期\*\*/);
  assert.match(markdown, /\*\*进展备注\*\*/);
  assert.match(markdown, /### 智能排班/);
  assert.match(markdown, /- 落地进展：试点上线/);
  assert.match(markdown, /- 预计试点上线日期：2026-08-07/);
  assert.match(markdown, /- 进展备注：等待验收/);
  assert.match(markdown, /### 知识助手[\s\S]*未填写/);
  assert.match(markdown, /\[打开这条记录更新\]\(https:\/\/example\.com\/wiki\/node\?table=tbl_1&view=vew_custom&record=rec_1\)/);
  assert.match(markdown, /\[打开这条记录更新\]\(https:\/\/example\.com\/wiki\/node\?table=tbl_1&view=vew_custom&record=rec_2\)/);
  assert.match(markdown, /\[打开“心愿排名全景”视图\]\(https:\/\/example\.com\/wiki\/node\?table=tbl_1&view=vew_custom\)/);
});

test("formatDate supports timestamps, date strings and empty values", () => {
  assert.equal(formatDate(null, "Asia/Shanghai"), "未填写");
  assert.equal(formatDate("2026-08-11", "Asia/Shanghai"), "2026-08-11");
  assert.equal(formatDate(1786032000000, "Asia/Shanghai"), "2026-08-07");
});

test("buildLogMarkdown lists totals and each recipient result without exposing open ids", () => {
  const markdown = buildLogMarkdown({
    mode: "scheduled",
    startedAt: "2026-07-20T01:05:00.000Z",
    finishedAt: "2026-07-20T01:05:03.000Z",
    matchedRecordCount: 3,
    recipientCount: 2,
    results: [
      { ownerName: "Alice", sceneCount: 2, ok: true, messageId: "om_1" },
      { ownerName: "Bob", sceneCount: 1, ok: false, error: "rate limited" },
    ],
    timeZone: "Asia/Shanghai",
  });

  assert.match(markdown, /成功：1/);
  assert.match(markdown, /失败：1/);
  assert.match(markdown, /Alice：2 个场景，发送成功/);
  assert.match(markdown, /Bob：1 个场景，发送失败（rate limited）/);
  assert.doesNotMatch(markdown, /ou_/);
});

test("runReminder preview mode sends only one preview and one log to the report user", async () => {
  const sent = [];
  const api = {
    listAllRecords: async () => [
      record({
        场景名称: "智能排班",
        落地进展: "进行中",
        AI对接人: [{ id: "ou_alice", name: "Alice" }],
      }),
    ],
    sendMarkdown: async (message) => {
      sent.push(message);
      return { messageId: `om_${sent.length}` };
    },
  };

  const report = await runReminder({
    api,
    mode: "preview",
    reportUserOpenId: "ou_report",
    allowedStatuses,
    baseUrl: "https://example.com/base",
    now: () => new Date("2026-07-20T01:05:00.000Z"),
  });

  assert.equal(sent.length, 2);
  assert.deepEqual(sent.map(({ receiveId }) => receiveId), ["ou_report", "ou_report"]);
  assert.match(sent[0].markdown, /预览/);
  assert.match(sent[1].markdown, /发送日志一览/);
  assert.equal(report.results[0].ownerName, "Alice");
});

test("runReminder scheduled mode continues after recipient failure and always sends the log", async () => {
  const sent = [];
  const api = {
    listAllRecords: async () => [
      record({
        场景名称: "智能排班",
        落地进展: "进行中",
        AI对接人: [{ id: "ou_alice", name: "Alice" }],
      }),
      record({
        场景名称: "知识助手",
        落地进展: "待启动",
        AI对接人: [{ id: "ou_bob", name: "Bob" }],
      }, "rec_2"),
    ],
    sendMarkdown: async (message) => {
      sent.push(message);
      if (message.receiveId === "ou_alice") throw new Error("temporary failure");
      return { messageId: `om_${sent.length}` };
    },
  };

  const report = await runReminder({
    api,
    mode: "scheduled",
    reportUserOpenId: "ou_report",
    allowedStatuses,
    baseUrl: "https://example.com/base",
    now: () => new Date("2026-07-20T01:05:00.000Z"),
  });

  assert.deepEqual(sent.map(({ receiveId }) => receiveId), ["ou_alice", "ou_bob", "ou_report"]);
  assert.equal(report.results.filter(({ ok }) => ok).length, 1);
  assert.equal(report.results.filter(({ ok }) => !ok).length, 1);
  assert.equal(report.logDelivery.ok, true);
});

test("runReminder sends a zero-result log but no reminder when nothing matches", async () => {
  const sent = [];
  const api = {
    listAllRecords: async () => [],
    sendMarkdown: async (message) => {
      sent.push(message);
      return { messageId: "om_log" };
    },
  };

  const report = await runReminder({
    api,
    mode: "scheduled",
    reportUserOpenId: "ou_report",
    allowedStatuses,
    baseUrl: "https://example.com/base",
  });

  assert.equal(sent.length, 1);
  assert.equal(sent[0].receiveId, "ou_report");
  assert.equal(report.matchedRecordCount, 0);
});
