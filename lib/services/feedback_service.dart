import 'package:flutter/services.dart';

/// Centralized haptic/audio feedback service for barcode scans and UI interactions.
/// Replaces the duplicated MethodChannel + _triggerFeedback() pattern that was
/// copy-pasted across 5 separate files.
class FeedbackService {
  FeedbackService._();

  static const _channel = MethodChannel('com.sarisari.inventory/scan_feedback');

  /// Triggers device feedback (beep + vibration) via the native Android channel.
  ///
  /// [volume] — beep loudness (0-100).
  /// [vibrationStrength] — vibration intensity (0-100).
  /// [vibrateDuration] — optional vibration duration in ms (defaults to native default).
  static Future<void> trigger({
    required int volume,
    required int vibrationStrength,
    int? vibrateDuration,
  }) async {
    try {
      await _channel.invokeMethod('playScanFeedback', {
        'volume': volume,
        'vibrateStrength': vibrationStrength,
        if (vibrateDuration != null) 'vibrateDuration': vibrateDuration,
      });
    } catch (_) {}
  }
}
