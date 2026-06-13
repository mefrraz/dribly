package pt.dribly.app;

import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onStart() {
        super.onStart();
        // Ensure WebView respects viewport meta tag and renders at proper scale
        WebView webView = getBridge().getWebView();
        webView.getSettings().setUseWideViewPort(true);
        webView.getSettings().setLoadWithOverviewMode(true);
        webView.setInitialScale(1);
    }
}
