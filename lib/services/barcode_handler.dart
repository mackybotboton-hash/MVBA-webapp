import 'package:flutter/services.dart';

/// Reusable handler for hardware barcode scanners that act as keyboard input.
///
/// Barcode scanners typically send characters rapidly (< 100ms between keystrokes)
/// followed by an Enter key. This handler buffers rapid keystrokes and emits the
/// complete barcode string when Enter is pressed.
///
/// Replaces duplicate implementations in sales_screen.dart and add_edit_product_screen.dart.
class HardwareBarcodeHandler {
  final StringBuffer _buffer = StringBuffer();
  DateTime? _lastKeyTime;

  /// The minimum number of characters to consider a valid barcode.
  final int minBarcodeLength;

  /// Maximum gap in milliseconds between keystrokes before the buffer is cleared.
  /// Barcode scanners typically send characters with < 50ms gaps.
  final int debounceMs;

  HardwareBarcodeHandler({
    this.minBarcodeLength = 3,
    this.debounceMs = 150,
  });

  /// Process a [KeyEvent] from a hardware keyboard listener.
  ///
  /// Returns the decoded barcode string if a complete scan is detected,
  /// or `null` if the event was consumed but no complete barcode is ready yet.
  String? handleKeyEvent(KeyEvent event) {
    if (event is! KeyDownEvent) return null;

    final now = DateTime.now();

    // If too much time has passed since last keystroke, start fresh
    if (_lastKeyTime != null && now.difference(_lastKeyTime!).inMilliseconds > debounceMs) {
      _buffer.clear();
    }
    _lastKeyTime = now;

    final key = event.logicalKey;

    // Check for terminator keys (Enter, Numpad Enter, Tab, or newline characters)
    final isTerminator = key == LogicalKeyboardKey.enter ||
        key == LogicalKeyboardKey.numpadEnter ||
        key == LogicalKeyboardKey.tab ||
        event.character == '\n' ||
        event.character == '\r';

    if (isTerminator) {
      final code = _buffer.toString().trim();
      _buffer.clear();
      if (code.length >= minBarcodeLength) {
        return code;
      }
      return null;
    }

    // Ignore non-printable control/modifier keys
    if (event.character != null &&
        event.character!.isNotEmpty &&
        event.character != '\x00') {
      _buffer.write(event.character);
    }

    return null;
  }

  /// Clears the internal buffer.
  void clear() {
    _buffer.clear();
    _lastKeyTime = null;
  }

  /// Clears the internal buffer. Call this when disposing the parent widget.
  void dispose() {
    clear();
  }
}
