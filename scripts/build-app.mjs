// Build an unsigned a2glimpse.app bundle.
//
// Layout:
//   dist/a2glimpse.app/
//     Contents/
//       Info.plist
//       MacOS/a2glimpse              ← compiled Swift binary
//       Resources/
//         a2glimpse-host.html
//         MaterialSymbolsOutlined.woff2
//         AppIcon.icns               ← optional placeholder
//
// Bundle identity:
//   CFBundleIdentifier:        com.bdmorin.a2glimpse
//   CFBundleName:              a2glimpse
//   CFBundleExecutable:        a2glimpse
//   CFBundleVersion / Short:   sourced from package.json `version`
//   LSUIElement: true          (no Dock icon — appliance, not foreground app)
//   NSHighResolutionCapable: true
//
// The bundle is unsigned. See knowledge/<ts>.apple-developer-onboarding.knowledge.md
// for the codesign + notarize path.

import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const distDir = join(repoRoot, 'dist');
const appDir = join(distDir, 'a2glimpse.app');
const contentsDir = join(appDir, 'Contents');
const macosDir = join(contentsDir, 'MacOS');
const resourcesDir = join(contentsDir, 'Resources');

const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
const version = pkg.version;

function log(msg) {
  console.log(`[build-app] ${msg}`);
}

function fail(msg) {
  console.error(`[build-app] FATAL: ${msg}`);
  process.exit(1);
}

// 1. Ensure the binary is built.
const binarySrc = join(repoRoot, 'src', 'a2glimpse');
if (!existsSync(binarySrc)) {
  log('binary missing, running build:macos');
  const r = spawnSync('node', ['scripts/build.mjs', 'darwin'], { cwd: repoRoot, stdio: 'inherit' });
  if (r.status !== 0) fail('swift build failed');
}

// 2. Wipe and recreate the bundle skeleton.
rmSync(appDir, { recursive: true, force: true });
mkdirSync(macosDir, { recursive: true });
mkdirSync(resourcesDir, { recursive: true });

// 3. Copy the binary into Contents/MacOS.
const binaryDest = join(macosDir, 'a2glimpse');
copyFileSync(binarySrc, binaryDest);
execFileSync('chmod', ['+x', binaryDest]);

// 4. Copy resources.
const hostHtmlSrc = join(repoRoot, 'src', 'a2glimpse-host.html');
copyFileSync(hostHtmlSrc, join(resourcesDir, 'a2glimpse-host.html'));

const fontSrc = join(repoRoot, 'src', 'MaterialSymbolsOutlined.woff2');
if (existsSync(fontSrc)) {
  copyFileSync(fontSrc, join(resourcesDir, 'MaterialSymbolsOutlined.woff2'));
}

// 5. Optional icon placeholder. Best-effort: try to generate a flat-color
//    icon with "a2g" using sips/iconutil. If anything fails, skip silently
//    and document as a follow-up — cosmetics shouldn't block packaging.
function tryGenerateIcon() {
  const iconPath = join(resourcesDir, 'AppIcon.icns');
  const tmpPng = join(distDir, '.icon-1024.png');
  const iconset = join(distDir, '.AppIcon.iconset');
  try {
    // Generate a 1024x1024 PNG via Swift + CoreGraphics one-liner.
    const swiftSrc = `
import AppKit
import Foundation
let size = NSSize(width: 1024, height: 1024)
let img = NSImage(size: size)
img.lockFocus()
NSColor(calibratedRed: 0.10, green: 0.13, blue: 0.18, alpha: 1.0).setFill()
NSBezierPath(roundedRect: NSRect(origin: .zero, size: size), xRadius: 180, yRadius: 180).fill()
let text = "a2g" as NSString
let attrs: [NSAttributedString.Key: Any] = [
    .font: NSFont.systemFont(ofSize: 420, weight: .bold),
    .foregroundColor: NSColor.white,
]
let ts = text.size(withAttributes: attrs)
text.draw(at: NSPoint(x: (size.width - ts.width) / 2, y: (size.height - ts.height) / 2), withAttributes: attrs)
img.unlockFocus()
guard let tiff = img.tiffRepresentation,
      let rep = NSBitmapImageRep(data: tiff),
      let png = rep.representation(using: .png, properties: [:]) else {
    FileHandle.standardError.write("png encode failed\\n".data(using: .utf8)!)
    exit(1)
}
try png.write(to: URL(fileURLWithPath: CommandLine.arguments[1]))
`;
    const swiftFile = join(distDir, '.gen-icon.swift');
    writeFileSync(swiftFile, swiftSrc);
    execFileSync('swift', [swiftFile, tmpPng], { stdio: ['ignore', 'ignore', 'pipe'] });

    // Build .iconset and convert with iconutil.
    rmSync(iconset, { recursive: true, force: true });
    mkdirSync(iconset, { recursive: true });
    const sizes = [
      [16, '16x16'], [32, '16x16@2x'],
      [32, '32x32'], [64, '32x32@2x'],
      [128, '128x128'], [256, '128x128@2x'],
      [256, '256x256'], [512, '256x256@2x'],
      [512, '512x512'], [1024, '512x512@2x'],
    ];
    for (const [px, name] of sizes) {
      const out = join(iconset, `icon_${name}.png`);
      execFileSync('sips', ['-z', String(px), String(px), tmpPng, '--out', out], { stdio: ['ignore', 'ignore', 'pipe'] });
    }
    execFileSync('iconutil', ['-c', 'icns', iconset, '-o', iconPath], { stdio: ['ignore', 'ignore', 'pipe'] });
    rmSync(iconset, { recursive: true, force: true });
    rmSync(tmpPng, { force: true });
    rmSync(swiftFile, { force: true });
    return true;
  } catch (err) {
    log(`icon generation skipped: ${err.message?.split('\n')[0] ?? err}`);
    rmSync(iconset, { recursive: true, force: true });
    rmSync(tmpPng, { force: true });
    return false;
  }
}

const haveIcon = tryGenerateIcon();

// 6. Generate Info.plist.
const minSystem = '11.0';
const plistLines = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">',
  '<plist version="1.0">',
  '<dict>',
  '  <key>CFBundleIdentifier</key>', `  <string>com.bdmorin.a2glimpse</string>`,
  '  <key>CFBundleName</key>', `  <string>a2glimpse</string>`,
  '  <key>CFBundleDisplayName</key>', `  <string>a2glimpse</string>`,
  '  <key>CFBundleExecutable</key>', `  <string>a2glimpse</string>`,
  '  <key>CFBundlePackageType</key>', '  <string>APPL</string>',
  '  <key>CFBundleSignature</key>', '  <string>????</string>',
  '  <key>CFBundleVersion</key>', `  <string>${version}</string>`,
  '  <key>CFBundleShortVersionString</key>', `  <string>${version}</string>`,
  '  <key>CFBundleInfoDictionaryVersion</key>', '  <string>6.0</string>',
  '  <key>LSMinimumSystemVersion</key>', `  <string>${minSystem}</string>`,
  '  <key>LSUIElement</key>', '  <true/>',
  '  <key>NSHighResolutionCapable</key>', '  <true/>',
  '  <key>NSSupportsAutomaticGraphicsSwitching</key>', '  <true/>',
];
if (haveIcon) {
  plistLines.push('  <key>CFBundleIconFile</key>', '  <string>AppIcon</string>');
}
plistLines.push('</dict>', '</plist>', '');
writeFileSync(join(contentsDir, 'Info.plist'), plistLines.join('\n'));

// 7. Sanity report.
const binSize = statSync(binaryDest).size;
log(`built dist/a2glimpse.app  (binary ${binSize} bytes, version ${version}${haveIcon ? ', icon: yes' : ', icon: skipped'})`);
log(`bundle identifier: com.bdmorin.a2glimpse`);
log(`unsigned. To sign + notarize see knowledge/*apple-developer-onboarding*`);
