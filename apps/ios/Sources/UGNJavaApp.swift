import SwiftUI
import WebKit

@main
struct UGNJavaApp: App {
    var body: some Scene {
        WindowGroup { UGNJavaView().ignoresSafeArea() }
    }
}
struct UGNJavaView: UIViewRepresentable {
    private let home = URL(string: "https://universal-gaming.github.io/UGN-Bedrock/")!
    func makeUIView(context: Context) -> WKWebView {
        let cfg = WKWebViewConfiguration()
        cfg.websiteDataStore = .default()
        cfg.defaultWebpagePreferences.allowsContentJavaScript = true
        let view = WKWebView(frame: .zero, configuration: cfg)
        view.navigationDelegate = context.coordinator
        view.uiDelegate = context.coordinator
        view.isOpaque = false
        view.backgroundColor = UIColor(red: 7/255, green: 11/255, blue: 24/255, alpha: 1)
        view.scrollView.contentInsetAdjustmentBehavior = .never
        view.allowsBackForwardNavigationGestures = true
        view.load(URLRequest(url: home))
        return view
    }
    func updateUIView(_ webView: WKWebView, context: Context) {}
    func makeCoordinator() -> Coordinator { Coordinator() }
    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
        func webView(_ view: WKWebView, decidePolicyFor action: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = action.request.url else { decisionHandler(.cancel); return }
            let isGame = url.scheme == "https" &&
                url.host == "universal-gaming.github.io" &&
                (url.path == "/UGN-Bedrock" || url.path.hasPrefix("/UGN-Bedrock/"))
            if isGame { decisionHandler(.allow); return }
            decisionHandler(.cancel)
            if url.scheme == "https" { DispatchQueue.main.async { UIApplication.shared.open(url) } }
        }
        func webView(_ view: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                     for action: WKNavigationAction,
                     windowFeatures: WKWindowFeatures) -> WKWebView? {
            if let url = action.request.url, url.scheme == "https" {
                UIApplication.shared.open(url)
            }
            return nil
        }
    }
}
