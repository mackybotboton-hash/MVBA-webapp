import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../providers/settings_provider.dart';
import '../widgets/app_toast.dart';
import '../utils/app_constants.dart';

class LicenseLockScreen extends StatefulWidget {
  const LicenseLockScreen({super.key});

  @override
  State<LicenseLockScreen> createState() => _LicenseLockScreenState();
}

class _LicenseLockScreenState extends State<LicenseLockScreen> {
  final TextEditingController _keyController = TextEditingController();
  bool _isActivating = false;
  String _errorMessage = '';

  @override
  void dispose() {
    _keyController.dispose();
    super.dispose();
  }

  Future<void> _handleActivation(BuildContext context, SettingsProvider settings) async {
    final key = _keyController.text.trim();
    if (key.isEmpty) {
      setState(() {
        _errorMessage = settings.tr(
          'Mangyaring ilagay ang iyong Activation Key.',
          'Please enter your Activation Key.',
        );
      });
      return;
    }

    setState(() {
      _isActivating = true;
      _errorMessage = '';
    });

    // Short artificial delay to feel robust
    await Future.delayed(const Duration(milliseconds: 800));

    final result = await settings.activateLicense(key);

    if (!context.mounted) return;
    setState(() {
      _isActivating = false;
    });

    if (result.isValid) {
      FocusManager.instance.primaryFocus?.unfocus();
      AppToast.success(
        context,
        settings.tr(
          'Matagumpay na na-activate ang system!',
          'System activated successfully!',
        ),
      );
    } else {
      setState(() {
        _errorMessage = result.message;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final settings = Provider.of<SettingsProvider>(context);
    final isClockError = settings.isClockTempered;
    final deviceId = settings.deviceId;

    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F5),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 480),
            child: Card(
              elevation: 4,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(16),
                side: BorderSide(
                  color: isClockError ? Colors.red.shade300 : Colors.grey.shade300,
                  width: isClockError ? 1.5 : 1,
                ),
              ),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 32.0),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Top Icon Indicator
                    CircleAvatar(
                      radius: 36,
                      backgroundColor: isClockError ? Colors.red.shade50 : AppColors.surfaceLight,
                      child: Icon(
                        isClockError ? Icons.history_toggle_off_rounded : Icons.lock_outline_rounded,
                        size: 40,
                        color: isClockError ? Colors.red[800] : AppColors.primary,
                      ),
                    ),
                    const SizedBox(height: 24),

                    // App Title
                    Text(
                      settings.storeName,
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                        color: Colors.black87,
                      ),
                    ),
                    const SizedBox(height: 8),

                    // Description text based on lock reason
                    Text(
                      isClockError
                          ? settings.tr(
                              'BABALA: Na-detect ng system na binago o binalik ang oras/petsa (date & time) ng iyong tablet. Naka-lock pansamantala ang app para sa seguridad.',
                              'WARNING: The system detected that the tablet\'s date/time was altered backward. The app is locked for data safety.',
                            )
                          : settings.tr(
                              'Ang application na ito ay hindi pa activated o nag-expired na ang lisensya. Mangyaring makipag-ugnayan sa developer para sa activation key.',
                              'This application is not yet activated or the license has expired. Please contact the developer to acquire an activation key.',
                            ),
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 13,
                        color: isClockError ? Colors.red[900] : Colors.grey[600],
                        fontWeight: isClockError ? FontWeight.bold : FontWeight.normal,
                        height: 1.4,
                      ),
                    ),
                    const Divider(height: 32),

                    // Device ID Display Box
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                      decoration: BoxDecoration(
                        color: Colors.grey[100],
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Colors.grey.shade300),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  settings.tr('DEVICE ID (Ibigay sa Developer):', 'DEVICE ID (Provide to Developer):'),
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold,
                                    color: Colors.grey[600],
                                  ),
                                ),
                                const SizedBox(height: 4),
                                SelectableText(
                                  deviceId.isEmpty ? 'LOADING...' : deviceId,
                                  style: const TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.bold,
                                    fontFamily: 'monospace',
                                    color: Colors.black87,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          IconButton(
                            icon: const Icon(Icons.copy_rounded, size: 20),
                            tooltip: settings.tr('Kopyahin', 'Copy Device ID'),
                            onPressed: deviceId.isEmpty
                                ? null
                                : () {
                                    Clipboard.setData(ClipboardData(text: deviceId));
                                    AppToast.success(
                                      context,
                                      settings.tr(
                                        'Device ID kinopya sa clipboard!',
                                        'Device ID copied to clipboard!',
                                      ),
                                    );
                                  },
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),

                    // Activation input field
                    if (!isClockError) ...[
                      TextField(
                        controller: _keyController,
                        textCapitalization: TextCapitalization.characters,
                        decoration: InputDecoration(
                          labelText: settings.tr('Activation Key', 'Activation Key'),
                          hintText: 'XXXX-XXXX-XXXX-XXXX',
                          prefixIcon: const Icon(Icons.key_rounded),
                        ),
                        onSubmitted: (_) => _handleActivation(context, settings),
                      ),
                      const SizedBox(height: 12),
                    ],

                    // Error text alert
                    if (_errorMessage.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 16.0),
                        child: Text(
                          _errorMessage,
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            color: Colors.red,
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),

                    // Activation button
                    ElevatedButton(
                      onPressed: _isActivating
                          ? null
                          : () {
                              if (isClockError) {
                                // If clock is tempered, recheck status in case they fixed the clock
                                settings.checkLicenseStatus();
                              } else {
                                _handleActivation(context, settings);
                              }
                            },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: isClockError ? Colors.red[800] : AppColors.primary,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                      child: _isActivating
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                              ),
                            )
                          : Text(
                              isClockError
                                  ? settings.tr('Subukang Muli (Recheck Clock)', 'Recheck System Clock')
                                  : settings.tr('I-activate ang System', 'Activate System'),
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 14,
                              ),
                            ),
                    ),
                    const SizedBox(height: 16),

                    // Subtitle footer
                    Text(
                      isClockError
                          ? settings.tr(
                              'Pakitama ang oras/petsa ng tablet at i-click ang Recheck.',
                              'Set your tablet to the correct local date & time, then tap Recheck.',
                            )
                          : settings.tr(
                              'Tandaan: Ang Activation Key ay nakatali sa device na ito.',
                              'Note: The Activation Key is bound specifically to this device hardware.',
                            ),
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 11, color: Colors.grey[500]),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
