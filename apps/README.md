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

## Multiplayer proxy restoration (0.2.0)

The UGN website previously cleared the upstream client's proxy list, which also removed proxies from the Windows and macOS apps. Version 0.2.0 restores the four upstream community proxies in the compiled browser client and includes them in a desktop **Proxies** menu. Select **Multiplayer → Proxy → Manage proxies** for manual control, or choose one of the four third-party community endpoints from the desktop menu. A selected provider's URL is passed only to the UGN game using an allowlisted `proxy` query parameter. No game connection is automatic.

**Privacy and hosting:** These are external community transport relays, not in-house UGN infrastructure, and their availability is not guaranteed. Do not send account credentials through a provider unless you trust it. A UGN-owned self-hosted WSS relay remains the recommended production configuration for `play.universalgaming.us:25578`. Android and iOS shells load the same updated web client, so the proxy settings in multiplayer are also restored there; the native desktop menu is Windows/macOS only.

## Version 0.3.0 — latency-based automatic relay choice

**Auto · Lowest ping** is the default for fresh installations. It checks the UGN first-party relay and the existing community alternatives concurrently and chooses the lowest *measured network latency* among responders; a down relay is skipped. The UGN relay is **not** forced while it awaits hosting, DNS and TLS setup. Players who previously selected a proxy manually retain that manual selection, with UGN added to the optional list. Windows/macOS includes a UGN Private option; choosing it before hosting is configured will fail. Community relays are third-party services and should not be treated as in-house infrastructure. The iPhone/iPad and Android shells use the same updated browser-client selector.
