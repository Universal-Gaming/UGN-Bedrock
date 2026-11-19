# UGN Java apps — first-party shells
All apps load the official UGN Java game website. They do not contain a separate native Minecraft engine, and require internet to load game assets.

- Windows x64: Electron NSIS installer, unsigned test build.
- macOS Intel / Apple Silicon: Electron DMG, unsigned test build.
- Android: native WebView APK, debug-signed for preview testing.
- iPhone / iPad: Add to Home Screen in Safari for an immediately usable web app.
- iOS native: SwiftUI / WKWebView source and simulator build. A device-installable IPA requires your Apple Developer signing team, certificate and provisioning profile.

Build installers using the Build UGN Apps GitHub Action. A single apps-preview GitHub pre-release will hold uploaded binaries only after all required build jobs pass. Download links on the homepage use real release assets; they never invent a download.

Security: external navigation is blocked or handed to the system browser. No Node integration in Electron; no JavaScript bridge in Android/iOS. Camera/microphone permission is not automatically granted.

World saves are scoped to each app's browser storage. Firefox or Chrome singleplayer saves do not automatically appear in an Electron, Android, or Apple app. Export/import your worlds using the upstream client tools when supported.

Signing: unsigned desktop apps can warn in Gatekeeper/SmartScreen. Android debug APK is not intended as a final public store release. Before official app-store distribution, create production signing identities, verify licenses, test on devices, and follow platform requirements.
