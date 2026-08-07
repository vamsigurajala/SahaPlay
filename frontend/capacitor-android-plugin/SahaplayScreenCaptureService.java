package com.sahaplay.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.PixelFormat;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.Image;
import android.media.ImageReader;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Build;
import android.os.IBinder;
import android.util.Base64;
import android.util.Log;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;

// Runs the real screen capture behind the "screen share" feature on the
// native Android build. The WebView the app is otherwise built on has no
// screen-capture API at all (that's why getDisplayMedia() always failed in
// Room.jsx, even inside the installed APK — a WebView limitation, not a
// browser-detection bug), so this bypasses the WebView entirely and drives
// Android's own MediaProjection API directly.
//
// Android requires MediaProjection capture to run inside an actually-started
// foreground service (not just from an Activity) for any app targeting API
// 29+ — frames silently come back blank otherwise — and a visible capture
// notification is a hard OS requirement while it runs, same as every other
// screen-share app (WhatsApp, Zoom, Discord).
//
// Captured frames are JPEG-compressed and Base64-encoded, then handed to
// SahaplayMediaPlugin to relay into the WebView via notifyListeners(). The
// JS side (see lib/nativeScreenShare.js + Room.jsx's startScreenshare) draws
// each frame onto a <canvas> and calls canvas.captureStream() to turn it
// into a real MediaStream — the exact same trick Room.jsx's screenshare
// "enhancement filter" pipeline already uses, so it drops straight into the
// existing WebRTC broadcast code with zero changes there.
public class SahaplayScreenCaptureService extends Service {
    public static final String EXTRA_RESULT_CODE = "resultCode";
    public static final String EXTRA_RESULT_DATA = "resultData";
    public static final String EXTRA_WIDTH = "width";
    public static final String EXTRA_HEIGHT = "height";
    public static final String EXTRA_DENSITY = "density";

    private static final String CHANNEL_ID = "sahaplay_screen_capture";
    private static final int NOTIFICATION_ID = 4471;
    // ~12fps — smooth enough for screen share while keeping the JPEG-encode
    // cost and the JSON/Base64 payload size over the WebView bridge sane.
    private static final long MIN_FRAME_INTERVAL_MS = 80;

    private MediaProjection mediaProjection;
    private VirtualDisplay virtualDisplay;
    private ImageReader imageReader;
    private long lastFrameAt = 0;

    private final MediaProjection.Callback projectionCallback = new MediaProjection.Callback() {
        @Override
        public void onStop() {
            // Fires when the user stops sharing from the OS's own capture
            // indicator (status bar / quick settings), not through our UI —
            // tell the JS side so it can tear down the WebRTC broadcast too.
            SahaplayMediaPlugin.emitScreenCaptureStopped();
            stopSelf();
        }
    };

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, buildNotification(), ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION);
        } else {
            startForeground(NOTIFICATION_ID, buildNotification());
        }

        if (intent == null) {
            stopSelf();
            return START_NOT_STICKY;
        }

        int resultCode = intent.getIntExtra(EXTRA_RESULT_CODE, -1);
        Intent resultData = intent.getParcelableExtra(EXTRA_RESULT_DATA);
        int width = intent.getIntExtra(EXTRA_WIDTH, 1080);
        int height = intent.getIntExtra(EXTRA_HEIGHT, 1920);
        int density = intent.getIntExtra(EXTRA_DENSITY, 320);

        if (resultData == null) {
            stopSelf();
            return START_NOT_STICKY;
        }

        MediaProjectionManager mgr = (MediaProjectionManager) getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        mediaProjection = mgr.getMediaProjection(resultCode, resultData);
        mediaProjection.registerCallback(projectionCallback, null);

        imageReader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 2);
        imageReader.setOnImageAvailableListener(reader -> onImageAvailable(reader), null);

        virtualDisplay = mediaProjection.createVirtualDisplay(
            "SahaplayScreenCapture",
            width, height, density,
            DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
            imageReader.getSurface(), null, null
        );

        return START_NOT_STICKY;
    }

    private void onImageAvailable(ImageReader reader) {
        Image image = null;
        try {
            image = reader.acquireLatestImage();
            if (image == null) return;

            long now = System.currentTimeMillis();
            if (now - lastFrameAt < MIN_FRAME_INTERVAL_MS) return;
            lastFrameAt = now;

            Image.Plane plane = image.getPlanes()[0];
            ByteBuffer buffer = plane.getBuffer();
            int pixelStride = plane.getPixelStride();
            int rowStride = plane.getRowStride();
            int rowPadding = rowStride - pixelStride * image.getWidth();

            Bitmap bitmap = Bitmap.createBitmap(
                image.getWidth() + rowPadding / pixelStride, image.getHeight(), Bitmap.Config.ARGB_8888
            );
            bitmap.copyPixelsFromBuffer(buffer);
            if (rowPadding != 0) {
                bitmap = Bitmap.createBitmap(bitmap, 0, 0, image.getWidth(), image.getHeight());
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            bitmap.compress(Bitmap.CompressFormat.JPEG, 55, out);
            String base64 = Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
            SahaplayMediaPlugin.emitScreenFrame(base64, image.getWidth(), image.getHeight());
        } catch (Exception e) {
            Log.e("SahaplayScreenCapture", "Frame capture failed", e);
        } finally {
            if (image != null) image.close();
        }
    }

    private Notification buildNotification() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID, "Screen Sharing", NotificationManager.IMPORTANCE_LOW
            );
            nm.createNotificationChannel(channel);
        }
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("SahaPlay")
            .setContentText("Your screen is being shared")
            .setSmallIcon(android.R.drawable.ic_menu_share)
            .setOngoing(true)
            .build();
    }

    @Override
    public void onDestroy() {
        if (virtualDisplay != null) virtualDisplay.release();
        if (imageReader != null) imageReader.close();
        if (mediaProjection != null) {
            mediaProjection.unregisterCallback(projectionCallback);
            mediaProjection.stop();
        }
        super.onDestroy();
    }
}
