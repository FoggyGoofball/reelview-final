package com.reelview.app;

import android.app.IntentService;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.os.Build;
import android.util.Log;
import androidx.core.app.NotificationCompat;

public class DownloadService extends IntentService {
    private static final String TAG = "DownloadService";
    private static final int NOTIFICATION_ID = 1001;
    private static final String CHANNEL_ID = "downloads";

    public DownloadService() {
        super("DownloadService");
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    protected void onHandleIntent(Intent intent) {
        if (intent == null) return;

        String action = intent.getAction();
        Log.d(TAG, "onHandleIntent: " + action);

        if ("DOWNLOAD".equals(action)) {
            String downloadId = intent.getStringExtra("downloadId");
            String url = intent.getStringExtra("url");
            String filename = intent.getStringExtra("filename");

            Log.d(TAG, "Download started: " + downloadId);
            Log.d(TAG, "URL: " + url);
            Log.d(TAG, "Filename: " + filename);

            // TODO: Implement actual download logic
            // For now, just log and complete
            showNotification("Download", filename + " downloaded");
            Log.d(TAG, "Download completed: " + downloadId);
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Downloads",
                NotificationManager.IMPORTANCE_LOW
            );
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private void showNotification(String title, String message) {
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(message)
            .setSmallIcon(android.R.drawable.ic_dialog_info);

        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) {
            manager.notify(NOTIFICATION_ID, builder.build());
        }
    }
}
