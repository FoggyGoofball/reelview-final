package com.reelview.app;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import android.util.Log;
import android.webkit.WebView;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Log.d("MainActivity", "? MainActivity.onCreate() - Bridge should be ready now");
    }
    
    @Override
    public void onResume() {
        super.onResume();
        Log.d("MainActivity", "? MainActivity.onResume() - WebView is now fully loaded");
        
        // Register the ReelViewWebViewClient AFTER Capacitor's Bridge is fully initialized
        // This must happen in a delayed manner to avoid interfering with initial page load
        try {
            WebView webView = getBridge() != null ? getBridge().getWebView() : null;
            if (webView != null && getBridge() != null) {
                // Delay slightly to ensure Capacitor has finished its setup
                webView.postDelayed(() -> {
                    try {
                        webView.setWebViewClient(new ReelViewWebViewClient(getBridge()));
                        Log.d("MainActivity", "? ReelViewWebViewClient registered for native ad blocking");
                    } catch (Exception e) {
                        Log.e("MainActivity", "Error registering ReelViewWebViewClient: " + e.getMessage());
                    }
                }, 500);
            } else {
                Log.w("MainActivity", "?? WebView or Bridge not available for ReelViewWebViewClient registration");
            }
        } catch (Exception e) {
            Log.e("MainActivity", "Error in onResume WebViewClient setup: " + e.getMessage());
        }
        
        // Register plugin after everything is ready
        if (getBridge() != null) {
            try {
                getBridge().registerPlugin(ChromecastPlugin.class);
                Log.d("MainActivity", "??? ChromecastPlugin REGISTERED in onResume");
            } catch (Exception e) {
                Log.e("MainActivity", "? Error registering ChromecastPlugin: " + e.getMessage());
                e.printStackTrace();
            }
        }
    }
}
