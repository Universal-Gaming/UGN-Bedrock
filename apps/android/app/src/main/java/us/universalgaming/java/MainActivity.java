package us.universalgaming.java;

import android.app.Activity;
import android.os.Build;
import android.os.Bundle;
import android.content.Intent;
import android.net.Uri;
import android.view.View;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.PermissionRequest;
import android.widget.FrameLayout;
import android.widget.Toast;

public final class MainActivity extends Activity {
    private static final String HOME = "https://universal-gaming.github.io/UGN-Bedrock/";
    private WebView game;
    private FrameLayout root;
    private View fullscreenView;
    private WebChromeClient.CustomViewCallback fullscreenCallback;

    static boolean isUGNUrl(String value) {
        try {
            Uri uri = Uri.parse(value);
            String path = uri.getPath();
            return "https".equals(uri.getScheme()) &&
              "universal-gaming.github.io".equals(uri.getHost()) &&
              path != null && (path.equals("/UGN-Bedrock") || path.startsWith("/UGN-Bedrock/"));
        } catch (RuntimeException ignored) { return false; }
    }
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        root = new FrameLayout(this);
        root.setBackgroundColor(0xff070b18);
        game = new WebView(this);
        game.setBackgroundColor(0xff070b18);
        game.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        WebSettings settings = game.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);
        if (Build.VERSION.SDK_INT >= 26) WebView.startSafeBrowsing(this, result -> {});
        game.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (isUGNUrl(uri.toString())) return false;
                if ("https".equals(uri.getScheme())) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); }
                    catch (Exception ignored) { Toast.makeText(MainActivity.this, "No browser available", Toast.LENGTH_SHORT).show(); }
                }
                return true;
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, android.webkit.WebResourceError error) {
                if (request.isForMainFrame()) Toast.makeText(MainActivity.this,
                  "UGN needs an internet connection.", Toast.LENGTH_LONG).show();
            }
        });
        game.setWebChromeClient(new WebChromeClient() {
            @Override public void onPermissionRequest(PermissionRequest req) { req.deny(); }
            @Override public void onShowCustomView(View view, CustomViewCallback callback) {
                if (fullscreenView != null) { callback.onCustomViewHidden(); return; }
                fullscreenView = view; fullscreenCallback = callback;
                game.setVisibility(View.GONE);
                root.addView(view, new FrameLayout.LayoutParams(-1,-1));
            }
            @Override public void onHideCustomView() { exitFullscreen(); }
        });
        root.addView(game, new FrameLayout.LayoutParams(-1,-1));
        setContentView(root);
        if (state == null) game.loadUrl(HOME); else game.restoreState(state);
    }
    private void exitFullscreen() {
        if (fullscreenView == null) return;
        root.removeView(fullscreenView); fullscreenView=null;
        game.setVisibility(View.VISIBLE);
        if (fullscreenCallback != null) fullscreenCallback.onCustomViewHidden();
        fullscreenCallback=null;
    }
    @Override public void onBackPressed() {
        if (fullscreenView != null) { exitFullscreen(); return; }
        if (game != null && game.canGoBack()) game.goBack();
        else super.onBackPressed();
    }
    @Override protected void onSaveInstanceState(Bundle state) {
        if (game != null) game.saveState(state);
        super.onSaveInstanceState(state);
    }
    @Override protected void onDestroy() {
        if (game != null) { root.removeView(game); game.destroy(); game=null; }
        super.onDestroy();
    }
}
