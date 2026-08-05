---
name: screenshot-path-daemon
description: macOS 后台守护进程，自动将剪贴板中的截图保存到本地并支持 Opt+V 粘贴文件路径。适用于飞书/微信等截图工具只存剪贴板不落盘的场景。当用户需要"截图后直接粘贴路径"时使用。
---

# Screenshot Path Daemon

macOS 剪贴板截图自动落盘 + 快捷键粘贴路径的完整方案。解决飞书、微信等截图工具只存剪贴板不保存文件的问题。

## 核心思路

截图工具（飞书/微信/系统截图）将图片放入系统剪贴板后，本守护进程：

1. 每 200ms 轮询 `NSPasteboard.general.changeCount`
2. 检测到新图片 → 自动保存 PNG 到 `~/Pictures/Screenshots/`
3. 路径写入 named pasteboard + 内存变量
4. 用户按 Opt+V → CGEvent tap 拦截按键 → 路径写入系统剪贴板 → 模拟 Cmd+V 粘贴

Cmd+V 粘贴图片本身，Opt+V 粘贴文件路径，互不干扰。

## 技术要点

### 为什么不监听文件夹

飞书截图默认只存剪贴板，不会落盘到任何目录。`~/Library/Application Support/LarkShell/screenshot/` 里的文件是用户手动保存的。因此监听目录变化的方案（launchd WatchPaths / fswatch）根本不可行。

### 为什么用 CGEvent tap 而不是 NSEvent.addGlobalMonitorForEvents

`addGlobalMonitorForEvents` 只能观察事件，不能拦截。按键会穿透到前台应用（Opt+V 在 macOS 默认输入 "√"）。必须用 `CGEvent.tapCreate` 才能拦截并吞掉按键事件。

### 为什么不用 named pasteboard 作为唯一存储

named pasteboard 在系统重启后会丢失。内存变量 + named pasteboard + 文件三重存储保证可靠性。

### 权限要求

CGEvent tap 需要辅助功能权限：系统设置 → 隐私与安全性 → 辅助功能 → 添加 `~/bin/screenshot-path-daemon`。

## 部署步骤

1. 编译 Swift 源码（见 `references/screenshot-path-daemon.swift`）
2. 二进制放到 `~/bin/screenshot-path-daemon`
3. LaunchAgent plist 放到 `~/Library/LaunchAgents/com.user.screenshot-path-daemon.plist`
4. `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.user.screenshot-path-daemon.plist`
5. 在系统设置中授予辅助功能权限
6. 重启服务：`launchctl kickstart gui/$(id -u)/com.user.screenshot-path-daemon`

## 资源占用

200ms 轮询只读一个整数（changeCount），无磁盘 IO / 网络请求 / 图片处理。CPU 占用约 0%，对电池无可感知影响。与 Paste、Maccy 等剪贴板管理工具相同的轮询模式。

## 文件清单

| 文件 | 用途 |
|------|------|
| `~/bin/screenshot-path-daemon` | 编译后的守护进程 |
| `~/Library/LaunchAgents/com.user.screenshot-path-daemon.plist` | launchd 服务定义 |
| `~/Pictures/Screenshots/` | 截图保存目录 |
| `/tmp/screenshot-path-daemon.log` | 运行日志 |

## 卸载

```bash
launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.user.screenshot-path-daemon.plist
rm ~/Library/LaunchAgents/com.user.screenshot-path-daemon.plist
rm ~/bin/screenshot-path-daemon
```
