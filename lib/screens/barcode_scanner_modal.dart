import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:provider/provider.dart';
import '../providers/inventory_provider.dart';
import '../providers/settings_provider.dart';
import '../models/product.dart';
import '../utils/app_constants.dart';

class BarcodeScannerModal extends StatefulWidget {
  final bool continuous;
  final ValueChanged<String>? onScan;

  const BarcodeScannerModal({
    super.key,
    this.continuous = false,
    this.onScan,
  });

  @override
  State<BarcodeScannerModal> createState() => _BarcodeScannerModalState();
}

class _BarcodeScannerModalState extends State<BarcodeScannerModal> {
  static const _feedbackChannel = MethodChannel('com.sarisari.inventory/scan_feedback');

  Future<void> _triggerFeedback() async {
    try {
      final settings = Provider.of<SettingsProvider>(context, listen: false);
      await _feedbackChannel.invokeMethod('playScanFeedback', {
        'volume': settings.beepVolume.toInt(),
        'vibrateStrength': settings.vibrationStrength.toInt(),
      });
    } catch (_) {}
  }

  final MobileScannerController _controller = MobileScannerController();
  bool _hasScanned = false; // Prevent multiple pops for single scan
  String _scanStatusMessage = '';
  Color _scanStatusColor = Colors.green;
  Timer? _statusTimer;

  String? _lastCode;
  DateTime? _lastScanTime;

  @override
  void dispose() {
    _controller.dispose();
    _statusTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return OrientationBuilder(
      builder: (context, orientation) {
        final isLandscape = orientation == Orientation.landscape;
        final heightMultiplier = isLandscape 
            ? 0.95 // Take up almost full height in landscape to maximize camera view
            : (widget.continuous ? 0.8 : 0.7);

        return Container(
          height: MediaQuery.of(context).size.height * heightMultiplier,
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: SafeArea(
            bottom: false,
            child: Column(
              children: [
                // Drag handle
                const SizedBox(height: 8),
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.grey[300],
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                
                // Header
                _buildHeader(isLandscape),
                const Divider(height: 1),
                
                // Content
                Expanded(
                  child: isLandscape 
                      ? _buildLandscapeContent() 
                      : _buildPortraitContent(),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildHeader(bool isLandscape) {
    return Padding(
      padding: EdgeInsets.symmetric(
        horizontal: 16.0,
        vertical: isLandscape ? 4.0 : 8.0,
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              const Icon(Icons.qr_code_scanner, color: AppColors.primary),
              const SizedBox(width: 8),
              Text(
                widget.continuous ? 'Continuous Barcode Scan' : 'Mag-scan ng Barcode',
                style: TextStyle(
                  fontSize: isLandscape ? 14 : 16, 
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          IconButton(
            icon: const Icon(Icons.close),
            onPressed: () => Navigator.pop(context),
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(),
          ),
        ],
      ),
    );
  }

  Widget _buildPortraitContent() {
    return Column(
      children: [
        Expanded(
          child: Stack(
            children: [
              _buildCamera(),
              _buildTargetOverlay(isLandscape: false),
              _buildGuidanceLabel(),
              _buildStatusNotification(),
              _buildTorchButton(),
            ],
          ),
        ),
        if (widget.continuous) _buildDoneButton(),
      ],
    );
  }

  Widget _buildLandscapeContent() {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Camera preview on the left side
        Expanded(
          flex: 3,
          child: Stack(
            children: [
              _buildCamera(),
              _buildTargetOverlay(isLandscape: true),
              _buildTorchButton(),
            ],
          ),
        ),
        
        const VerticalDivider(width: 1),
        
        // Control & status panel on the right side
        Expanded(
          flex: 2,
          child: Container(
            color: Colors.grey[50],
            padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(
                  child: SingleChildScrollView(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Gabay sa Pag-scan',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.bold,
                            color: Colors.grey[700],
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          widget.continuous
                              ? 'I-tapat ang barcodes ng mga produkto isa-isa.'
                              : 'I-tapat ang barcode sa loob ng kahon ng camera.',
                          style: TextStyle(
                            fontSize: 11,
                            color: Colors.grey[600],
                          ),
                        ),
                        const SizedBox(height: 12),
                        _buildLandscapeStatusPanel(),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                if (widget.continuous)
                  _buildDoneButton()
                else
                  Text(
                    'I-align ang barcode upang mag-scan.',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 10, color: Colors.grey[500]),
                  ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildCamera() {
    return MobileScanner(
      controller: _controller,
      onDetect: (capture) {
        final List<Barcode> barcodes = capture.barcodes;
        if (barcodes.isNotEmpty) {
          final String? code = barcodes.first.rawValue;
          // Standard retail barcodes are at least 6 characters (e.g., EAN-8). 
          // This prevents accidental partial/half scans.
          if (code != null && code.trim().length >= 6) {
            final now = DateTime.now();
            // Cooldown logic: ignore scans of same code within 1.5 seconds
            if (_lastCode == code &&
                _lastScanTime != null &&
                now.difference(_lastScanTime!).inMilliseconds < 1500) {
              return;
            }
            
            _lastCode = code;
            _lastScanTime = now;

            // Trigger physical feedback
            _triggerFeedback();

            if (widget.continuous) {
              if (widget.onScan != null) {
                widget.onScan!(code);
              }

              // Look up product name to show friendly visual toast
              final provider = Provider.of<InventoryProvider>(context, listen: false);
              final matched = provider.products.firstWhere(
                (p) => p.barcode != null && p.barcode!.trim() == code.trim(),
                orElse: () => Product(
                  id: -1,
                  name: '',
                  category: '',
                  unit: '',
                  buyingPrice: 0,
                  sellingPrice: 0,
                  currentStock: 0,
                  minStockThreshold: 0,
                ),
              );

              setState(() {
                if (matched.id != -1) {
                  _scanStatusMessage = 'Idinagdag: ${matched.name}';
                  _scanStatusColor = AppColors.secondary;
                } else {
                  _scanStatusMessage = 'Walang produkto para sa: $code';
                  _scanStatusColor = Colors.red.shade800;
                }
              });

              _statusTimer?.cancel();
              _statusTimer = Timer(const Duration(milliseconds: 1500), () {
                if (mounted) {
                  setState(() {
                    _scanStatusMessage = '';
                  });
                }
              });
            } else {
              if (!_hasScanned) {
                _hasScanned = true;
                Navigator.pop(context, code);
              }
            }
          }
        }
      },
    );
  }

  Widget _buildTargetOverlay({required bool isLandscape}) {
    return LayoutBuilder(
      builder: (context, constraints) {
        // Dynamic adaptive dimensions: width 70% (clamped), height 55% (clamped)
        final boxWidth = (constraints.maxWidth * 0.7).clamp(180.0, 280.0);
        final boxHeight = (constraints.maxHeight * 0.6).clamp(100.0, 180.0);
        
        return Center(
          child: Container(
            width: boxWidth,
            height: boxHeight,
            decoration: BoxDecoration(
              border: Border.all(color: AppColors.secondary, width: 3),
              borderRadius: BorderRadius.circular(12),
            ),
          ),
        );
      },
    );
  }

  Widget _buildGuidanceLabel() {
    return Positioned(
      top: 20,
      left: 0,
      right: 0,
      child: Center(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: Colors.black.withAlpha(153),
            borderRadius: BorderRadius.circular(20),
          ),
          child: Text(
            widget.continuous 
                ? 'I-tapat ang barcodes isa-isa. I-tap ang Done pag tapos na.' 
                : 'I-tapat ang barcode sa loob ng kahon',
            style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w500),
          ),
        ),
      ),
    );
  }

  Widget _buildStatusNotification() {
    if (_scanStatusMessage.isEmpty) return const SizedBox.shrink();

    return Positioned(
      bottom: 80,
      left: 32,
      right: 32,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 300),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(
          color: _scanStatusColor.withAlpha(230),
          borderRadius: BorderRadius.circular(10),
          boxShadow: const [
            BoxShadow(color: Colors.black26, blurRadius: 4, offset: Offset(0, 2)),
          ],
        ),
        child: Text(
          _scanStatusMessage,
          textAlign: TextAlign.center,
          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
        ),
      ),
    );
  }

  Widget _buildLandscapeStatusPanel() {
    if (_scanStatusMessage.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: Colors.grey[100],
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: Colors.grey[300]!),
        ),
        child: const Row(
          children: [
            Icon(Icons.camera_alt_outlined, color: Colors.grey),
            SizedBox(width: 8),
            Expanded(
              child: Text(
                'Handang mag-scan...',
                style: TextStyle(color: Colors.grey, fontSize: 12),
              ),
            ),
          ],
        ),
      );
    }

    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: _scanStatusColor.withAlpha(26), // 10% opacity
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: _scanStatusColor),
      ),
      child: Row(
        children: [
          Icon(
            _scanStatusColor == Colors.green.shade800 || _scanStatusColor == AppColors.secondary
                ? Icons.check_circle
                : Icons.error,
            color: _scanStatusColor,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              _scanStatusMessage,
              style: TextStyle(
                color: _scanStatusColor,
                fontWeight: FontWeight.bold,
                fontSize: 12,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTorchButton() {
    return Positioned(
      bottom: widget.continuous ? 16 : 24,
      right: 24,
      child: FloatingActionButton(
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        mini: true,
        onPressed: () => _controller.toggleTorch(),
        child: ValueListenableBuilder<MobileScannerState>(
          valueListenable: _controller,
          builder: (context, state, child) {
            switch (state.torchState) {
              case TorchState.on:
                return const Icon(Icons.flash_on_rounded);
              case TorchState.off:
              case TorchState.auto:
              case TorchState.unavailable:
                return const Icon(Icons.flash_off_rounded);
            }
          },
        ),
      ),
    );
  }

  Widget _buildDoneButton() {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: SizedBox(
        width: double.infinity,
        child: ElevatedButton.icon(
          onPressed: () => Navigator.pop(context),
          icon: const Icon(Icons.check_circle_outline_rounded),
          label: const Text('Tapos na Mag-scan'),
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.primary,
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 12),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          ),
        ),
      ),
    );
  }
}
