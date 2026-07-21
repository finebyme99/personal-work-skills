# AI Land 项目路由

仅当当前项目是 AI Land，并且任务涉及批量飞书消息、群成员逐人私发、多主体/跨租户、正式发送恢复与重试，或修改这些能力时，使用本路由。其他 AI Land 任务到此停止，不加载消息推送详细文档。

按以下顺序读取项目内的当前事实源：

1. `AGENTS.md` 的“消息运营红线”；
2. `docs/message-push-operation-system.md` 的完整批量推送标准；
3. `docs/operator-runbook.md` 的“消息运营预览与受控正式发送”；
4. 当前页面、API、审计和发送实现。

项目文档和代码高于本地 Skill。不要在本参考中复制应用、接口、活动状态或部署事实；项目变化后只更新项目文档。

如果项目内没有 `docs/message-push-operation-system.md`，使用 `SKILL.md` 的通用流程并保持正式发送阻断，不根据历史会话、旧 ID 或本参考猜测当前能力。
