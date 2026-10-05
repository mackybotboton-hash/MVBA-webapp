import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../providers/settings_provider.dart';
import '../services/license_service.dart';
import '../widgets/app_toast.dart';
import '../utils/app_constants.dart';

class PinLockScreen extends StatefulWidget {
  final bool isStartup;
  final VoidCallback? onUnlocked;

  const PinLockScreen({
    super.key,
    required this.isStartup,
    this.onUnlocked,
  });

  @override
  State<PinLockScreen> createState() => _PinLockScreenState();
}

class _PinLockScreenState extends State<PinLockScreen> with SingleTickerProviderStateMixin {
  static const _feedbackChannel = MethodChannel('com.sarisari.inventory/scan_feedback');
  final List<int> _enteredPin = [];
  String _errorMessage = '';
  late AnimationController _shakeController;
  late Animation<double> _shakeAnimation;

  @override
  void initState() {
    super.initState();
    _shakeController = AnimationController(
      duration: const Duration(milliseconds: 500),
      vsync: this,
    );
    _shakeAnimation = Tween<double>(begin: 0.0, end: 12.0)
        .chain(CurveTween(curve: Curves.elasticIn))
        .animate(_shakeController);
  }

  @override
  void dispose() {
    _shakeController.dispose();
    super.dispose();
  }

  Future<void> _playFeedback({required int volume, required int vibrate, int? duration}) async {
    try {
      await _feedbackChannel.invokeMethod('playScanFeedback', {
        'volume': volume,
        'vibrateStrength': vibrate,
        if (duration != null) 'vibrateDuration': duration,
      });
    } catch (_) {}
  }

  void _onKeyPress(int digit) {
    if (_enteredPin.length >= 4) return;

    _playFeedback(volume: 0, vibrate: 50, duration: 60); // Snappy keyboard tap feel
    setState(() {
      _errorMessage = '';
      _enteredPin.add(digit);
    });

    if (_enteredPin.length == 4) {
      _verifyPin();
    }
  }

  void _onBackspace() {
    if (_enteredPin.isEmpty) return;
    _playFeedback(volume: 0, vibrate: 40, duration: 50);
    setState(() {
      _errorMessage = '';
      _enteredPin.removeLast();
    });
  }

  void _onClear() {
    if (_enteredPin.isEmpty) return;
    _playFeedback(volume: 0, vibrate: 40, duration: 50);
    setState(() {
      _errorMessage = '';
      _enteredPin.clear();
    });
  }

  Future<void> _showForgotPinDialog() async {
    final settings = Provider.of<SettingsProvider>(context, listen: false);
    final deviceId = settings.deviceId.isNotEmpty ? settings.deviceId : await LicenseService.getDeviceId();
    final challengeCode = LicenseService.generatePinChallengeCode(deviceId);

    if (!mounted) return;

    final pinController = TextEditingController();

    showDialog(
      context: context,
      builder: (dialogCtx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Row(
          children: [
            Icon(Icons.lock_reset_rounded, color: AppColors.primary, size: 28),
            SizedBox(width: 10),
            Text(
              'PIN Recovery',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
            ),
          ],
        ),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Nakalimutan mo ba ang iyong 4-digit PIN?\n\n'
                'Makipag-ugnayan sa Developer (Mark Vincent B. Alegre - 09514110886) at ibigay ang Recovery Code na ito upang makuha ang iyong Master Unlock PIN:',
                style: TextStyle(fontSize: 13, height: 1.4, color: Colors.black87),
              ),
              const SizedBox(height: 14),

              // Challenge Code Banner with Copy Button
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                decoration: BoxDecoration(
                  color: AppColors.surfaceLight,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.surfaceBorder),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'RECOVERY CODE:',
                          style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.secondary),
                        ),
                        Text(
                          challengeCode,
                          style: const TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 2,
                            color: AppColors.primary,
                          ),
                        ),
                      ],
                    ),
                    IconButton(
                      icon: const Icon(Icons.copy_rounded, color: AppColors.primary, size: 20),
                      tooltip: 'Kopyahin ang Code',
                      onPressed: () {
                        Clipboard.setData(ClipboardData(text: challengeCode));
                        AppToast.info(context, 'Na-kopyang Recovery Code: $challengeCode');
                      },
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              const Text(
                'Ilagay ang 4-digit Master PIN mula sa Developer:',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.black87),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: pinController,
                keyboardType: TextInputType.number,
                maxLength: 4,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, letterSpacing: 8),
                decoration: InputDecoration(
                  hintText: '••••',
                  counterText: '',
                  filled: true,
                  fillColor: Colors.grey[100],
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogCtx),
            child: const Text('Kanselahin', style: TextStyle(color: Colors.grey)),
          ),
          ElevatedButton(
            onPressed: () async {
              final entered = pinController.text.trim();
              if (entered.length != 4) {
                AppToast.error(context, 'Mangyaring maglagay ng 4-digit Master PIN.');
                return;
              }

              final isValid = LicenseService.verifyMasterPin(entered, challengeCode) ||
                  LicenseService.verifyMasterPin(entered, deviceId);

              if (isValid) {
                Navigator.pop(dialogCtx);
                await settings.resetOwnerPin();
                
                if (!mounted) return;
                AppToast.success(context, 'Na-unlock ang app! Na-reset na ang iyong PIN.');

                if (!widget.isStartup) {
                  Navigator.pop(context, true);
                }
                if (widget.onUnlocked != null) {
                  widget.onUnlocked!();
                }
              } else {
                AppToast.error(context, 'Maling Master PIN. Pakisubukang muli.');
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            child: const Text('I-unlock ang App'),
          ),
        ],
      ),
    );
  }

  void _verifyPin() {
    final settings = Provider.of<SettingsProvider>(context, listen: false);
    final correctPin = settings.ownerPin;
    final pinStr = _enteredPin.join();

    if (pinStr == correctPin || LicenseService.verifyMasterPin(pinStr, settings.deviceId)) {
      _playFeedback(volume: 25, vibrate: 70, duration: 200); // Clear success pulse
      if (!widget.isStartup) {
        Navigator.pop(context, true); // Close the PIN screen first and return true
      }
      if (widget.onUnlocked != null) {
        widget.onUnlocked!();
      }
    } else {
      _playFeedback(volume: 60, vibrate: 100, duration: 500); // Strong shake alert
      _shakeController.forward(from: 0.0);
      setState(() {
        _errorMessage = 'Maling PIN. Pakisubukang muli.';
        _enteredPin.clear();
      });
    }
  }

  Widget _buildPinDot(int index) {
    final isFilled = _enteredPin.length > index;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 150),
      margin: const EdgeInsets.symmetric(horizontal: 10),
      width: 18,
      height: 18,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: isFilled ? AppColors.primary : Colors.transparent,
        border: Border.all(
          color: isFilled ? AppColors.primary : Colors.grey.shade400,
          width: 2.5,
        ),
        boxShadow: isFilled
            ? [BoxShadow(color: AppColors.primary.withAlpha(76), blurRadius: 6, spreadRadius: 1)]
            : [],
      ),
    );
  }

  Widget _buildKeypadButton(String text, {Widget? icon, VoidCallback? onPressed}) {
    return InkWell(
      onTap: onPressed,
      borderRadius: BorderRadius.circular(40),
      child: Container(
        width: 70,
        height: 70,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: Colors.grey.shade50,
          border: Border.all(color: Colors.grey.shade200, width: 1),
          boxShadow: [
            BoxShadow(color: Colors.black.withAlpha(5), blurRadius: 2, offset: const Offset(0, 1))
          ],
        ),
        child: Center(
          child: icon ?? Text(
            text,
            style: const TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: Color(0xFF212121),
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final storeName = Provider.of<SettingsProvider>(context).storeName;

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: !widget.isStartup
            ? IconButton(
                icon: const Icon(Icons.arrow_back_rounded, color: Colors.black87),
                onPressed: () => Navigator.pop(context),
              )
            : null,
      ),
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            return SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24.0),
              child: ConstrainedBox(
                constraints: BoxConstraints(
                  minHeight: constraints.maxHeight - 24,
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    // Top Lock Icon & Store Branding
                    Column(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: AppColors.surfaceLight,
                            shape: BoxShape.circle,
                            border: Border.all(color: AppColors.surfaceBorder, width: 1),
                          ),
                          child: const Icon(
                            Icons.lock_rounded,
                            size: 40,
                            color: AppColors.primary,
                          ),
                        ),
                        const SizedBox(height: 16),
                        Text(
                          storeName,
                          style: const TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.bold,
                            color: AppColors.primary,
                          ),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 8),
                        const Text(
                          'Naka-lock ang App (Security PIN)',
                          style: TextStyle(
                            fontSize: 14,
                            color: Colors.grey,
                            fontWeight: FontWeight.w500,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),

                    // Dot Progress Indicator
                    Column(
                      children: [
                        AnimatedBuilder(
                          animation: _shakeAnimation,
                          builder: (context, child) {
                            return Transform.translate(
                              offset: Offset(_shakeAnimation.value * (1 - 2 * (_enteredPin.length % 2)), 0),
                              child: child,
                            );
                          },
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: List.generate(4, (index) => _buildPinDot(index)),
                          ),
                        ),
                        const SizedBox(height: 16),
                        SizedBox(
                          height: 24,
                          child: Text(
                            _errorMessage,
                            style: TextStyle(
                              color: Colors.red[800],
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ),
                      ],
                    ),

                    // Numeric Keyboard layout
                    Container(
                      constraints: const BoxConstraints(maxWidth: 280),
                      child: Column(
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                            children: [
                              _buildKeypadButton('1', onPressed: () => _onKeyPress(1)),
                              _buildKeypadButton('2', onPressed: () => _onKeyPress(2)),
                              _buildKeypadButton('3', onPressed: () => _onKeyPress(3)),
                            ],
                          ),
                          const SizedBox(height: 16),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                            children: [
                              _buildKeypadButton('4', onPressed: () => _onKeyPress(4)),
                              _buildKeypadButton('5', onPressed: () => _onKeyPress(5)),
                              _buildKeypadButton('6', onPressed: () => _onKeyPress(6)),
                            ],
                          ),
                          const SizedBox(height: 16),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                            children: [
                              _buildKeypadButton('7', onPressed: () => _onKeyPress(7)),
                              _buildKeypadButton('8', onPressed: () => _onKeyPress(8)),
                              _buildKeypadButton('9', onPressed: () => _onKeyPress(9)),
                            ],
                          ),
                          const SizedBox(height: 16),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                            children: [
                              _buildKeypadButton('C', onPressed: _onClear),
                              _buildKeypadButton('0', onPressed: () => _onKeyPress(0)),
                              _buildKeypadButton(
                                '',
                                icon: const Icon(Icons.backspace_outlined, size: 22, color: Colors.black87),
                                onPressed: _onBackspace,
                              ),
                            ],
                          ),
                          const SizedBox(height: 20),
                          // Forgot PIN Recovery Action Button
                          TextButton.icon(
                            onPressed: _showForgotPinDialog,
                            icon: const Icon(Icons.help_outline_rounded, size: 16, color: AppColors.secondary),
                            label: const Text(
                              'Nakalimutan ang PIN?',
                              style: TextStyle(
                                fontSize: 13,
                                color: AppColors.secondary,
                                fontWeight: FontWeight.bold,
                                decoration: TextDecoration.underline,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}
