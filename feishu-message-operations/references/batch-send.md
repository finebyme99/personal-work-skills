# 批量发送、跨主体与结果核对

接口字段依据本次 2026-09-03 使用的官方文档；执行时以当前官方文档和 CLI 帮助为准。示例使用占位符，不能直接运行成真实发送。

## 1. 选择主体与权限

先用选定应用的 tenant token 查询：

```text
GET /open-apis/application/v6/scopes
```

此查询本身不要求额外 scope；读取 `data.scopes[]` 的 `scope_name` 与 `grant_status`，1 是已授权，2 是未授权。缺项不能当作已授权。用户说“开了”后重新查询生效状态，不反复去后台找按钮。

| 操作 | 必需权限/条件 |
|---|---|
| 普通机器人消息 | `im:message` 或 `im:message:send_as_bot`，机器人启用及目标可达 |
| 按人员批量发送 | 上述发送权限之一，另加 `im:message:send_multi_users` |
| 按部门批量发送 | 上述发送权限之一，另加 `im:message:send_multi_depts` |
| 批量进度查询 | 两个批量权限之一，且必须是原发送应用 |
| 创建 CardKit 卡片实体 | `cardkit:card:write`，仅在确实需要创建实体时 |
| 应用可用范围诊断 | 见下文可选诊断，不是批量发送的额外前置权限 |

每个应用分别核查。bot 权限不足不能靠 user 重新登录解决。原生 JSON 或模板直接发消息不要求先创建 CardKit 实体，不要把缺少 `cardkit:card:write` 当作发送阻断。

## 2. 冻结完整名单

- 使用各发送应用的认证查询/解析对应人员 ID，并记录 ID 的来源应用、租户、采集时间。不要把同一份其他应用 open_id 名单复制给所有发送应用。
- 若群成员接口提供 tenant_key，按实际发送租户筛选；未提供时通过已有可信身份映射核实，不从名字或 ID 字符串猜租户。
- 本次 CLI 可用方式：`lark-cli --profile APP im +chat-members-list --as bot --chat-id CHAT --page-all --page-limit 0 --format json`。运行前看当前帮助及输出结构；默认分页上限可能截断数据。
- 核实所有分页已读完（has_more=false / 无下一页），排除机器人，按同一应用内稳定 ID 去重。群人数统计 -1 可能为隐藏值，不替代分页完整性判断。
- 冻结最终名单，记录每个主体人数与未覆盖人员；不要把“已枚举群全员”说成“所有人对机器人可见”。
- 部门批量会覆盖子部门成员，不能将部门 ID 数当作人数；根部门 0 不支持。若必须精确审批到人或避免部门重叠，先解析为去重人员列表再发送。

## 3. 正确构造请求

```text
POST https://open.feishu.cn/open-apis/message/v4/batch_send/
Authorization: Bearer <tenant_access_token>
Content-Type: application/json; charset=utf-8
```

仅支持用户/部门，不能填 chat_id。open_ids、user_ids、union_ids、department_ids 每个列表最多 200 项；通常只使用一种人员 ID 列表，按应用切成不超过 200 人的批次，避免跨字段重复覆盖。

卡片示意（CARD_JSON 替换为实际对象）：

```text
{"msg_type":"interactive","open_ids":["<same-app-open-id>"],"card":CARD_JSON}
```

模板对象：

```json
{
  "type": "template",
  "data": {
    "template_id": "<template-id>",
    "template_version_name": "<published-version>",
    "template_variable": {}
  }
}
```

批量文本示意：

```json
{"msg_type":"text","open_ids":["<same-app-open-id>"],"content":{"text":"已确认的完整正文"}}
```

关键差异：

- 批量 interactive 放 `card` **对象**；text/image/post/share_chat 放 `content` **对象**，不要 JSON 字符串化。
- 普通 `POST /im/v1/messages` 的 `content` 则是 JSON **字符串**，不能照搬批量结构。
- 卡片/富文本请求体上限 30 KB，文本 150 KB；模板大小含展开内容，不能只看模板封装大小。批量富文本不支持 md 标签。
- 批量异步处理；单应用日上限 50 万条。按实际频控执行，不无限并发。

CLI 没有对应封装时，可通过原生接口调用：

```text
lark-cli --profile APP api POST /open-apis/message/v4/batch_send/ --as bot --data - --format json
```

从 stdin 传入已冻结请求 JSON；程序用 subprocess 参数数组传递，避免 shell 对反引号、$()、引号进行解释。`--data @file` 注意 CLI 的路径约束，先看帮助。不要在调试命令中暴露 token。

## 4. 审计、响应与幂等

发送前持久化：活动 ID、用户授权依据、应用/租户、内容指纹及版本、本人预览回执（有则记录）、最终名单、请求分批、各批本地键和时间。按“活动 + 内容 + 应用/租户 + 目标”关联记录。用数据库唯一约束或独占创建的请求日志防止并发重复执行；更新日志用原子替换。不要复制仅靠 exists() 后 write_text() 的竞态实现。

| 状态 | 证据与处理 |
|---|---|
| prepared / deferred | 尚未提交，或缺权限等暂留 |
| started / unknown | 已进入调用但无可靠结果；先核对，禁止自动重发 |
| rejected / invalid | 有明确拒绝或 invalid_* 证据；保留原因和具体对象 |
| accepted | 已取得 bm- 任务 ID；仍需查进度 |
| partially_confirmed | 聚合进度确认部分成功，剩余身份与结果待核对 |
| delivered_all | 进度确认覆盖该批全部有效去重目标，不能凭稳定不变推断 |

响应解析必须分清包装：

- 原生 HTTP：检查业务 `code == 0` 且有 `data.message_id`，不能只看 HTTP 200。
- 当前 lark-cli 成功可包装为 `ok:true, identity:"bot", data:{...}`，不要因为缺少 code 误判失败。同时检查进程退出码和 stderr 错误 JSON。
- 返回 `bm-…` 意味着受理；`invalid_*_ids` 可与正常受理同时出现。只把明确列出的对象标 invalid，其余绑定该任务，不能标逐人已送达。
- HTTP 5xx、超时、断网、进程中断、响应解析失败或缺少任务 ID，保留 unknown。不是所有非零码都能证明完全没有送出；仅对含义明确的权限/参数/内容拒绝按证据修复。
- 批量接口没有文档化的请求 UUID 幂等字段。本地键只能阻止本地重复提交，不能保证飞书去重。不要为“保险”重发已受理或未知批次。
- 普通消息支持 UUID 幂等（当前约一小时窗口）；以当前接口文档为准，不能把这个保证套到批量接口或无限期重试。

## 5. 查询进度与报告

```text
GET /open-apis/im/v1/batch_messages/<bm-id>/get_progress
```

使用原发送应用；仅支持 30 天内批量任务。读取 `data.batch_message_send_progress`：

- `valid_user_ids_count`：有效人数，包含对机器人不可见的用户；异步尚未调度时可能为 0。
- `success_user_ids_count`：已确认发送成功人数，最终不一定等于 valid。
- `read_user_ids_count`：接口附带已读人数；本次任务未要求时不另做已读运营。

该接口是快照，**没有 finished 标志，也没有逐人失败名单**。短期内计数不变不证明结束；“目标数减成功数”只是待核对人数，不能推断出具体失败对象或按名单顺序补发。

可有界退避查询，例如 10、20、40、60 秒，持续几分钟；遵守工具等待限制并保持必要沟通。记录每次查询时间及进度。计数仍增长就继续合理等待；稳定且不足时报告当前部分成功与剩余待核对，不宣称失败或全部完成。

若单一 ID 类型去重后的有效目标数与 valid 一致，且 success 已覆盖全部有效目标，可确认该批有效目标全部成功；仍只保存 bm 映射，不编造逐人 om 回执。人数为缺失/null 时写未知，不能转成 0。

示例：195 人受理，查询成功数依次为 76、150、170，之后稳定。可报告“截至查询时确认 170 人，25 人待核对”；不能把 25 人写成已知失败并重发整批。

## 6. 可选范围诊断

需要定位不可用范围，且已有权限时可查询：

```text
POST /open-apis/application/v6/applications/<app-id>/visibility/check_white_black_list?user_id_type=open_id
{"user_ids":["<same-app-open-id>"]}
```

单次最多 100 个；需要 `application:application:self_manage` 或 `admin:app.info:readonly`。没有这些权限，只说明此诊断暂不可用，不等于不能发送；未经授权不要自动扩大权限。即使查出不可见用户，也应与原任务证据结合，不能把它直接充当该批逐人发送回执。

## 官方依据

- [批量发送消息](https://open.feishu.cn/document/server-docs/im-v1/batch_message/send-messages-in-batches)
- [查询批量消息整体进度](https://open.feishu.cn/document/server-docs/im-v1/batch_message/get_progress)
- [查询租户授权状态](https://open.feishu.cn/document/application-v6/scope/list)
- [检查应用可用范围](https://open.feishu.cn/document/server-docs/application-v6/admin/check_white_black_list)
