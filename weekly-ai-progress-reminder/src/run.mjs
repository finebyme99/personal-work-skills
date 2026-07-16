import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { runReminder } from "./core.mjs";
import { ALLOWED_STATUSES } from "./config.mjs";
import { FeishuApi } from "./feishu-api.mjs";

const BASE_URL = "https://ztn.feishu.cn/wiki/LRROwulJciI7JYkIT55cQtdpnze?table=tbl9WJyxl9bbtYjb&view=vew4ExW5tl";
const BASE_TOKEN = "Hc6DbL3Wia2ejMsQn7TcE9g2njc";
const TABLE_ID = "tbl9WJyxl9bbtYjb";

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`缺少环境变量 ${name}`);
  return value;
}

function parseMode() {
  const mode = process.env.RUN_MODE?.trim() || "preview";
  if (!new Set(["preview", "scheduled"]).has(mode)) throw new Error(`RUN_MODE 无效：${mode}`);
  if (mode === "scheduled" && process.env.WEEKLY_AI_PROGRESS_ENABLED !== "true") {
    return { mode, skipped: true, reason: "WEEKLY_AI_PROGRESS_ENABLED 不是 true" };
  }
  if (mode === "scheduled" && process.env.GITHUB_EVENT_NAME === "workflow_dispatch"
      && process.env.CONFIRM_BROADCAST !== "true") {
    throw new Error("手动正式发送必须勾选确认开关");
  }
  return { mode, skipped: false };
}

const currentDir = dirname(fileURLToPath(import.meta.url));
const reportPath = resolve(process.env.REPORT_PATH || `${currentDir}/../artifacts/send-report.json`);
let report;

try {
  const { mode, skipped, reason } = parseMode();
  if (skipped) {
    report = { ok: true, skipped: true, mode, reason, createdAt: new Date().toISOString() };
  } else {
    const api = new FeishuApi({
      appId: required("FEISHU_APP_ID"),
      appSecret: required("FEISHU_APP_SECRET"),
      baseToken: BASE_TOKEN,
      tableId: TABLE_ID,
    });
    report = await runReminder({
      api,
      mode,
      reportUserOpenId: required("FEISHU_REPORT_USER_OPEN_ID"),
      allowedStatuses: ALLOWED_STATUSES,
      baseUrl: BASE_URL,
    });
  }
} catch (error) {
  report = {
    ok: false,
    fatalError: error instanceof Error ? error.message : String(error),
    createdAt: new Date().toISOString(),
  };
}

await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
console.log(report.skipped ? `Skipped: ${report.reason}` : `Run completed: ok=${report.ok}`);
if (!report.ok) process.exitCode = 1;
