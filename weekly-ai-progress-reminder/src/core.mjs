import { createHash } from "node:crypto";

export const DEFAULT_TIME_ZONE = "Asia/Shanghai";

function textValue(value) {
  if (value === null || value === undefined || value === "") return "未填写";
  if (Array.isArray(value)) {
    const values = value.map(textValue).filter((item) => item !== "未填写");
    return values.length ? values.join("、") : "未填写";
  }
  if (typeof value === "object") {
    return textValue(value.text ?? value.name ?? value.value ?? value.link ?? "");
  }
  const text = String(value).trim();
  return text || "未填写";
}

function ownerId(owner) {
  if (!owner || typeof owner !== "object") return "";
  return owner.open_id ?? owner.id ?? owner.user_id ?? "";
}

function ownerName(owner) {
  return textValue(owner?.name ?? owner?.en_name ?? "未知对接人");
}

function statusIsAllowed(status, allowedStatuses) {
  const statuses = Array.isArray(status) ? status : [status];
  return statuses.some((item) => allowedStatuses.has(String(item ?? "").trim()));
}

export function filterAndGroupRecords(records, allowedStatuses) {
  const groups = new Map();
  const matchedRecordIds = new Set();

  for (const record of records) {
    const fields = record?.fields ?? {};
    const owners = Array.isArray(fields.AI对接人) ? fields.AI对接人 : [];
    if (!statusIsAllowed(fields.落地进展, allowedStatuses) || owners.length === 0) continue;

    let hasValidOwner = false;
    for (const owner of owners) {
      const id = ownerId(owner);
      if (!id) continue;
      hasValidOwner = true;
      if (!groups.has(id)) {
        groups.set(id, { ownerId: id, ownerName: ownerName(owner), records: [] });
      }
      groups.get(id).records.push(record);
    }
    if (hasValidOwner) matchedRecordIds.add(record.record_id ?? record);
  }

  return { groups, matchedRecordCount: matchedRecordIds.size };
}

export function formatDate(value, timeZone = DEFAULT_TIME_ZONE) {
  if (value === null || value === undefined || value === "") return "未填写";
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const date = new Date(typeof raw === "object" ? raw.value ?? raw.timestamp ?? raw.text : raw);
  if (Number.isNaN(date.getTime())) return textValue(raw);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function safeLine(value) {
  return textValue(value).replace(/[\r\n]+/g, " ").trim();
}

export function buildReminderMarkdown({ ownerName: name, records, baseUrl, timeZone = DEFAULT_TIME_ZONE, preview = false }) {
  const lines = [];
  if (preview) lines.push(`> 预览：以下为原计划发送给 ${safeLine(name)} 的消息，仅发送给日志接收人。`, "");
  lines.push("请在今天更新你负责场景的 **落地进展**、**预计试点上线日期** 和 **进展备注**。", "");

  for (const record of records) {
    const fields = record?.fields ?? {};
    lines.push(
      `### ${safeLine(fields.场景名称)}`,
      `- 落地进展：${safeLine(fields.落地进展)}`,
      `- 预计试点上线日期：${formatDate(fields.计划试点日期, timeZone)}`,
      `- 进展备注：${safeLine(fields.进展备注)}`,
      "",
    );
  }

  lines.push(`[打开多维表更新](${baseUrl})`);
  return lines.join("\n");
}

function localDateTime(iso, timeZone) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return String(iso);
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

export function sanitizeError(error) {
  const raw = error instanceof Error ? error.message : String(error ?? "未知错误");
  return raw
    .replace(/(?:t|u)-[A-Za-z0-9_-]+/g, "[token已隐藏]")
    .replace(/ou_[A-Za-z0-9]+/g, "[用户ID已隐藏]")
    .replace(/\s+/g, " ")
    .slice(0, 180);
}

export function buildLogMarkdown({
  mode,
  startedAt,
  finishedAt,
  matchedRecordCount,
  recipientCount,
  results = [],
  sourceError,
  timeZone = DEFAULT_TIME_ZONE,
}) {
  const successCount = results.filter(({ ok }) => ok).length;
  const failureCount = results.filter(({ ok }) => !ok).length + (sourceError ? 1 : 0);
  const modeLabel = mode === "preview" ? "仅发本人预览" : "正式周提醒";
  const lines = [
    "## AI 场景周提醒｜发送日志一览",
    "",
    `- 运行模式：${modeLabel}`,
    `- 开始时间：${localDateTime(startedAt, timeZone)}`,
    `- 结束时间：${localDateTime(finishedAt, timeZone)}`,
    `- 命中记录：${matchedRecordCount}`,
    `- 应提醒对接人：${recipientCount}`,
    `- 成功：${successCount}`,
    `- 失败：${failureCount}`,
  ];

  if (sourceError) lines.push("", `- 数据读取失败：${sanitizeError(sourceError)}`);
  if (results.length) {
    lines.push("", "### 发送明细");
    for (const result of results) {
      const outcome = result.ok ? "发送成功" : `发送失败（${sanitizeError(result.error)}）`;
      lines.push(`- ${safeLine(result.ownerName)}：${result.sceneCount} 个场景，${outcome}`);
    }
  } else if (!sourceError) {
    lines.push("", "本次没有符合条件的记录，未发送对接人提醒。");
  }
  return lines.join("\n");
}

function dateKey(date, timeZone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date).replaceAll("-", "");
}

function stableKey(...parts) {
  return createHash("sha256").update(parts.join(":"), "utf8").digest("hex").slice(0, 24);
}

export async function runReminder({
  api,
  mode,
  reportUserOpenId,
  allowedStatuses,
  baseUrl,
  timeZone = DEFAULT_TIME_ZONE,
  now = () => new Date(),
}) {
  if (!new Set(["preview", "scheduled"]).has(mode)) throw new Error(`不支持的运行模式：${mode}`);
  if (!reportUserOpenId) throw new Error("缺少日志接收人的 open_id");

  const started = now();
  const startedAt = started.toISOString();
  const report = {
    mode,
    startedAt,
    finishedAt: startedAt,
    matchedRecordCount: 0,
    recipientCount: 0,
    results: [],
    logDelivery: { ok: false },
    ok: false,
  };

  try {
    const records = await api.listAllRecords();
    const grouped = filterAndGroupRecords(records, allowedStatuses);
    report.matchedRecordCount = grouped.matchedRecordCount;
    report.recipientCount = grouped.groups.size;
    const groups = [...grouped.groups.values()];
    const targets = mode === "preview"
      ? [groups.find(({ ownerId: id }) => id === reportUserOpenId) ?? groups[0]].filter(Boolean)
      : groups;

    for (const group of targets) {
      const receiveId = mode === "preview" ? reportUserOpenId : group.ownerId;
      const markdown = buildReminderMarkdown({
        ownerName: group.ownerName,
        records: group.records,
        baseUrl,
        timeZone,
        preview: mode === "preview",
      });
      try {
        const delivery = await api.sendMarkdown({
          receiveId,
          markdown,
          idempotencyKey: `${dateKey(started, timeZone)}:${mode}:${group.ownerId}:reminder`,
        });
        report.results.push({
          ownerName: group.ownerName,
          sceneCount: group.records.length,
          ok: true,
          messageId: delivery.messageId,
        });
      } catch (error) {
        report.results.push({
          ownerName: group.ownerName,
          sceneCount: group.records.length,
          ok: false,
          error: sanitizeError(error),
        });
      }
    }
  } catch (error) {
    report.sourceError = sanitizeError(error);
  }

  report.finishedAt = now().toISOString();
  const logMarkdown = buildLogMarkdown({ ...report, timeZone });
  try {
    const delivery = await api.sendMarkdown({
      receiveId: reportUserOpenId,
      markdown: logMarkdown,
      idempotencyKey: `${dateKey(started, timeZone)}:${mode}:log:${stableKey(startedAt, JSON.stringify(report.results))}`,
    });
    report.logDelivery = { ok: true, messageId: delivery.messageId };
  } catch (error) {
    report.logDelivery = { ok: false, error: sanitizeError(error) };
  }

  report.ok = !report.sourceError
    && report.results.every(({ ok }) => ok)
    && report.logDelivery.ok;
  return report;
}
