import { createHash } from "node:crypto";

const API_ROOT = "https://open.feishu.cn/open-apis";
const SELECT_FIELDS = ["场景名称", "落地进展", "计划试点日期", "进展备注", "AI对接人"];

function apiError(action, response, body) {
  const code = body?.code ?? response.status;
  const message = body?.msg ?? `HTTP ${response.status}`;
  return new Error(`${action}失败（${code}）：${message}`);
}

function uuidFor(key) {
  return `aipr-${createHash("sha256").update(key, "utf8").digest("hex").slice(0, 32)}`;
}

export class FeishuApi {
  constructor({ appId, appSecret, baseToken, tableId, viewId, fetch = globalThis.fetch }) {
    this.appId = appId;
    this.appSecret = appSecret;
    this.baseToken = baseToken;
    this.tableId = tableId;
    this.viewId = viewId;
    this.fetch = fetch;
    this.tenantToken = null;
  }

  async getTenantToken() {
    if (this.tenantToken) return this.tenantToken;
    const response = await this.fetch(`${API_ROOT}/auth/v3/tenant_access_token/internal`, {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ app_id: this.appId, app_secret: this.appSecret }),
    });
    const body = await response.json();
    if (!response.ok || body.code !== 0 || !body.tenant_access_token) {
      throw apiError("获取 tenant_access_token", response, body);
    }
    this.tenantToken = body.tenant_access_token;
    return this.tenantToken;
  }

  async authorizedJson(url, options = {}, action) {
    const token = await this.getTenantToken();
    const response = await this.fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "content-type": "application/json; charset=utf-8",
        ...options.headers,
      },
    });
    let body;
    try {
      body = await response.json();
    } catch {
      throw new Error(`${action}失败（HTTP ${response.status}）：响应不是 JSON`);
    }
    if (!response.ok || body.code !== 0) throw apiError(action, response, body);
    return body;
  }

  async listAllRecords() {
    const records = [];
    let pageToken = "";
    do {
      const url = new URL(`${API_ROOT}/bitable/v1/apps/${encodeURIComponent(this.baseToken)}/tables/${encodeURIComponent(this.tableId)}/records`);
      url.searchParams.set("page_size", "100");
      url.searchParams.set("user_id_type", "open_id");
      url.searchParams.set("field_names", JSON.stringify(SELECT_FIELDS));
      if (this.viewId) url.searchParams.set("view_id", this.viewId);
      if (pageToken) url.searchParams.set("page_token", pageToken);

      const body = await this.authorizedJson(url, {}, "读取多维表记录");
      const data = body.data ?? {};
      records.push(...(data.items ?? []));
      if (data.has_more && !data.page_token) throw new Error("读取多维表记录失败：分页响应缺少 page_token");
      pageToken = data.has_more ? data.page_token : "";
    } while (pageToken);
    return records;
  }

  async sendMarkdown({ receiveId, markdown, idempotencyKey }) {
    const content = JSON.stringify({ zh_cn: { content: [[{ tag: "md", text: markdown }]] } });
    if (Buffer.byteLength(content, "utf8") > 30 * 1024) {
      throw new Error("消息超过飞书富文本 30 KB 限制，已停止发送");
    }
    const url = new URL(`${API_ROOT}/im/v1/messages`);
    url.searchParams.set("receive_id_type", "open_id");
    const body = await this.authorizedJson(url, {
      method: "POST",
      body: JSON.stringify({
        receive_id: receiveId,
        msg_type: "post",
        content,
        uuid: uuidFor(idempotencyKey),
      }),
    }, "发送飞书消息");
    return { messageId: body.data?.message_id ?? "" };
  }
}
