# 卡片源文件复用、跨主体与本人预览

## 选择模板还是原生 JSON

模板可见且版本已发布时，固定 template_id、template_version_name 和变量，按用户要求发送。应用 A 能调用不代表应用 B 能调用；跨主体无法授权某个模板的观察也不证明飞书所有模板永远不能跨主体使用。

模板失败先保留完整错误码、子码和日志 ID：

| 证据 | 处理 |
|---|---|
| 11246，仅有 create content/card error | 泛化内容创建错误；不能单凭它断言模板权限问题 |
| 200380 | 检查模板是否存在、保存并发布，以及指定版本 |
| 200381 | 检查实际发送应用是否有模板使用权限 |
| 200621 | 检查 JSON 结构 |
| 200732 | 核对模板变量值与声明类型 |
| 200570 / 图片 key 无效 | 核查图片资源，按下述流程处理 |
| 100290 / 无效人员资源 | 核对卡片内人员/at ID 的应用口径；收件人正确不代表卡片内 ID 正确 |

不要为了检查模板调用先创建 CardKit 实体。`POST /cardkit/v1/cards` 的 `cardkit:card:write` 是另一条能力；直接发送 JSON/模板不以它为前置条件。不要反复拿正式收件人测错误，也不要擅自发布或修改原模板。

用户提供可复用源文件且同意用独立卡片时，优先提取原生 JSON。这样解除模板 ID 依赖，但图片、人员资源、按钮跳转及回调仍需各自检查。

## .card 原样转换

先检查实际格式；本次成功文件是 UTF-8 JSON：

```json
{"name":"通知","dsl":{"schema":"2.0","body":{"elements":[]}},"variables":[]}
```

其中 dsl 才是原生卡片，不是 ZIP、海报图片，也不是发送消息的外层请求。不要将 name/dsl/variables 包装直接发给消息接口。

使用技能自带的离线工具（路径相对技能目录）：

```text
python3 scripts/prepare_card.py /absolute/path/source.card --out-dir /absolute/path/work/card-prepared
```

输出目录必须不存在，防止覆盖已确认内容。工具输出：

- `card.json`：与源 dsl（或输入原生 JSON）结构相同的卡片。
- `manifest.json`：源文件与卡片 SHA-256、schema、图片 key、结构化链接、按钮、变量声明及疑似占位符位置。

变量非空或检测到常见占位符时，仍保留原样草稿，但退出码为 2，manifest 标记 `requires_binding_review=true`。先核实实际绑定数据和类型；不得静默删掉变量或随意取默认值。工具不做模板渲染，不能拿未绑定草稿直接群发。占位符检测是启发式，false 不证明没有其他表达式。

原样复用要求：

- 保留 schema、header、body、config、数组顺序、正文、链接、图片 key、图标、按钮、间距和所有未识别字段。不能加“测试”标题、套品牌风格、擅自改宽度或降级 schema 2.0。
- JSON 重新缩进不影响结构；以解析后结构相等验证，不靠截图猜配置。稳定指纹算法为 UTF-8 编码的 `json.dumps(card, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False)` 的 SHA-256。
- 不把源文件原始字节指纹与卡片结构指纹混用。预览和正式发送须对应同一最终卡片结构；模板形式则另绑定固定版本和变量。
- 结构与样式相同不保证不同客户端像素完全一致；应在飞书本人预览检查实际显示。按钮 URL 保留不代表跨主体收件人有打开目标页面的权限；有跨主体页面授权需求时单独核实，不能擅改链接或页面权限。
- callback 按钮可能依赖原应用事件回调；独立 JSON 只复制定义，不迁移回调服务。存在回调时核实目标应用接收和处理能力，不能将外观一致声称为交互功能已验证。

## 图片处理

源文件中的 img_key 只是资源引用，不是图片字节。本次原 key 在另一主体原生 JSON 发送中成功，是可复用的观察，不能推广为所有图片永久跨应用可用。

先在已授权测试范围内尝试原始资源，不提前重画海报或替换成整张截图。若明确出现图片资源无效/无权限：

1. 从用户提供的原图或授权资源读取接口取得原始图片。
2. 使用实际目标应用上传原图，取得新 key。
3. 只替换对应图片资源 key，记录修改前后指纹，再核对本人预览及已有授权范围。
4. 无法取得原始图片时，说明缺少原图并向用户索取，不能生成“差不多”的图片充当原件。

源 JSON 转换不需要图像生成工具。不要把某应用预览成功说成其他应用图片权限验证通过。

## 发给本人预览

1. 选择应用后，从经验证的当前登录态取得本人身份。当前 CLI 可用 `lark-cli --profile APP auth status --json --verify`；检查实际输出的用户 openId 和验证状态，不只看缓存姓名。
2. 使用普通消息接口，`msg_type=interactive`，content 为原生卡片 JSON 的字符串：
   `lark-cli --profile APP im +messages-send --as bot --user-id VERIFIED_SELF_ID --msg-type interactive --content CARD_JSON_STRING --idempotency-key UUID`。先核对当前帮助；程序用参数数组传值。
3. 记录成功回执、发送应用、本人 ID、最终内容指纹和时间。若使用模板，还记录固定模板版本与变量。
4. 将预览所在应用告知用户，等待其要求的视觉核对。若本人只能在源主体接收测试，可先完成该预览，但说明未验证目标主体可用性。
5. 用户确认后，继续既定主体和受众范围。新内容、扩大范围或新主体未被批准时才补问；已批准的原样卡片不重复索取同一确认。

## 官方依据

- [管理卡片模板权限](https://open.feishu.cn/document/uAjLw4CM/ukzMukzMukzM/feishu-cards/feishu-card-cardkit/manage-card-template)
- [发送卡片](https://open.feishu.cn/document/uAjLw4CM/ukzMukzMukzM/feishu-cards/send-feishu-card)
- [创建卡片实体](https://open.feishu.cn/document/cardkit-v1/card/create)
- [批量发送错误与子错误码](https://open.feishu.cn/document/server-docs/im-v1/batch_message/send-messages-in-batches)
