package com.xiantinghua.couplespace;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.os.Build;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final int MEDIA_PERMISSION_REQUEST = 1001;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        boolean audioMissing = ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
                != PackageManager.PERMISSION_GRANTED;
        boolean cameraMissing = ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
                != PackageManager.PERMISSION_GRANTED;
        boolean notificationsMissing = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED;
        if (audioMissing || cameraMissing || notificationsMissing) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ActivityCompat.requestPermissions(
                    this,
                    new String[] { Manifest.permission.RECORD_AUDIO, Manifest.permission.CAMERA, Manifest.permission.POST_NOTIFICATIONS },
                    MEDIA_PERMISSION_REQUEST
            );
            } else {
                ActivityCompat.requestPermissions(
                        this,
                        new String[] { Manifest.permission.RECORD_AUDIO, Manifest.permission.CAMERA },
                        MEDIA_PERMISSION_REQUEST
                );
            }
        }
    }
}
