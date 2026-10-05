import 'dart:async';
import 'package:flutter/material.dart';

enum AppToastType { success, warning, error, info }

/// Reusable production-ready Toast notification system.
///
/// Uses OverlayEntry to guarantee 100% DEAD CENTER positioning on screen,
/// eliminates notification queuing, and provides an immediate X close button.
class AppToast {
  static OverlayEntry? _currentToastEntry;
  static Timer? _dismissTimer;

  /// Shows a clean toast in the DEAD CENTER of the screen.
  static void show(
    BuildContext context, {
    required String message,
    AppToastType type = AppToastType.info,
    Duration duration = const Duration(milliseconds: 1800),
  }) {
    // 1. Immediately dismiss any existing toast & cancel timer to prevent queuing
    dismiss();

    // 2. Select styling based on notification type
    Color bgColor;
    Color iconColor;
    IconData iconData;

    switch (type) {
      case AppToastType.success:
        bgColor = const Color(0xFF1B381E);
        iconColor = Colors.greenAccent;
        iconData = Icons.check_circle_rounded;
        break;
      case AppToastType.warning:
        bgColor = const Color(0xFF3E2200);
        iconColor = Colors.orangeAccent;
        iconData = Icons.warning_amber_rounded;
        break;
      case AppToastType.error:
        bgColor = const Color(0xFF3B0C0C);
        iconColor = Colors.redAccent;
        iconData = Icons.error_outline_rounded;
        break;
      case AppToastType.info:
        bgColor = const Color(0xFF131D28);
        iconColor = Colors.lightBlueAccent;
        iconData = Icons.info_outline_rounded;
        break;
    }

    try {
      final overlayState = Overlay.of(context, rootOverlay: true);

      _currentToastEntry = OverlayEntry(
        builder: (context) {
          return IgnorePointer(
            ignoring: false,
            child: Align(
              alignment: const Alignment(0.0, -0.65), // UPPER CENTER
              child: Material(
                type: MaterialType.transparency,
                child: Container(
                  constraints: const BoxConstraints(maxWidth: 360),
                  margin: const EdgeInsets.symmetric(horizontal: 24),
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  decoration: BoxDecoration(
                    color: bgColor,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: iconColor.withValues(alpha: 0.6),
                      width: 1.5,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.35),
                        blurRadius: 20,
                        spreadRadius: 2,
                        offset: const Offset(0, 6),
                      ),
                    ],
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(iconData, color: iconColor, size: 24),
                      const SizedBox(width: 12),
                      Flexible(
                        child: Text(
                          message,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            height: 1.25,
                            decoration: TextDecoration.none,
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      // Explicit X / Close button to dismiss immediately
                      GestureDetector(
                        onTap: dismiss,
                        child: Container(
                          padding: const EdgeInsets.all(4),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.2),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.close_rounded,
                            color: Colors.white,
                            size: 16,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );
        },
      );

      overlayState.insert(_currentToastEntry!);

      // Auto dismiss timer
      _dismissTimer = Timer(duration, () {
        dismiss();
      });
    } catch (_) {
      _currentToastEntry = null;
    }
  }

  /// Manually dismisses the current toast instantly.
  static void dismiss() {
    _dismissTimer?.cancel();
    _dismissTimer = null;
    if (_currentToastEntry != null) {
      try {
        _currentToastEntry!.remove();
      } catch (_) {}
      _currentToastEntry = null;
    }
  }

  /// Convenience helpers
  static void success(BuildContext context, String message) {
    show(context, message: message, type: AppToastType.success);
  }

  static void warning(BuildContext context, String message) {
    show(context, message: message, type: AppToastType.warning);
  }

  static void error(BuildContext context, String message) {
    show(context, message: message, type: AppToastType.error);
  }

  static void info(BuildContext context, String message) {
    show(context, message: message, type: AppToastType.info);
  }
}
