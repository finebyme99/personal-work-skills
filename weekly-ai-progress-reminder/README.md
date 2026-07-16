# AI 对接人每周进展提醒

每周一 09:05（Asia/Shanghai）读取指定飞书多维表的整张数据表（链接中的 view 仅用于打开页面，不限制读取范围），筛选以下“落地进展”且“AI对接人”不为空的记录：

- 待启动
- 进行中

每位 AI 对接人收到一条汇总消息。每条场景都附有“打开这条记录更新”链接，点击后会在“心愿排名全景”视图中直接打开对应记录的详情页，使用该视图自定义的字段布局。运行结束后，日志接收人会收到一条“发送日志一览”；同一份结构化报告还会作为私有 GitHub Actions artifact 保存 90 天。

## 安全门

- 手动运行默认是 `preview`，只向 `FEISHU_REPORT_USER_OPEN_ID` 发一条提醒预览和一条发送日志。
- `scheduled` 只有在仓库变量 `WEEKLY_AI_PROGRESS_ENABLED=true` 时才发送。
- 手动选择 `scheduled` 时，还必须勾选 `confirm_broadcast`。
- 同一时间只允许一个运行实例；飞书消息使用幂等 UUID，降低短时间重跑造成的重复发送风险。

## GitHub 配置

Repository secrets：

- `FEISHU_APP_ID`
- `FEISHU_APP_SECRET`
- `FEISHU_REPORT_USER_OPEN_ID`

Repository variable：

- `WEEKLY_AI_PROGRESS_ENABLED`：首次部署保持 `false`；应用权限和本人预览验证成功后再改为 `true`。

飞书应用需要开启机器人能力、覆盖所有收件人，并至少具备：

- `base:record:read`
- `im:message:send_as_bot` 或 `im:message`

应用还需要被授予目标多维表的访问权限。人员字段返回的 open_id 与应用绑定，因此读取和发送必须使用同一个飞书应用。
