import 'dart:ui';
import 'package:flutter/material.dart';
import '../utils/app_constants.dart';

/// Production-grade loading overlay widget with backdrop blur,
/// smooth animated spring entrance/exit, pulsing glow, and accessibility support.
///
/// Uses OverlayEntry to guarantee zero lockups and zero conflicts
/// with Navigator route dialogs or bottom sheets.
class AppLoadingOverlay extends StatefulWidget {
  final String message;
  final double? progress;
  final Color barrierColor;

  const AppLoadingOverlay({
    super.key,
    this.message = 'Nagpo-proseso...',
    this.progress,
    this.barrierColor = const Color(0x73000000),
  });

  /// Currently active OverlayEntry
  static OverlayEntry? _currentEntry;
  static _AppLoadingOverlayState? _currentState;

  /// Shows the full-screen modal loading overlay via root Overlay.
  static void show(BuildContext context, {String message = 'Nagpo-proseso...'}) {
    hide();

    try {
      final overlayState = Overlay.of(context, rootOverlay: true);
      _currentEntry = OverlayEntry(
        builder: (context) => PopScope(
          canPop: false,
          child: AppLoadingOverlay(message: message),
        ),
      );

      overlayState.insert(_currentEntry!);
    } catch (_) {
      _currentEntry = null;
    }
  }

  /// Hides the active modal loading overlay smoothly with reverse animation.
  static void hide([BuildContext? context]) {
    if (_currentState != null) {
      _currentState!._animateOut().then((_) {
        if (_currentEntry != null) {
          try {
            _currentEntry!.remove();
          } catch (_) {}
          _currentEntry = null;
          _currentState = null;
        }
      });
    } else if (_currentEntry != null) {
      try {
        _currentEntry!.remove();
      } catch (_) {}
      _currentEntry = null;
    }
  }

  /// Convenience helper to run an asynchronous task while showing the overlay.
  static Future<T> runWithLoading<T>({
    required BuildContext context,
    required String message,
    required Future<T> Function() asyncTask,
  }) async {
    show(context, message: message);
    try {
      final result = await asyncTask();
      return result;
    } finally {
      hide();
    }
  }

  @override
  State<AppLoadingOverlay> createState() => _AppLoadingOverlayState();
}

class _AppLoadingOverlayState extends State<AppLoadingOverlay>
    with TickerProviderStateMixin {
  late AnimationController _entranceController;
  late AnimationController _pulseController;
  late Animation<double> _fadeAnimation;
  late Animation<double> _scaleAnimation;
  late Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();
    AppLoadingOverlay._currentState = this;

    // Entrance Animation (280ms smooth curve)
    _entranceController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 280),
    );

    _fadeAnimation = CurvedAnimation(
      parent: _entranceController,
      curve: Curves.easeOutCubic,
    );

    _scaleAnimation = Tween<double>(begin: 0.90, end: 1.0).animate(
      CurvedAnimation(
        parent: _entranceController,
        curve: Curves.easeOutBack,
      ),
    );

    // Continuous Subtle Pulse Animation for inner badge (1400ms cycle)
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat(reverse: true);

    _pulseAnimation = Tween<double>(begin: 0.96, end: 1.06).animate(
      CurvedAnimation(
        parent: _pulseController,
        curve: Curves.easeInOutSine,
      ),
    );

    _entranceController.forward();
  }

  Future<void> _animateOut() async {
    if (mounted) {
      await _entranceController.reverse();
    }
  }

  @override
  void dispose() {
    if (AppLoadingOverlay._currentState == this) {
      AppLoadingOverlay._currentState = null;
    }
    _entranceController.dispose();
    _pulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: widget.message,
      liveRegion: true,
      child: Material(
        type: MaterialType.transparency,
        child: FadeTransition(
          opacity: _fadeAnimation,
          child: Stack(
            children: [
              // Blurred background filter
              Positioned.fill(
                child: BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: 6.0, sigmaY: 6.0),
                  child: Container(
                    color: widget.barrierColor,
                  ),
                ),
              ),
              Center(
                child: ScaleTransition(
                  scale: _scaleAnimation,
                  child: Container(
                    constraints: const BoxConstraints(maxWidth: 320),
                    padding: const EdgeInsets.symmetric(vertical: 26, horizontal: 26),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.18),
                          blurRadius: 28,
                          spreadRadius: 4,
                          offset: const Offset(0, 10),
                        ),
                      ],
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // Pulsing smooth indicator badge
                        ScaleTransition(
                          scale: _pulseAnimation,
                          child: Container(
                            padding: const EdgeInsets.all(18),
                            decoration: BoxDecoration(
                              color: AppColors.primary.withValues(alpha: 0.08),
                              shape: BoxShape.circle,
                              boxShadow: [
                                BoxShadow(
                                  color: AppColors.primary.withValues(alpha: 0.12),
                                  blurRadius: 16,
                                  spreadRadius: 2,
                                ),
                              ],
                            ),
                            child: SizedBox(
                              width: 44,
                              height: 44,
                              child: widget.progress != null
                                  ? CircularProgressIndicator(
                                      value: widget.progress,
                                      strokeWidth: 4,
                                      color: AppColors.primary,
                                      backgroundColor: AppColors.surfaceBorder,
                                    )
                                  : const CircularProgressIndicator(
                                      strokeWidth: 3.5,
                                      color: AppColors.primary,
                                      strokeCap: StrokeCap.round,
                                    ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 22),
                        Text(
                          widget.message,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            color: Colors.black87,
                            letterSpacing: -0.2,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          'Paki-intay habang kinukumpleto...',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 12,
                            color: Colors.grey[600],
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
