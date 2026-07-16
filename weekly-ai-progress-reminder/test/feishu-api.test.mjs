import assert from "node:assert/strict";
import test from "node:test";

import { FeishuApi } from "../src/feishu-api.mjs";

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("FeishuApi obtains a tenant token and reads every record page", async () => {
  const calls = [];
  const fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).includes("tenant_access_token")) {
      return jsonResponse({ code: 0, tenant_access_token: "tenant-secret" });
    }
    if (String(url).includes("page_token=next-page")) {
      return jsonResponse({ code: 0, data: { has_more: false, items: [{ record_id: "rec_2", fields: {} }] } });
    }
    return jsonResponse({
      code: 0,
      data: {
        has_more: true,
        page_token: "next-page",
        items: [{ record_id: "rec_1", fields: {} }],
      },
    });
  };
  const api = new FeishuApi({
    appId: "cli_test",
    appSecret: "app-secret",
    baseToken: "base-token",
    tableId: "table-id",
    viewId: "view-id",
    fetch,
  });

  const records = await api.listAllRecords();

  assert.deepEqual(records.map(({ record_id }) => record_id), ["rec_1", "rec_2"]);
  assert.equal(calls.filter(({ url }) => url.includes("/records?")).length, 2);
  assert.match(calls[1].url, /view_id=view-id/);
  assert.match(calls[2].url, /page_token=next-page/);
  assert.equal(calls[1].options.headers.Authorization, "Bearer tenant-secret");
});

test("FeishuApi sends markdown as a post with a bounded deterministic uuid", async () => {
  const calls = [];
  const fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).includes("tenant_access_token")) {
      return jsonResponse({ code: 0, tenant_access_token: "tenant-secret" });
    }
    return jsonResponse({ code: 0, data: { message_id: "om_123" } });
  };
  const api = new FeishuApi({
    appId: "cli_test",
    appSecret: "app-secret",
    baseToken: "base-token",
    tableId: "table-id",
    viewId: "view-id",
    fetch,
  });

  const result = await api.sendMarkdown({
    receiveId: "ou_alice",
    markdown: "**hello**",
    idempotencyKey: "2026-07-20:ou_alice:reminder",
  });

  assert.equal(result.messageId, "om_123");
  const request = calls.at(-1);
  const body = JSON.parse(request.options.body);
  assert.equal(body.receive_id, "ou_alice");
  assert.equal(body.msg_type, "post");
  assert.ok(body.uuid.length <= 50);
  assert.equal(JSON.parse(body.content).zh_cn.content[0][0].tag, "md");
});

test("FeishuApi surfaces API errors without including access tokens", async () => {
  const fetch = async (url) => {
    if (String(url).includes("tenant_access_token")) {
      return jsonResponse({ code: 0, tenant_access_token: "tenant-secret" });
    }
    return jsonResponse({ code: 99991672, msg: "access denied" });
  };
  const api = new FeishuApi({
    appId: "cli_test",
    appSecret: "app-secret",
    baseToken: "base-token",
    tableId: "table-id",
    viewId: "view-id",
    fetch,
  });

  await assert.rejects(api.listAllRecords(), (error) => {
    assert.match(error.message, /access denied/);
    assert.doesNotMatch(error.message, /tenant-secret|app-secret/);
    return true;
  });
});
