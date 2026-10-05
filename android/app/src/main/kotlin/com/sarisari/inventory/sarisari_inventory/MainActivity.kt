package com.sarisari.inventory.sarisari_inventory

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Vibrator
import android.os.VibrationEffect
import android.os.Build
import android.content.Context
import android.content.Intent
import android.bluetooth.BluetoothAdapter
import android.provider.Settings

class MainActivity : FlutterActivity() {
    private val CHANNEL = "com.sarisari.inventory/scan_feedback"
    private val BT_CHANNEL = "com.sarisari.inventory/bluetooth"
    private val REQUEST_ENABLE_BT = 1001

    private var bluetoothResult: MethodChannel.Result? = null

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        // Scan feedback channel (beep + vibration)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL).setMethodCallHandler { call, result ->
            if (call.method == "playScanFeedback") {
                val volume = call.argument<Int>("volume") ?: 80
                val vibrateStrength = call.argument<Int>("vibrateStrength") ?: 50
                val vibrateDuration = call.argument<Int>("vibrateDuration")?.toLong() ?: 120L

                // 1. Play Beep Sound (ToneGenerator)
                if (volume > 0) {
                    try {
                        val toneGen = ToneGenerator(AudioManager.STREAM_MUSIC, volume)
                        toneGen.startTone(ToneGenerator.TONE_PROP_BEEP, 150)
                    } catch (e: Exception) {
                        // Suppress beep error
                    }
                }

                // 2. Play Vibration (Vibrator)
                if (vibrateStrength > 0) {
                    try {
                        val vibrator = getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
                        // Scale 0-100 to 1-255 amplitude
                        val amplitude = (vibrateStrength * 2.55).toInt().coerceIn(1, 255)

                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                            vibrator.vibrate(VibrationEffect.createOneShot(vibrateDuration, amplitude))
                        } else {
                            @Suppress("DEPRECATION")
                            vibrator.vibrate(vibrateDuration)
                        }
                    } catch (e: Exception) {
                        // Suppress vibration error
                    }
                }

                result.success(true)
            } else {
                result.notImplemented()
            }
        }

        // Bluetooth management channel
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, BT_CHANNEL).setMethodCallHandler { call, result ->
            when (call.method) {
                "enableBluetooth" -> {
                    try {
                        val enableBtIntent = Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE)
                        bluetoothResult = result
                        startActivityForResult(enableBtIntent, REQUEST_ENABLE_BT)
                    } catch (e: Exception) {
                        result.success(false)
                    }
                }
                "openBluetoothSettings" -> {
                    try {
                        val intent = Intent(Settings.ACTION_BLUETOOTH_SETTINGS)
                        startActivity(intent)
                        result.success(true)
                    } catch (e: Exception) {
                        result.success(false)
                    }
                }
                else -> result.notImplemented()
            }
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == REQUEST_ENABLE_BT) {
            bluetoothResult?.success(resultCode == RESULT_OK)
            bluetoothResult = null
        }
    }
}
