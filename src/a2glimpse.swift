import Cocoa
import WebKit
import Foundation

// MARK: - Stdout Helper

func writeToStdout(_ dict: [String: Any]) {
    guard let data = try? JSONSerialization.data(withJSONObject: dict),
          let line = String(data: data, encoding: .utf8) else { return }
    let output = line + "\n"
    FileHandle.standardOutput.write(output.data(using: .utf8)!)
    fflush(stdout)
}

func log(_ message: String) {
    fputs("[a2glimpse] \(message)\n", stderr)
}

// MARK: - System Info

func getSystemInfo() -> [String: Any] {
    let mouse = NSEvent.mouseLocation

    // Main screen
    var screenInfo: [String: Any] = [:]
    if let screen = NSScreen.main {
        let f = screen.frame
        let v = screen.visibleFrame
        screenInfo = [
            "width": Int(f.width),
            "height": Int(f.height),
            "scaleFactor": Int(screen.backingScaleFactor),
            "visibleX": Int(v.origin.x),
            "visibleY": Int(v.origin.y),
            "visibleWidth": Int(v.width),
            "visibleHeight": Int(v.height),
        ]
    }

    // All screens
    let screens: [[String: Any]] = NSScreen.screens.map { screen in
        let f = screen.frame
        let v = screen.visibleFrame
        return [
            "x": Int(f.origin.x),
            "y": Int(f.origin.y),
            "width": Int(f.width),
            "height": Int(f.height),
            "scaleFactor": Int(screen.backingScaleFactor),
            "visibleX": Int(v.origin.x),
            "visibleY": Int(v.origin.y),
            "visibleWidth": Int(v.width),
            "visibleHeight": Int(v.height),
        ]
    }

    // Appearance
    let isDark = NSApp.effectiveAppearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
    let accent = NSColor.controlAccentColor.usingColorSpace(.sRGB)
    let accentHex: String
    if let c = accent {
        accentHex = String(format: "#%02X%02X%02X", Int(c.redComponent * 255), Int(c.greenComponent * 255), Int(c.blueComponent * 255))
    } else {
        accentHex = "#007AFF"
    }
    let reduceMotion = NSWorkspace.shared.accessibilityDisplayShouldReduceMotion
    let increaseContrast = NSWorkspace.shared.accessibilityDisplayShouldIncreaseContrast

    return [
        "screen": screenInfo,
        "screens": screens,
        "appearance": [
            "darkMode": isDark,
            "accentColor": accentHex,
            "reduceMotion": reduceMotion,
            "increaseContrast": increaseContrast,
        ],
        "cursor": [
            "x": Int(mouse.x),
            "y": Int(mouse.y),
        ],
    ]
}

// MARK: - Cursor Anchor

let safeZoneLeft: CGFloat = 20
let safeZoneRight: CGFloat = 27
let safeZoneUp: CGFloat = 15
let safeZoneDown: CGFloat = 39

func anchorPosition(mouse: NSPoint, windowSize: NSSize, anchor: String) -> NSPoint? {
    let cx = mouse.x
    let cy = mouse.y
    let W = windowSize.width
    let H = windowSize.height
    let sL = safeZoneLeft
    let sR = safeZoneRight
    let sU = safeZoneUp
    let sD = safeZoneDown
    switch anchor {
    case "top-left":
        return NSPoint(x: cx - sL - W, y: cy + sU)
    case "top-right":
        return NSPoint(x: cx + sR, y: cy + sU)
    case "right":
        return NSPoint(x: cx + sR, y: cy - H / 2)
    case "bottom-right":
        return NSPoint(x: cx + sR, y: cy - sD - H)
    case "bottom-left":
        return NSPoint(x: cx - sL - W, y: cy - sD - H)
    case "left":
        return NSPoint(x: cx - sL - W, y: cy - H / 2)
    default:
        return nil
    }
}

// MARK: - CLI Config

struct Config {
    // Default surface size sized for A2UI appliance content (single Card, modal,
    // or compact form). 800x600 was inherited from upstream Glimpse where the
    // surface was arbitrary HTML; A2UI surfaces are typically denser and
    // smaller. Callers can still override with --width/--height. Phase 4.
    var width: Int = 480
    var height: Int = 320
    var title: String = "a2glimpse"
    var frameless: Bool = false
    var floating: Bool = false
    var transparent: Bool = false
    var x: Int? = nil
    var y: Int? = nil
    var followCursor: Bool = false
    var cursorOffsetX: Int = 20
    var cursorOffsetY: Int = -20
    var clickThrough: Bool = false
    var hidden: Bool = false
    var autoClose: Bool = false
    var cursorAnchor: String? = nil
    var followMode: String = "snap"
    var openLinks: Bool = false
    var openLinksApp: String? = nil
    var statusItem: Bool = false
    var noDock: Bool = false
    // Test mode locks geometry for deterministic visual capture.
    // It is geometry/timing only — it MUST NOT add new command surfaces.
    // Activated via --test-mode flag or A2GLIMPSE_TEST_MODE=1 env var.
    var testMode: Bool = false
}

func parseArgs() -> Config {
    var config = Config()
    let args = CommandLine.arguments
    var i = 1
    while i < args.count {
        switch args[i] {
        case "--width":
            i += 1
            if i < args.count, let v = Int(args[i]) { config.width = v }
        case "--height":
            i += 1
            if i < args.count, let v = Int(args[i]) { config.height = v }
        case "--title":
            i += 1
            if i < args.count { config.title = args[i] }
        case "--frameless":
            config.frameless = true
        case "--floating":
            config.floating = true
        case "--transparent":
            config.transparent = true
        case "--x":
            i += 1
            if i < args.count, let v = Int(args[i]) { config.x = v }
        case "--y":
            i += 1
            if i < args.count, let v = Int(args[i]) { config.y = v }
        case "--follow-cursor":
            config.followCursor = true
        case "--cursor-offset-x":
            i += 1
            if i < args.count, let v = Int(args[i]) { config.cursorOffsetX = v }
        case "--cursor-offset-y":
            i += 1
            if i < args.count, let v = Int(args[i]) { config.cursorOffsetY = v }
        case "--click-through":
            config.clickThrough = true
        case "--hidden":
            config.hidden = true
        case "--auto-close":
            config.autoClose = true
        case "--cursor-anchor":
            i += 1
            if i < args.count { config.cursorAnchor = args[i] }
        case "--follow-mode":
            i += 1
            if i < args.count { config.followMode = args[i] }
        case "--open-links":
            config.openLinks = true
        case "--open-links-app":
            i += 1
            if i < args.count {
                config.openLinks = true
                config.openLinksApp = args[i]
            }
        case "--status-item":
            config.statusItem = true
        case "--no-dock":
            config.noDock = true
        case "--test-mode":
            config.testMode = true
        default:
            break
        }
        i += 1
    }
    // Env-var fallback for test mode (mirrors --test-mode flag).
    if let envTest = ProcessInfo.processInfo.environment["A2GLIMPSE_TEST_MODE"],
       envTest == "1" || envTest.lowercased() == "true" {
        config.testMode = true
    }
    // Test mode locks geometry deterministically for visual capture.
    if config.testMode {
        config.followCursor = false
        config.frameless = false
        config.transparent = false
        config.clickThrough = false
        config.statusItem = false
        config.noDock = false
        config.hidden = false
        config.cursorAnchor = nil
        // Default deterministic size if caller didn't specify.
        // Detect explicit width/height to leave caller-provided sizing intact.
        var explicitW = false
        var explicitH = false
        var k = 1
        while k < args.count {
            if args[k] == "--width" { explicitW = true }
            if args[k] == "--height" { explicitH = true }
            k += 1
        }
        if !explicitW { config.width = 480 }
        if !explicitH { config.height = 320 }
    }
    // When anchor is set, offsets default to 0 (fine-tuning only).
    // The non-zero defaults (20, -20) are for offset-only mode.
    if config.cursorAnchor != nil {
        var explicitOffsetX = false
        var explicitOffsetY = false
        var j = 1
        while j < args.count {
            if args[j] == "--cursor-offset-x" { explicitOffsetX = true }
            if args[j] == "--cursor-offset-y" { explicitOffsetY = true }
            j += 1
        }
        if !explicitOffsetX { config.cursorOffsetX = 0 }
        if !explicitOffsetY { config.cursorOffsetY = 0 }
    }
    return config
}

// MARK: - WebView Bridge

let bridgeJS = """
window.glimpse = {
    cursorTip: null,
    send: function(data) {
        window.webkit.messageHandlers.glimpse.postMessage(JSON.stringify(data));
    },
    close: function() {
        window.webkit.messageHandlers.glimpse.postMessage(JSON.stringify({__glimpse_close: true}));
    }
};
"""

// MARK: - Window Subclass (keyboard support for frameless windows)

class GlimpsePanel: NSWindow {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { true }
}

// MARK: - Status Item View Controller

class StatusItemViewController: NSViewController {
    let webView: WKWebView

    init(webView: WKWebView, size: NSSize) {
        self.webView = webView
        super.init(nibName: nil, bundle: nil)
        self.preferredContentSize = size
    }

    required init?(coder: NSCoder) { fatalError() }

    override func loadView() {
        view = NSView(frame: NSRect(origin: .zero, size: preferredContentSize))
        webView.frame = view.bounds
        webView.autoresizingMask = [.width, .height]
        view.addSubview(webView)
    }
}

// MARK: - AppDelegate

@MainActor
class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKScriptMessageHandler, NSWindowDelegate {

    var window: NSWindow!
    var webView: WKWebView!
    let config: Config

    // Hidden state — tracks whether the window is hidden (prewarm mode)
    var hidden: Bool = false

    // Cursor anchor — mutable so the follow-cursor protocol command can update it at runtime
    var cursorAnchor: String? = nil

    // Follow mode — mutable so the follow-cursor protocol command can switch at runtime
    var followMode: String = "snap"

    // Mouse monitor references for follow-cursor mode
    var globalMouseMonitor: Any?
    var localMouseMonitor: Any?

    // Spring physics state
    var springTargetX: CGFloat = 0
    var springTargetY: CGFloat = 0
    var springPosX: CGFloat = 0
    var springPosY: CGFloat = 0
    var springVelX: CGFloat = 0
    var springVelY: CGFloat = 0
    var springTimer: DispatchSourceTimer? = nil
    var springTimerSuspended: Bool = true

    let springStiffness: CGFloat = 400
    let springDamping: CGFloat = 28
    let springDt: CGFloat = 1.0 / 120.0
    let springSettleThreshold: CGFloat = 0.5

    private func openURLInBrowser(_ url: URL) {
        guard config.openLinks else { return }

        if let appPath = config.openLinksApp {
            let appURL = URL(fileURLWithPath: appPath)
            guard FileManager.default.fileExists(atPath: appPath) else {
                log("open-links-app: app path not found: \(appPath)")
                _ = NSWorkspace.shared.open(url)
                return
            }

            let openConfig = NSWorkspace.OpenConfiguration()
            NSWorkspace.shared.open(
                [url],
                withApplicationAt: appURL,
                configuration: openConfig
            ) { _, error in
                if let error {
                    log("open-links-app: failed to open \(url.absoluteString) in \(appPath): \(error.localizedDescription)")
                    _ = NSWorkspace.shared.open(url)
                }
            }
        } else {
            if !NSWorkspace.shared.open(url) {
                log("open-links: failed to open \(url.absoluteString) in default browser")
            }
        }
    }

    // Ready coordination — stdout `ready` is emitted only after BOTH the
    // WKWebView finishes navigation AND the renderer host posts its
    // a2glimpse-host-ready bridge message. Either signal alone is insufficient:
    // WebKit-ready means the page bytes loaded; host-ready means the Lit
    // surface element is registered and window.a2glimpse.dispatch is wired.
    // Don't ship `ready` to consumers until messages can actually be processed.
    var webkitNavFinished: Bool = false
    var hostReady: Bool = false
    var readyEmitted: Bool = false

    // Status item mode
    var nsStatusItem: NSStatusItem?
    var popover: NSPopover?
    var popoverViewController: StatusItemViewController?

    nonisolated init(config: Config) {
        self.config = config
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        if config.statusItem {
            setupStatusItem()
        } else {
            hidden = config.hidden
            cursorAnchor = config.cursorAnchor
            followMode = config.followMode
            setupWindow()
            setupWebView()
            if config.followCursor {
                if followMode == "spring" {
                    // Initialize spring position from the window position set by setupWindow()
                    springPosX = window.frame.origin.x
                    springPosY = window.frame.origin.y
                    let target = computeTargetPosition(mouse: NSEvent.mouseLocation)
                    springTargetX = target.x
                    springTargetY = target.y
                }
                startFollowingCursor()
            }
        }
        startStdinReader()
    }

    // MARK: - Setup

    private func setupWindow() {
        let rect = NSRect(x: 0, y: 0, width: config.width, height: config.height)
        let styleMask: NSWindow.StyleMask = config.frameless
            ? [.borderless]
            : [.titled, .closable, .miniaturizable, .resizable]
        window = GlimpsePanel(
            contentRect: rect,
            styleMask: styleMask,
            backing: .buffered,
            defer: false
        )
        window.title = config.title
        if config.frameless {
            window.isMovableByWindowBackground = true
        }
        // Unified macOS titlebar — production mode only.
        // Hides the title strip and lets the WKWebView content extend up to
        // where the traffic lights sit, matching the modern macOS appliance
        // look. Gated OFF in --test-mode (test-mode keeps standard chrome for
        // visual-capture determinism — see Phase 1) and irrelevant for
        // borderless/frameless windows. Phase 4. (Host CSS adds top padding
        // in production mode so content doesn't slide under traffic lights.)
        if !config.testMode && !config.frameless {
            window.titleVisibility = .hidden
            window.titlebarAppearsTransparent = true
            window.styleMask.insert(.fullSizeContentView)
        }
        if config.floating || config.followCursor {
            window.level = .floating
        }
        if config.clickThrough {
            window.ignoresMouseEvents = true
        }
        if config.transparent {
            window.isOpaque = false
            window.backgroundColor = .clear
        }
        if config.followCursor {
            let mouse = NSEvent.mouseLocation
            if let anchor = cursorAnchor,
               let base = anchorPosition(mouse: mouse, windowSize: NSSize(width: config.width, height: config.height), anchor: anchor) {
                let x = base.x + CGFloat(config.cursorOffsetX)
                let y = base.y + CGFloat(config.cursorOffsetY)
                window.setFrameOrigin(NSPoint(x: x, y: y))
            } else {
                let x = mouse.x + CGFloat(config.cursorOffsetX)
                let y = mouse.y + CGFloat(config.cursorOffsetY)
                window.setFrameOrigin(NSPoint(x: x, y: y))
            }
        } else if let x = config.x, let y = config.y {
            window.setFrameOrigin(NSPoint(x: x, y: y))
        } else {
            window.center()
        }
        window.delegate = self
        if config.hidden {
            // Explicitly keep the window off-screen — WKWebView loading
            // can implicitly order the window in on macOS.
            window.orderOut(nil)
        } else if config.clickThrough {
            window.orderFrontRegardless()
        } else {
            window.makeKeyAndOrderFront(nil)
            NSApp.activate(ignoringOtherApps: true)
        }
    }

    private func makeWebViewConfiguration() -> WKWebViewConfiguration {
        let ucc = WKUserContentController()
        let script = WKUserScript(source: bridgeJS, injectionTime: .atDocumentStart, forMainFrameOnly: true)
        ucc.addUserScript(script)
        if config.testMode {
            // Activate the host page's test-mode CSS scaffolding (animations off,
            // caret hidden, focus rings neutralized) for deterministic visual capture.
            // Trust boundary: this is a one-way Swift -> page signal, not a new
            // public stdin command.
            let testModeJS = """
            (function() {
              function activate() {
                if (document.body) {
                  document.body.dataset.testMode = '';
                } else {
                  document.addEventListener('DOMContentLoaded', activate, { once: true });
                }
              }
              activate();
            })();
            """
            let testScript = WKUserScript(source: testModeJS, injectionTime: .atDocumentStart, forMainFrameOnly: true)
            ucc.addUserScript(testScript)
        }
        ucc.add(self, name: "glimpse")
        let wkConfig = WKWebViewConfiguration()
        wkConfig.userContentController = ucc
        return wkConfig
    }

    private func setupWebView() {
        webView = WKWebView(frame: window.contentView!.bounds, configuration: makeWebViewConfiguration())
        webView.autoresizingMask = [.width, .height]
        webView.navigationDelegate = self
        if config.transparent {
            webView.underPageBackgroundColor = .clear
            webView.setValue(false, forKey: "drawsBackground")
        }
        window.contentView?.addSubview(webView)

        loadRendererHost()
    }

    // MARK: - Status Item

    private func setupStatusItem() {
        log("Setting up status item mode")

        let size = NSSize(width: config.width, height: config.height)
        webView = WKWebView(frame: NSRect(origin: .zero, size: size), configuration: makeWebViewConfiguration())
        webView.navigationDelegate = self

        // Create view controller and popover
        popoverViewController = StatusItemViewController(webView: webView, size: size)

        popover = NSPopover()
        popover!.contentViewController = popoverViewController
        popover!.contentSize = size
        popover!.behavior = .transient

        // Create status bar item
        nsStatusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        if let button = nsStatusItem?.button {
            button.title = config.title == "a2glimpse" ? "A2" : config.title
            button.action = #selector(statusItemClicked(_:))
            button.target = self
        }

        loadRendererHost()
    }

    private func loadRendererHost() {
        // Single, deterministic load path: the renderer host MUST sit adjacent
        // to the compiled binary. No cwd fallback, no embedded placeholder —
        // a missing host is a packaging failure, not a runtime condition we
        // try to paper over. (Phase 2a hardening; see plan doc.)
        let executableDir = URL(fileURLWithPath: CommandLine.arguments[0])
            .standardizedFileURL
            .resolvingSymlinksInPath()
            .deletingLastPathComponent()
        let hostURL = executableDir.appendingPathComponent("a2glimpse-host.html")

        guard FileManager.default.fileExists(atPath: hostURL.path) else {
            FileHandle.standardError.write(Data(
                "[a2glimpse] FATAL: renderer host not found at \(hostURL.path). The bundled a2glimpse-host.html must sit adjacent to the binary. Reinstall the package or rebuild via `npm run build:macos`.\n".utf8
            ))
            exit(2)
        }

        webView.loadFileURL(hostURL, allowingReadAccessTo: executableDir)
    }

    @objc func statusItemClicked(_ sender: Any?) {
        guard let button = nsStatusItem?.button, let popover = popover else { return }
        if popover.isShown {
            popover.performClose(sender)
        } else {
            popover.show(relativeTo: button.bounds, of: button, preferredEdge: .minY)
        }
        writeToStdout(["type": "click"])
    }

    // MARK: - Follow Cursor

    func computeTargetPosition(mouse: NSPoint) -> NSPoint {
        if let anchor = cursorAnchor,
           let base = anchorPosition(mouse: mouse, windowSize: window.frame.size, anchor: anchor) {
            return NSPoint(x: base.x + CGFloat(config.cursorOffsetX), y: base.y + CGFloat(config.cursorOffsetY))
        } else {
            return NSPoint(x: mouse.x + CGFloat(config.cursorOffsetX), y: mouse.y + CGFloat(config.cursorOffsetY))
        }
    }

    func startFollowingCursor() {
        guard globalMouseMonitor == nil else { return }
        window.level = .floating
        let moveHandler: (NSEvent) -> Void = { [weak self] _ in
            guard let self else { return }
            let target = self.computeTargetPosition(mouse: NSEvent.mouseLocation)
            if self.followMode == "spring" {
                self.springTargetX = target.x
                self.springTargetY = target.y
                self.wakeSpringTimer()
            } else {
                self.window.setFrameOrigin(target)
            }
        }
        globalMouseMonitor = NSEvent.addGlobalMonitorForEvents(
            matching: [.mouseMoved, .leftMouseDragged, .rightMouseDragged],
            handler: moveHandler
        )
        localMouseMonitor = NSEvent.addLocalMonitorForEvents(matching: [.mouseMoved, .leftMouseDragged, .rightMouseDragged]) { [weak self] event in
            guard let self else { return event }
            let target = self.computeTargetPosition(mouse: NSEvent.mouseLocation)
            if self.followMode == "spring" {
                self.springTargetX = target.x
                self.springTargetY = target.y
                self.wakeSpringTimer()
            } else {
                self.window.setFrameOrigin(target)
            }
            return event
        }
    }

    func wakeSpringTimer() {
        if springTimer == nil {
            let timer = DispatchSource.makeTimerSource(queue: .main)
            timer.schedule(deadline: .now(), repeating: .milliseconds(8))
            timer.setEventHandler { [weak self] in
                MainActor.assumeIsolated {
                    self?.springPhysicsStep()
                }
            }
            springTimer = timer
            springTimerSuspended = true  // newly created timers are suspended
        }
        if springTimerSuspended {
            springTimer!.resume()
            springTimerSuspended = false
        }
    }

    func springPhysicsStep() {
        let dx = springTargetX - springPosX
        let dy = springTargetY - springPosY
        let fx = springStiffness * dx - springDamping * springVelX
        let fy = springStiffness * dy - springDamping * springVelY
        springVelX += fx * springDt
        springVelY += fy * springDt
        springPosX += springVelX * springDt
        springPosY += springVelY * springDt
        window.setFrameOrigin(NSPoint(x: springPosX, y: springPosY))

        // Suspend timer when settled (zero CPU at rest)
        let dist = (dx * dx + dy * dy).squareRoot()
        let vel = (springVelX * springVelX + springVelY * springVelY).squareRoot()
        if dist < springSettleThreshold && vel < springSettleThreshold {
            springPosX = springTargetX
            springPosY = springTargetY
            springVelX = 0
            springVelY = 0
            window.setFrameOrigin(NSPoint(x: springPosX, y: springPosY))
            if !springTimerSuspended {
                springTimer?.suspend()
                springTimerSuspended = true
            }
        }
    }

    func computeCursorTip() -> [String: Int]? {
        let H = window.frame.size.height
        if let anchor = cursorAnchor,
           let base = anchorPosition(mouse: NSPoint(x: 0, y: 0), windowSize: window.frame.size, anchor: anchor) {
            // In anchor mode, the offset from mouse to window origin is constant.
            // base is computed with mouse at (0,0), so base.x/y IS the offset from mouse to window origin.
            let cssX = 0 - base.x - CGFloat(config.cursorOffsetX)
            let cssY = H - (0 - base.y - CGFloat(config.cursorOffsetY))
            return ["x": Int(cssX), "y": Int(cssY)]
        } else if config.followCursor || globalMouseMonitor != nil {
            // Offset-only mode: windowOrigin.x = mouse.x + offsetX, windowOrigin.y = mouse.y + offsetY
            // cssX = mouse.x - windowOrigin.x = -offsetX
            // cssY = H - (mouse.y - windowOrigin.y) = H - (-offsetY) = H + offsetY
            let cssX = -config.cursorOffsetX
            let cssY = Int(H) + config.cursorOffsetY
            return ["x": cssX, "y": cssY]
        }
        return nil
    }

    func stopFollowingCursor() {
        if let monitor = globalMouseMonitor {
            NSEvent.removeMonitor(monitor)
            globalMouseMonitor = nil
        }
        if let monitor = localMouseMonitor {
            NSEvent.removeMonitor(monitor)
            localMouseMonitor = nil
        }
        // Cancel spring timer — must resume before cancel if suspended
        if let timer = springTimer {
            if springTimerSuspended {
                timer.resume()
            }
            timer.cancel()
            springTimer = nil
            springTimerSuspended = true
        }
    }

    // MARK: - Stdin Reader

    private func startStdinReader() {
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            while let line = readLine() {
                let trimmed = line.trimmingCharacters(in: .whitespaces)
                guard !trimmed.isEmpty else { continue }
                guard let data = trimmed.data(using: .utf8),
                      let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
                else {
                    log("Skipping invalid JSON: \(trimmed)")
                    continue
                }
                let handler = self
                DispatchQueue.main.async {
                    MainActor.assumeIsolated {
                        handler?.handleInput(json)
                    }
                }
            }
            // stdin EOF — close window
            let closer = self
            DispatchQueue.main.async {
                MainActor.assumeIsolated {
                    closer?.closeAndExit()
                }
            }
        }
    }

    // MARK: - Command Dispatch

    func handleInput(_ json: [String: Any]) {
        if let type = json["type"] as? String {
            handleCommand(type: type, json: json)
            return
        }

        let a2uiKeys = ["surfaceUpdate", "dataModelUpdate", "beginRendering", "deleteSurface"]
        if a2uiKeys.contains(where: { json[$0] != nil }) {
            dispatchA2uiMessage(json)
            return
        }

        writeToStdout(["error": ["message": "Unknown input. Expected an A2UI v0.8 message or lifecycle command."]])
    }

    func dispatchA2uiMessage(_ json: [String: Any]) {
        guard JSONSerialization.isValidJSONObject(json),
              let data = try? JSONSerialization.data(withJSONObject: json),
              let payload = String(data: data, encoding: .utf8)
        else {
            writeToStdout(["error": ["message": "Invalid A2UI JSON payload"]])
            return
        }

        let js = """
        if (window.a2glimpse && typeof window.a2glimpse.dispatch === 'function') {
          window.a2glimpse.dispatch(\(payload));
        } else {
          throw new Error('a2glimpse renderer host is not ready');
        }
        """
        webView.evaluateJavaScript(js) { _, error in
            if let error {
                writeToStdout(["error": ["message": error.localizedDescription]])
            }
        }
    }

    func handleCommand(type: String, json: [String: Any]) {
        switch type {
        case "follow-cursor":
            if config.testMode {
                log("follow-cursor ignored in --test-mode (geometry locked)")
                return
            }
            guard !config.statusItem else {
                log("follow-cursor not supported in status-item mode")
                return
            }
            let enabled = json["enabled"] as? Bool ?? true
            if let anchor = json["anchor"] as? String, !anchor.isEmpty {
                cursorAnchor = anchor
            } else if json.keys.contains("anchor") {
                cursorAnchor = nil
            }
            if let mode = json["mode"] as? String {
                let wasSpring = followMode == "spring"
                followMode = mode
                if mode == "spring" && !wasSpring {
                    // Initialize spring position to current window origin and wake timer
                    springPosX = window.frame.origin.x
                    springPosY = window.frame.origin.y
                    springVelX = 0
                    springVelY = 0
                    let target = computeTargetPosition(mouse: NSEvent.mouseLocation)
                    springTargetX = target.x
                    springTargetY = target.y
                    if globalMouseMonitor != nil { wakeSpringTimer() }
                } else if mode == "snap" && wasSpring {
                    // Snap to target and suspend spring timer
                    springPosX = springTargetX
                    springPosY = springTargetY
                    springVelX = 0
                    springVelY = 0
                    window.setFrameOrigin(NSPoint(x: springPosX, y: springPosY))
                    if let timer = springTimer, !springTimerSuspended {
                        timer.suspend()
                        springTimerSuspended = true
                    }
                }
            }
            if enabled {
                startFollowingCursor()
            } else {
                stopFollowingCursor()
            }
            if let tip = computeCursorTip() {
                webView.evaluateJavaScript("window.glimpse.cursorTip = {x: \(tip["x"]!), y: \(tip["y"]!)}", completionHandler: nil)
            } else {
                webView.evaluateJavaScript("window.glimpse.cursorTip = null", completionHandler: nil)
            }
        case "get-info":
            var info = getSystemInfo()
            info["type"] = "info"
            if !config.statusItem, let tip = computeCursorTip() {
                info["cursorTip"] = tip
            }
            writeToStdout(info)
        case "show":
            if config.statusItem {
                if let title = json["title"] as? String {
                    nsStatusItem?.button?.title = title
                }
                if let button = nsStatusItem?.button, let popover = popover, !popover.isShown {
                    popover.show(relativeTo: button.bounds, of: button, preferredEdge: .minY)
                }
            } else {
                if let title = json["title"] as? String {
                    window.title = title
                }
                hidden = false
                if !config.clickThrough && !config.noDock {
                    NSApp.setActivationPolicy(.regular)
                }
                window.makeKeyAndOrderFront(nil)
                window.makeFirstResponder(webView)
                NSApp.activate(ignoringOtherApps: true)
            }
        case "title":
            guard let title = json["title"] as? String else {
                log("title command: missing title field")
                return
            }
            if config.statusItem {
                nsStatusItem?.button?.title = title
            } else {
                window.title = title
            }
        case "resize":
            if config.testMode {
                log("resize ignored in --test-mode (geometry locked)")
                return
            }
            let w = json["width"] as? Int ?? config.width
            let h = json["height"] as? Int ?? config.height
            let size = NSSize(width: w, height: h)
            if config.statusItem {
                popover?.contentSize = size
                popoverViewController?.preferredContentSize = size
            } else {
                window.setContentSize(size)
            }
        case "__test-click":
            // Test-only synthetic-click path. Walks the open-shadow-DOM tree to
            // find a component by id and dispatches a synthetic .click() on its
            // primary actionable element. This bypasses real user input and
            // therefore MUST NOT be reachable from default command dispatch
            // (Phase 2b — see knowledge/20260509-140000.polish-and-hardening-plan.plan.md).
            // Gate: requires --test-mode flag or A2GLIMPSE_TEST_MODE=1 env var.
            guard config.testMode else {
                log("__test-click rejected: --test-mode not enabled")
                writeToStdout(["error": ["message": "Unknown command type: __test-click"]])
                return
            }
            guard let id = json["id"] as? String,
                  let idData = try? JSONSerialization.data(withJSONObject: [id]),
                  let idArrayJSON = String(data: idData, encoding: .utf8)
            else {
                writeToStdout(["error": ["message": "__test-click requires an id"]])
                return
            }
            let idJSON = String(idArrayJSON.dropFirst().dropLast())
            let js = """
            (() => {
              const targetId = \(idJSON);
              const seen = new Set();
              const visit = root => {
                if (!root || seen.has(root)) return null;
                seen.add(root);
                if (root.getElementById) {
                  const match = root.getElementById(targetId);
                  if (match) return match;
                }
                const nodes = root.querySelectorAll ? root.querySelectorAll('*') : [];
                for (const node of nodes) {
                  if (node.id === targetId) return node;
                  const shadowMatch = visit(node.shadowRoot);
                  if (shadowMatch) return shadowMatch;
                }
                return null;
              };
              const el = visit(document);
              if (!el) throw new Error(`No element with id ${targetId}`);
              const clickable = el.shadowRoot?.querySelector('button,input,[role="button"]') ?? el;
              clickable.click();
            })();
            """
            webView.evaluateJavaScript(js) { _, error in
                if let error {
                    writeToStdout(["error": ["message": error.localizedDescription]])
                }
            }
        case "close":
            closeAndExit()
        default:
            log("Unknown command type: \(type)")
            writeToStdout(["error": ["message": "Unknown command type: \(type)"]])
        }
    }

    func closeAndExit() {
        if config.statusItem, let item = nsStatusItem {
            NSStatusBar.system.removeStatusItem(item)
            nsStatusItem = nil
        }
        writeToStdout(["type": "closed"])
        exit(0)
    }

    // MARK: - WKNavigationDelegate

    nonisolated func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        MainActor.assumeIsolated {
            guard self.config.openLinks else {
                decisionHandler(.allow)
                return
            }

            guard navigationAction.navigationType == .linkActivated else {
                decisionHandler(.allow)
                return
            }

            guard let url = navigationAction.request.url,
                  let scheme = url.scheme?.lowercased(),
                  scheme == "http" || scheme == "https"
            else {
                decisionHandler(.allow)
                return
            }

            openURLInBrowser(url)
            decisionHandler(.cancel)
        }
    }

    nonisolated func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        MainActor.assumeIsolated {
            if !config.statusItem {
                if hidden {
                    // WKWebView loading can implicitly order the window in.
                    // Force it back out after every navigation while hidden.
                    window.orderOut(nil)
                } else {
                    window.makeFirstResponder(webView)
                }
            }
            if !config.statusItem, let tip = computeCursorTip() {
                webView.evaluateJavaScript("window.glimpse.cursorTip = {x: \(tip["x"]!), y: \(tip["y"]!)}", completionHandler: nil)
            }
            webkitNavFinished = true
            maybeEmitReady()
        }
    }

    /// Emits stdout `ready` once both WebKit navigation has finished AND the
    /// renderer host has signalled it is ready to receive A2UI messages.
    /// Idempotent — guards against double-emit if either signal arrives twice.
    @MainActor
    private func maybeEmitReady() {
        guard !readyEmitted, webkitNavFinished, hostReady else { return }
        readyEmitted = true
        var info = getSystemInfo()
        info["type"] = "ready"
        if !config.statusItem, let tip = computeCursorTip() {
            info["cursorTip"] = tip
        }
        writeToStdout(info)
    }

    // MARK: - WKScriptMessageHandler

    nonisolated func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        MainActor.assumeIsolated {
            guard let body = message.body as? String,
                  let data = body.data(using: .utf8),
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            else {
                log("Received invalid message from webview")
                return
            }

            if json["__glimpse_close"] as? Bool == true {
                closeAndExit()
                return
            }

            if json["__a2glimpse_host_ready"] as? Bool == true {
                // Renderer-host-ready bridge: the Lit surface element has been
                // defined and window.a2glimpse.dispatch is wired. Combined with
                // WebKit didFinish, this lets us emit stdout `ready` only when
                // a downstream consumer can actually send a surfaceUpdate.
                hostReady = true
                maybeEmitReady()
                return
            }

            if json["userAction"] != nil || json["error"] != nil {
                writeToStdout(json)
            } else {
                writeToStdout(["error": ["message": "Unsupported renderer event"]])
            }
            if config.autoClose {
                closeAndExit()
            }
        }
    }

    // MARK: - NSWindowDelegate

    func windowDidResize(_ notification: Notification) {
        if let tip = computeCursorTip() {
            webView.evaluateJavaScript("window.glimpse.cursorTip = {x: \(tip["x"]!), y: \(tip["y"]!)}", completionHandler: nil)
        }
    }

    func windowWillClose(_ notification: Notification) {
        writeToStdout(["type": "closed"])
        exit(0)
    }
}

// MARK: - Entry Point

let config = parseArgs()
let app = NSApplication.shared
let delegate = AppDelegate(config: config)
app.delegate = delegate
app.setActivationPolicy((config.statusItem || config.clickThrough || config.hidden || config.noDock) ? .accessory : .regular)
app.run()
