import Cocoa

// screenshot-path-daemon
// 功能：
//   1. 监听系统剪贴板，检测到新图片时自动保存到本地并记录路径
//   2. 拦截 Opt+V，将最新截图路径粘贴到当前输入框
// 不依赖任何截图工具落盘，适用于飞书/微信/系统截图等所有场景。

let saveDir = NSString("~/Pictures/Screenshots").expandingTildeInPath
var eventTap: CFMachPort?
var lastChangeCount = NSPasteboard.general.changeCount
var lastSavedPath: String?

// MARK: - 启动
func setup() {
    // 确保保存目录存在
    try? FileManager.default.createDirectory(atPath: saveDir, withIntermediateDirectories: true)
    lastChangeCount = NSPasteboard.general.changeCount
    cleanupOldScreenshots()
}

// MARK: - 清理过期截图（保留 7 天）
let retentionDays = 7

func cleanupOldScreenshots() {
    let fm = FileManager.default
    let cutoff = Date().addingTimeInterval(-Double(retentionDays) * 86400)

    guard let files = try? fm.contentsOfDirectory(atPath: saveDir) else { return }

    for file in files {
        guard file.hasPrefix("screenshot_") && file.hasSuffix(".png") else { continue }
        let path = (saveDir as NSString).appendingPathComponent(file)
        guard let attrs = try? fm.attributesOfItem(atPath: path),
              let modified = attrs[.modificationDate] as? Date else { continue }
        if modified < cutoff {
            try? fm.removeItem(atPath: path)
        }
    }
}

// MARK: - 剪贴板监听
func checkClipboard() {
    let pb = NSPasteboard.general
    let currentCount = pb.changeCount

    guard currentCount != lastChangeCount else { return }
    lastChangeCount = currentCount

    // 检查剪贴板是否有图片
    guard let image = NSImage(pasteboard: pb) else { return }

    // 忽略太小的图片（可能是 UI 图标之类）
    if image.size.width < 50 || image.size.height < 50 { return }

    // 保存为 PNG
    let timestamp = Date().timeIntervalSince1970
    let filename = String(format: "screenshot_%.0f.png", timestamp)
    let path = (saveDir as NSString).appendingPathComponent(filename)

    guard let tiffData = image.tiffRepresentation,
          let bitmap = NSBitmapImageRep(data: tiffData),
          let pngData = bitmap.representation(using: .png, properties: [:]) else { return }

    do {
        try pngData.write(to: URL(fileURLWithPath: path))
        lastSavedPath = path

        // 同时写入 named pasteboard 作为备份
        let namedPB = NSPasteboard(name: .init("screenshot.path.daemon"))
        namedPB.clearContents()
        namedPB.setString(path, forType: .string)

        // 通知（用 osascript 避免 NSUserNotification 在 daemon 中不生效）
        let script = "display notification \"Opt+V 粘贴路径\" with title \"截图已保存\""
        Process.launchedProcess(launchPath: "/usr/bin/osascript", arguments: ["-e", script])

        // 顺便清理过期截图
        cleanupOldScreenshots()
    } catch {
        fputs("保存失败: \(error)\n", stderr)
    }
}

// MARK: - Opt+V 处理
func pasteScreenshotPath() {
    guard let path = lastSavedPath else { return }

    let pb = NSPasteboard.general
    pb.clearContents()
    pb.setString(path, forType: .string)

    // 模拟 Cmd+V
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) {
        let source = CGEventSource(stateID: .combinedSessionState)
        let down = CGEvent(keyboardEventSource: source, virtualKey: 9, keyDown: true)
        let up = CGEvent(keyboardEventSource: source, virtualKey: 9, keyDown: false)
        down?.flags = .maskCommand
        up?.flags = .maskCommand
        down?.post(tap: .cghidEventTap)
        up?.post(tap: .cghidEventTap)
    }
}

// MARK: - CGEvent Tap 回调
func eventTapCallback(
    proxy: CGEventTapProxy,
    type: CGEventType,
    event: CGEvent,
    refcon: UnsafeMutableRawPointer?
) -> Unmanaged<CGEvent>? {

    if type == .tapDisabledByTimeout || type == .tapDisabledByUserInput {
        if let tap = eventTap { CGEvent.tapEnable(tap: tap, enable: true) }
        return Unmanaged.passUnretained(event)
    }

    guard type == .keyDown else {
        return Unmanaged.passUnretained(event)
    }

    let flags = event.flags
    let keycode = event.getIntegerValueField(.keyboardEventKeycode)

    // V = 9, 只匹配 Opt+V（排除 Cmd+Opt+V / Ctrl+Opt+V）
    if keycode == 9
        && flags.contains(.maskAlternate)
        && !flags.contains(.maskCommand)
        && !flags.contains(.maskControl) {
        pasteScreenshotPath()
        return nil // 拦截，不穿透到前台应用
    }

    return Unmanaged.passUnretained(event)
}

// MARK: - Main
setup()

// 创建 event tap
let eventMask: CGEventMask = (1 << CGEventType.keyDown.rawValue)
guard let tap = CGEvent.tapCreate(
    tap: .cgSessionEventTap,
    place: .headInsertEventTap,
    options: .defaultTap,
    eventsOfInterest: eventMask,
    callback: eventTapCallback,
    userInfo: nil
) else {
    fputs("ERROR: 无法创建 event tap，请在 系统设置 > 隐私与安全性 > 辅助功能 中授权本程序\n", stderr)
    exit(1)
}
eventTap = tap
let runLoopSource = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, tap, 0)
CFRunLoopAddSource(CFRunLoopGetCurrent(), runLoopSource, .commonModes)
CGEvent.tapEnable(tap: tap, enable: true)

// 剪贴板轮询定时器（200ms）
let timer = Timer(timeInterval: 0.2, repeats: true) { _ in
    checkClipboard()
}
RunLoop.current.add(timer, forMode: .common)

// 后台运行
NSApplication.shared.setActivationPolicy(.accessory)
CFRunLoopRun()
