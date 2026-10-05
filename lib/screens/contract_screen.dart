import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:gal/gal.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as p;
import 'package:permission_handler/permission_handler.dart';
import 'package:intl/intl.dart';
import 'package:share_plus/share_plus.dart';
import '../providers/settings_provider.dart';
import '../widgets/app_toast.dart';
import '../widgets/app_loading_overlay.dart';
import '../utils/app_constants.dart';

class UpperCaseTextFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    return TextEditingValue(
      text: newValue.text.toUpperCase(),
      selection: newValue.selection,
    );
  }
}

class ContractScreen extends StatefulWidget {
  const ContractScreen({super.key});

  @override
  State<ContractScreen> createState() => _ContractScreenState();
}

class _ContractScreenState extends State<ContractScreen> {
  final PageController _pageController = PageController();
  int _currentPage = 0;
  bool _isSigning = false;

  void _setSigning(bool signing) {
    setState(() {
      _isSigning = signing;
    });
  }

  // RepaintBoundary Keys
  final GlobalKey _page1Key = GlobalKey();
  final GlobalKey _page2Key = GlobalKey();
  final GlobalKey _page3Key = GlobalKey();

  // Page 1 Form Controllers
  final TextEditingController _ownerNameController = TextEditingController();
  final TextEditingController _storeNameController = TextEditingController();
  final TextEditingController _storeAddressController = TextEditingController();
  final TextEditingController _contactController = TextEditingController();

  // Payment Selection State
  bool _isFullPayment = true;
  final TextEditingController _downpaymentController = TextEditingController(text: '1,750.00');
  final TextEditingController _balanceController = TextEditingController(text: '1,750.00');

  // Page 3 Signature and Witnesses State
  final List<List<Offset>> _signaturePoints = [];
  Size _sigCanvasSize = Size.zero;
  final TextEditingController _witness1Controller = TextEditingController();
  final TextEditingController _witness2Controller = TextEditingController();
  bool _isAccepted = false;

  @override
  void dispose() {
    _pageController.dispose();
    _ownerNameController.dispose();
    _storeNameController.dispose();
    _storeAddressController.dispose();
    _contactController.dispose();
    _downpaymentController.dispose();
    _balanceController.dispose();
    _witness1Controller.dispose();
    _witness2Controller.dispose();
    super.dispose();
  }

  bool get _isPage1Valid {
    final owner = _ownerNameController.text.trim();
    final store = _storeNameController.text.trim();
    final address = _storeAddressController.text.trim();
    final contact = _contactController.text.trim();
    
    if (owner.isEmpty || store.isEmpty || address.isEmpty || contact.isEmpty) {
      return false;
    }
    
    final phPhoneRegex = RegExp(r'^(09|\+639|639)\d{9}$');
    return phPhoneRegex.hasMatch(contact);
  }

  // Check if Agree & Submit is enabled
  bool get _canSubmit {
    return _isPage1Valid &&
        _signaturePoints.isNotEmpty &&
        _isAccepted;
  }

  void _nextPage() {
    final settings = Provider.of<SettingsProvider>(context, listen: false);
    if (_currentPage == 0) {
      final owner = _ownerNameController.text.trim();
      final store = _storeNameController.text.trim();
      final address = _storeAddressController.text.trim();
      final contact = _contactController.text.trim();

      if (owner.isEmpty || store.isEmpty || address.isEmpty || contact.isEmpty) {
        AppToast.error(
          context,
          settings.tr(
            'Punan ang lahat ng patlang sa Impormasyon.',
            'Please fill in all information fields.',
          ),
        );
        return;
      }

      final phPhoneRegex = RegExp(r'^(09|\+639|639)\d{9}$');
      if (!phPhoneRegex.hasMatch(contact)) {
        AppToast.error(
          context,
          settings.tr(
            'Maling format ng Contact No. Dapat ay nagsisimula sa 09 o +639 at may 11 o 12 digits (Halimbawa: 09123456789).',
            'Invalid Contact No. format. Must start with 09 or +639 and have 11 or 12 digits (Example: 09123456789).',
          ),
        );
        return;
      }
    }

    if (_currentPage < 2) {
      _pageController.nextPage(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
    }
  }

  void _backPage() {
    if (_currentPage > 0) {
      _pageController.previousPage(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
    }
  }

  // Get Tagalog Month Helper
  String _getTagalogMonth(int month) {
    const months = [
      'Enero', 'Pebrero', 'Marso', 'Abril', 'Mayo', 'Hunyo',
      'Hulyo', 'Agosto', 'Setyembre', 'Oktubre', 'Nobyembre', 'Disyembre'
    ];
    if (month >= 1 && month <= 12) {
      return months[month - 1];
    }
    return '';
  }

  Future<void> _handleAgreeAndSubmit() async {
    if (!_canSubmit) return;

    final settings = Provider.of<SettingsProvider>(context, listen: false);

    // Request permissions
    try {
      if (Platform.isAndroid) {
        await [Permission.storage].request();
      }
    } catch (_) {}

    if (!mounted) return;

    AppLoadingOverlay.show(
      context,
      message: settings.tr(
        'I-save ang ulat at kontrata...',
        'Saving contract pages...',
      ),
    );

    // Wait for widgets to paint with current state in offscreen boundary
    await Future.delayed(const Duration(milliseconds: 500));

    try {
      final timestamp = DateFormat('yyyyMMdd_HHmmss').format(DateTime.now());
      final ownerClean = _ownerNameController.text
          .trim()
          .replaceAll(RegExp(r'[^\w\s\-]'), '')
          .replaceAll(RegExp(r'\s+'), '_');

      // Capture all 3 pages
      final bytes1 = await _capturePng(_page1Key);
      final bytes2 = await _capturePng(_page2Key);
      final bytes3 = await _capturePng(_page3Key);

      if (bytes1 == null || bytes2 == null || bytes3 == null) {
        throw Exception('Failed to render one or more contract pages');
      }

      final file1Name = 'POS_Contract_Page1_${ownerClean}_$timestamp.png';
      final file2Name = 'POS_Contract_Page2_${ownerClean}_$timestamp.png';
      final file3Name = 'POS_Contract_Page3_${ownerClean}_$timestamp.png';

      // Save to storage
      final success1 = await _saveImage(bytes1, file1Name);
      final success2 = await _saveImage(bytes2, file2Name);
      final success3 = await _saveImage(bytes3, file3Name);

      AppLoadingOverlay.hide();

      if (mounted) {
        if (success1 && success2 && success3) {
          // Success
          AppToast.success(
            context,
            settings.tr(
              'Nai-save ang 3 pahina ng kontrata sa iyong Gallery/Downloads!',
              'Successfully saved 3 contract pages to Gallery/Downloads!',
            ),
          );

          // Automatically configure Store and Owner name in uppercase for POS
          final ownerText = _ownerNameController.text.trim().toUpperCase();
          final storeText = _storeNameController.text.trim().toUpperCase();
          if (ownerText.isNotEmpty) {
            await settings.setOwnerName(ownerText);
          }
          if (storeText.isNotEmpty) {
            await settings.setStoreName(storeText);
          }

          // Mark agreement in SettingsProvider
          await settings.setHasAgreedToTerms(true);
          if (context.mounted && Navigator.canPop(context)) {
            Navigator.pop(context);
          }
          // Provider notifications will automatically trigger routing to next screen in MainNavigation
        } else {
          // Fallback: Share the files so the user can save them manually
          AppToast.warning(
            context,
            settings.tr(
              'Hindi ma-save sa Gallery. Iba-bahagi ang mga file upang ma-save nang manual.',
              'Could not save to Gallery. Sharing files for manual saving.',
            ),
          );

          try {
            final tempDir = await getTemporaryDirectory();
            final filePaths = <String>[];
            
            final path1 = p.join(tempDir.path, file1Name);
            await File(path1).writeAsBytes(bytes1);
            filePaths.add(path1);

            final path2 = p.join(tempDir.path, file2Name);
            await File(path2).writeAsBytes(bytes2);
            filePaths.add(path2);

            final path3 = p.join(tempDir.path, file3Name);
            await File(path3).writeAsBytes(bytes3);
            filePaths.add(path3);

            if (!mounted) return;
            final box = context.findRenderObject() as RenderBox?;
            final origin = box != null ? box.localToGlobal(Offset.zero) & box.size : null;

            await SharePlus.instance.share(
              ShareParams(
                files: filePaths.map((path) => XFile(path)).toList(),
                text: 'Imbentory App POS Contract Agreement',
                sharePositionOrigin: origin,
              ),
            );

            // Automatically configure Store and Owner name in uppercase for POS
            final ownerText = _ownerNameController.text.trim().toUpperCase();
            final storeText = _storeNameController.text.trim().toUpperCase();
            if (ownerText.isNotEmpty) {
              await settings.setOwnerName(ownerText);
            }
            if (storeText.isNotEmpty) {
              await settings.setStoreName(storeText);
            }

            // Mark agreement in SettingsProvider so they can proceed after sharing
            await settings.setHasAgreedToTerms(true);
            if (context.mounted && Navigator.canPop(context)) {
              Navigator.pop(context);
            }
          } catch (shareErr) {
            debugPrint('Share fallback error: $shareErr');
            if (!mounted) return;
            AppToast.error(
              context,
              settings.tr(
                'Pumalya ang pag-save at share. Pakisubukang muli.',
                'Failed to save or share contract. Please try again.',
              ),
            );
          }
        }
      }
    } catch (e) {
      AppLoadingOverlay.hide();
      if (mounted) {
        AppToast.error(
          context,
          settings.tr(
            'May naganap na error: $e',
            'An error occurred: $e',
          ),
        );
      }
    }
  }

  Future<Uint8List?> _capturePng(GlobalKey key) async {
    try {
      final boundary = key.currentContext?.findRenderObject() as RenderRepaintBoundary?;
      if (boundary == null) return null;
      final image = await boundary.toImage(pixelRatio: 2.5);
      final byteData = await image.toByteData(format: ui.ImageByteFormat.png);
      return byteData?.buffer.asUint8List();
    } catch (e) {
      debugPrint('Capture error: $e');
      return null;
    }
  }

  Future<bool> _saveImage(Uint8List pngBytes, String filename) async {
    bool savedToGallery = false;

    // Save to Photo Gallery using Gal
    try {
      final hasAccess = await Gal.hasAccess();
      if (!hasAccess) {
        await Gal.requestAccess();
      }
      
      final tempDir = await getTemporaryDirectory();
      final tempPath = p.join(tempDir.path, filename);
      final tempFile = File(tempPath);
      await tempFile.writeAsBytes(pngBytes);

      await Gal.putImage(tempPath);
      savedToGallery = true;
    } catch (e) {
      debugPrint('Error saving to gallery via Gal: $e');
    }

    return savedToGallery;
  }

  @override
  Widget build(BuildContext context) {
    final settings = Provider.of<SettingsProvider>(context);

    return Scaffold(
      body: Stack(
        children: [
          // Offscreen RepaintBoundaries for A4 capture (rendered behind the background gradient so they are painted but invisible to user)
          IgnorePointer(
            child: Row(
              children: [
                RepaintBoundary(
                  key: _page1Key,
                  child: _buildPrintablePage1(settings),
                ),
                RepaintBoundary(
                  key: _page2Key,
                  child: _buildPrintablePage2(settings),
                ),
                RepaintBoundary(
                  key: _page3Key,
                  child: _buildPrintablePage3(settings),
                ),
              ],
            ),
          ),

          // Background Gradient (Dark Forest Green Theme matching NEGOSYO / MONEY)
          Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  AppColors.primary, // Premium money green
                  Color(0xFF0D3211), // Elegant deep forest green
                  Color(0xFF051706), // Near black slate green
                ],
              ),
            ),
          ),

          // Interactive UI View
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                physics: _isSigning ? const NeverScrollableScrollPhysics() : const ScrollPhysics(),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 24.0),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 680),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        // App Logo Header or Icon
                        const CircleAvatar(
                          radius: 32,
                          backgroundColor: Colors.white24,
                          child: Icon(
                            Icons.gavel_rounded,
                            size: 36,
                            color: Colors.white,
                          ),
                        ),
                        const SizedBox(height: 12),
                        const Text(
                          'Imbentory',
                          style: TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                            letterSpacing: 0.5,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          settings.tr(
                            'KASUNDUAN AT LISENSYA NG SOFTWARE',
                            'SOFTWARE AGREEMENT & LICENSE',
                          ),
                          style: TextStyle(
                            fontSize: 12,
                            color: Colors.greenAccent[100],
                            fontWeight: FontWeight.w600,
                            letterSpacing: 1,
                          ),
                        ),
                        const SizedBox(height: 20),

                        // Card with Glassmorphic design
                        Card(
                          elevation: 8,
                          shadowColor: Colors.black45,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(20),
                          ),
                          color: Colors.white.withValues(alpha: 0.96),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 24.0),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                // Step Indicator
                                _buildStepIndicator(),
                                const Divider(height: 24, thickness: 1),

                                // Scrollable Paginated Area
                                SizedBox(
                                  height: 480,
                                  child: PageView(
                                    controller: _pageController,
                                    physics: const NeverScrollableScrollPhysics(),
                                    onPageChanged: (page) {
                                      setState(() {
                                        _currentPage = page;
                                      });
                                    },
                                    children: [
                                      _buildPage1(settings),
                                      _buildPage2(settings),
                                      _buildPage3(settings),
                                    ],
                                  ),
                                ),

                                const Divider(height: 24, thickness: 1),

                                // Bottom Navigation (Responsive Row/Column using LayoutBuilder constraints)
                                LayoutBuilder(
                                  builder: (context, constraints) {
                                    final maxW = constraints.maxWidth;
                                    // If available container width is narrow (< 500px), stack buttons vertically
                                    if (maxW < 500) {
                                      return Column(
                                        crossAxisAlignment: CrossAxisAlignment.stretch,
                                        children: [
                                          // Primary Action Button (Next / Submit)
                                          _currentPage < 2
                                              ? ElevatedButton.icon(
                                                  onPressed: _nextPage,
                                                  label: const Text(
                                                    'Susunod (Next) ->',
                                                  ),
                                                  style: ElevatedButton.styleFrom(
                                                    backgroundColor: AppColors.primary,
                                                    foregroundColor: Colors.white,
                                                    padding: const EdgeInsets.symmetric(vertical: 14),
                                                    shape: RoundedRectangleBorder(
                                                      borderRadius: BorderRadius.circular(10),
                                                    ),
                                                  ),
                                                )
                                              : ElevatedButton.icon(
                                                  onPressed: _canSubmit ? _handleAgreeAndSubmit : null,
                                                  icon: const Icon(Icons.check_circle_rounded),
                                                  label: Text(
                                                    settings.tr(
                                                      'Agree & Submit (I-save)',
                                                      'Agree & Submit (Save)',
                                                    ),
                                                  ),
                                                  style: ElevatedButton.styleFrom(
                                                    backgroundColor: AppColors.primary,
                                                    foregroundColor: Colors.white,
                                                    disabledBackgroundColor: Colors.grey[300],
                                                    disabledForegroundColor: Colors.grey[500],
                                                    padding: const EdgeInsets.symmetric(vertical: 14),
                                                    shape: RoundedRectangleBorder(
                                                      borderRadius: BorderRadius.circular(10),
                                                    ),
                                                  ),
                                                ),
                                          if (_currentPage > 0) const SizedBox(height: 10),
                                          // Secondary Action Button (Back)
                                          if (_currentPage > 0)
                                            OutlinedButton.icon(
                                              onPressed: _backPage,
                                              icon: const Icon(Icons.arrow_back_rounded),
                                              label: Text(
                                                settings.tr(
                                                  '<- Bumalik',
                                                  '<- Back',
                                                ),
                                                style: const TextStyle(fontWeight: FontWeight.bold),
                                              ),
                                              style: OutlinedButton.styleFrom(
                                                foregroundColor: AppColors.secondary,
                                                side: const BorderSide(color: AppColors.secondary),
                                                padding: const EdgeInsets.symmetric(vertical: 14),
                                                shape: RoundedRectangleBorder(
                                                  borderRadius: BorderRadius.circular(10),
                                                ),
                                              ),
                                            ),
                                        ],
                                      );
                                    } else {
                                      return Row(
                                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                        children: [
                                          // Back Button
                                          _currentPage > 0
                                              ? TextButton.icon(
                                                  onPressed: _backPage,
                                                  icon: const Icon(Icons.arrow_back_rounded),
                                                  label: Text(
                                                    settings.tr(
                                                      '<- Bumalik',
                                                      '<- Back',
                                                    ),
                                                    style: const TextStyle(fontWeight: FontWeight.bold),
                                                  ),
                                                  style: TextButton.styleFrom(
                                                    foregroundColor: AppColors.secondary,
                                                  ),
                                                )
                                              : const SizedBox.shrink(),

                                          // Next / Submit Button
                                          _currentPage < 2
                                              ? ElevatedButton.icon(
                                                  onPressed: _nextPage,
                                                  label: Text(
                                                    settings.tr(
                                                      'Susunod (Next) ->',
                                                      'Next ->',
                                                    ),
                                                  ),
                                                  style: ElevatedButton.styleFrom(
                                                    backgroundColor: AppColors.primary,
                                                    foregroundColor: Colors.white,
                                                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                                                    shape: RoundedRectangleBorder(
                                                      borderRadius: BorderRadius.circular(10),
                                                    ),
                                                  ),
                                                )
                                              : ElevatedButton.icon(
                                                  onPressed: _canSubmit ? _handleAgreeAndSubmit : null,
                                                  icon: const Icon(Icons.check_circle_rounded),
                                                  label: Text(
                                                    settings.tr(
                                                      'Agree & Submit (I-save)',
                                                      'Agree & Submit (Save)',
                                                    ),
                                                  ),
                                                  style: ElevatedButton.styleFrom(
                                                    backgroundColor: AppColors.primary,
                                                    foregroundColor: Colors.white,
                                                    disabledBackgroundColor: Colors.grey[300],
                                                    disabledForegroundColor: Colors.grey[500],
                                                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                                                    shape: RoundedRectangleBorder(
                                                      borderRadius: BorderRadius.circular(10),
                                                    ),
                                                  ),
                                                ),
                                        ],
                                      );
                                    }
                                  },
                                ),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),


        ],
      ),
    );
  }

  // Step indicator UI
  Widget _buildStepIndicator() {
    return Row(
      children: [
        _buildStepIndicatorCircle(0, '1', 'Impormasyon'),
        Expanded(child: _buildStepIndicatorLine(0)),
        _buildStepIndicatorCircle(1, '2', 'Disclaimer'),
        Expanded(child: _buildStepIndicatorLine(1)),
        _buildStepIndicatorCircle(2, '3', 'Lagda'),
      ],
    );
  }

  Widget _buildStepIndicatorCircle(int index, String stepNum, String title) {
    final isActive = _currentPage == index;
    final isDone = _currentPage > index;

    return Column(
      children: [
        CircleAvatar(
          radius: 14,
          backgroundColor: isDone
              ? AppColors.secondary
              : (isActive ? AppColors.primary : Colors.grey[300]),
          child: isDone
              ? const Icon(Icons.check, size: 16, color: Colors.white)
              : Text(
                  stepNum,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: isActive || isDone ? Colors.white : Colors.grey[600],
                  ),
                ),
        ),
        const SizedBox(height: 4),
        Text(
          title,
          style: TextStyle(
            fontSize: 10,
            fontWeight: isActive ? FontWeight.bold : FontWeight.normal,
            color: isActive
                ? AppColors.primary
                : (isDone ? AppColors.secondary : Colors.grey[500]),
          ),
        ),
      ],
    );
  }

  Widget _buildStepIndicatorLine(int afterIndex) {
    final isDone = _currentPage > afterIndex;
    return Container(
      height: 3,
      color: isDone ? AppColors.secondary : Colors.grey[300],
      margin: const EdgeInsets.only(bottom: 14),
    );
  }

  // ==========================================
  // ONSCREEN ACTIVE UI PAGES
  // ==========================================

  Widget _buildPage1(SettingsProvider settings) {
    final today = DateTime.now();
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Center(
            child: Text(
              'KASUNDUAN SA PAGBILI AT SERBISYO NG SOFTWARE\n(SOFTWARE PURCHASE AND SERVICE AGREEMENT)',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'Ang kasunduang ito ay ginawa at nilagdaan ngayong ika-${today.day} ng ${_getTagalogMonth(today.month)}, ${today.year}, sa pagitan nina:',
            style: const TextStyle(fontSize: 13, height: 1.4),
          ),
          const SizedBox(height: 12),

          // Developer Info Card
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.green.shade50,
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: Colors.green.shade200),
            ),
            child: const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'DEVELOPER:',
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.primary),
                ),
                SizedBox(height: 4),
                Text('Pangalan: Mark Vincent B. Alegre', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                Text('Tirahan: P-5 Bretania San Agustin SDS', style: TextStyle(fontSize: 12)),
                Text('Contact No.: 09514110886', style: TextStyle(fontSize: 12)),
              ],
            ),
          ),
          const SizedBox(height: 16),

          const Text(
            'MGA DETALYE NG CLIENT / MAY-ARI (Client Info):',
            style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.black87),
          ),
          const SizedBox(height: 8),

          // Input Fields
          TextField(
            controller: _ownerNameController,
            textCapitalization: TextCapitalization.characters,
            inputFormatters: [UpperCaseTextFormatter()],
            onChanged: (_) => setState(() {}),
            decoration: const InputDecoration(
              labelText: 'Pangalan ng May-ari *',
              hintText: 'PANGALAN AT APELYIDO (PRINTED NAME)',
              prefixIcon: Icon(Icons.person_rounded, size: 20),
            ),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _storeNameController,
            textCapitalization: TextCapitalization.characters,
            inputFormatters: [UpperCaseTextFormatter()],
            decoration: const InputDecoration(
              labelText: 'Pangalan ng Tindahan *',
              hintText: 'PANGALAN NG TINDAHAN / SARI-SARI STORE',
              prefixIcon: Icon(Icons.store_rounded, size: 20),
            ),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _storeAddressController,
            textCapitalization: TextCapitalization.characters,
            inputFormatters: [UpperCaseTextFormatter()],
            decoration: const InputDecoration(
              labelText: 'Address ng Tindahan *',
              hintText: 'TIRAHAN O KINALALAGYAN NG TINDAHAN',
              prefixIcon: Icon(Icons.location_on_rounded, size: 20),
            ),
          ),
          const SizedBox(height: 10),
          TextField(
            controller: _contactController,
            keyboardType: TextInputType.phone,
            decoration: const InputDecoration(
              labelText: 'Contact No. (Halimbawa: 09XXXXXXXXX) *',
              hintText: 'Nagsisimula sa 09 o +639 at may 11 o 12 digits',
              prefixIcon: Icon(Icons.phone_rounded, size: 20),
            ),
          ),
          const SizedBox(height: 16),

          const Text(
            'Sa pamamagitan ng kasunduang ito, nagkasundo ang dalawang panig sa mga sumusunod na kondisyon:',
            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, height: 1.4),
          ),
          const SizedBox(height: 12),

          // Section 1
          const Text(
            '1. HALAGA NG SOFTWARE AT PAGBABAYAD (Price and Payment Terms)',
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 4),
          const Text(
            'Ang napagkasunduang kabuuang halaga para sa lisensya at pag-install ng Imbentory Application ay Php 3,500.00.',
            style: TextStyle(fontSize: 12, height: 1.3),
          ),
          const SizedBox(height: 8),

          // Payment Options Checkboxes/Radios
          Container(
            decoration: BoxDecoration(
              color: Colors.grey[100],
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: Colors.grey.shade300),
            ),
            child: Column(
              children: [
                CheckboxListTile(
                  value: _isFullPayment,
                  activeColor: AppColors.primary,
                  onChanged: (val) {
                    if (val == true) {
                      setState(() {
                        _isFullPayment = true;
                      });
                    }
                  },
                  title: const Text(
                    'Full Payment pagkatapos ng pag-install.',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                  ),
                ),
                CheckboxListTile(
                  value: !_isFullPayment,
                  activeColor: AppColors.primary,
                  onChanged: (val) {
                    if (val == true) {
                      setState(() {
                        _isFullPayment = false;
                      });
                    }
                  },
                  title: const Text(
                    '50% Downpayment bago magsimula, at 50% Balance pagkatapos ma-setup at ma-test ang system.',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),

          // Downpayment / Balance sub-inputs if installment is chosen
          if (!_isFullPayment) ...[
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 8.0),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _downpaymentController,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      onChanged: (val) {
                        final cleanVal = val.replaceAll(',', '');
                        final downpayment = double.tryParse(cleanVal) ?? 0.0;
                        final balance = 3500.0 - downpayment;
                        _balanceController.text = balance > 0 
                            ? NumberFormat('#,##0.00').format(balance) 
                            : '0.00';
                      },
                      decoration: const InputDecoration(
                        labelText: 'Downpayment (Php)',
                        contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: TextField(
                      controller: _balanceController,
                      decoration: const InputDecoration(
                        labelText: 'Balance (Php)',
                        contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
          ],

          // Section 2
          const Text(
            '2. MGA KASAMA SA SERBISYO (Inclusions / What is Included)',
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 6),
          const BulletPoint(
            text: 'Single Device Installation: Pag-install at pag-activate ng application sa isang (1) Android tablet o phone ng Client at pag-configure ng local database.',
          ),
          const BulletPoint(
            text: 'Hardware Integration: Pag-connect ng system sa Bluetooth 58mm Thermal Printer at Barcode Scanner (kung may hardware ang Client).',
          ),
          const BulletPoint(
            text: 'Initial Training: Pagtuturo sa cashier o may-ari kung paano gamitin ang POS (Sales), Stock-In, at Utang Ledger.',
          ),
          const BulletPoint(
            text: 'One (1) Month Free Support: Tatlumpung (30) araw na libreng technical support at pag-aayos ng anumang bug o system error simula sa petsa ng pag-install.',
          ),
        ],
      ),
    );
  }

  Widget _buildPage2(SettingsProvider settings) {
    return const SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Text(
              'MGA DETALYE NG DISKLAIMER AT SUPORTA\n(DATA DISCLAIMER & SUPPORT LIMITATIONS)',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
            ),
          ),
          SizedBox(height: 16),

          // Section 3
          Text(
            '3. RESPONSIBILIDAD SA DATA AT DISCLAIMER (Data Loss Disclaimer)',
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
          ),
          SizedBox(height: 6),
          BulletPoint(
            text: 'Local Data Storage: Ang system ay offline-first. Lahat ng listahan ng produkto, benta, at utang ay direktang naka-save sa memory/storage ng device ng Client at hindi sa online cloud server.',
          ),
          BulletPoint(
            text: 'Backup Responsibility: Tungkulin ng Client na regular na mag-backup ng kanilang data gamit ang "Auto-Backup" o "Manual Backup" (Google Drive / Local export) na feature sa Settings ng app.',
          ),
          BulletPoint(
            text: 'Data Loss Disclaimer: Ang Developer ay WALANG PANANAGUTAN (Not Liable) sa anumang pagkawala ng data, pagkabura ng records, o pagkasira ng files dulot ng pagkasira ng device, factory reset, virus, o maling paggamit ng Client.',
          ),
          BulletPoint(
            text: 'Pabatid sa Resibo: Ang resibong inilalabas ng 58mm thermal printer ay para sa internal store tracking at customer reference lamang, at hindi opisyal na kapalit ng manual BIR Official Receipts/Invoices ng tindahan.',
          ),
          SizedBox(height: 16),

          // Section 4
          Text(
            '4. LIMITASYON NG LIBRENG SUPORTA (Support Limitations)',
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
          ),
          SizedBox(height: 6),
          BulletPoint(
            text: 'Single-Device Limit: Ang biniling lisensya ay para lamang sa iisang (1) device. Ang pag-install sa karagdagang device o cashier counter ay mangangailangan ng panibagong lisensya at hiwalay na bayad.',
          ),
          BulletPoint(
            text: 'On-Site Service Fee: Pagkatapos ng 30 araw na libreng suporta, ang anumang on-site support visit o troubleshooting ay may karaniwang service fee na Php 300.00 - Php 500.00 kada bisita depende sa layo.',
          ),
          BulletPoint(
            text: 'Custom Features: Hindi kasama sa libreng support ang paggawa ng mga bagong feature o custom modifications na wala sa kasalukuyang release ng software.',
          ),
        ],
      ),
    );
  }

  Widget _buildPage3(SettingsProvider settings) {
    final clientName = _ownerNameController.text.trim().isEmpty
        ? '[Pangalan ng Client]'
        : _ownerNameController.text.trim();

    return SingleChildScrollView(
      physics: _isSigning ? const NeverScrollableScrollPhysics() : const ScrollPhysics(),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Center(
            child: Text(
              'PAGMAMAY-ARI, PAGLABAG AT LAGDA\n(OWNERSHIP, BREACH & SIGNATURE)',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
            ),
          ),
          const SizedBox(height: 12),

          // Section 5
          const Text(
            '5. PAGMAMAY-ARI NG SOFTWARE (Software Ownership)',
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 4),
          const Text(
            'Ang binili ng Client ay ang lisensya sa paggamit (license to use) para sa kanilang partikular na tindahan. Ang copyright, source code, at intellectual property ng application ay nananatiling 100% pagmamay-ari ng Developer. Mahigpit na ipinagbabawal ang pagkopya, pamamahagi, o muling pagbebenta ng system nang walang nakasulat na pahintulot mula sa Developer.',
            style: TextStyle(fontSize: 12, height: 1.35, color: Colors.black87),
          ),
          const SizedBox(height: 14),

          // Section 6
          const Text(
            '6. PAGLABAG SA KASUNDUAN AT MGA PARUSA (Breach of Contract and Penalties)',
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 6),
          const BulletPoint(
            text: 'Non-Payment: Kung hindi mabayaran ang balanse sa itinakdang petsa, may karapatan ang Developer na itigil ang suporta o pansamantalang bawiin ang lisensya hanggang sa mabayaran nang buo ang halaga.',
          ),
          const BulletPoint(
            text: 'Unauthorized Distribution / Piracy: Ang ilegal na pamimigay, pag-clone, o pagbenta ng application sa ibang indibidwal o tindahan ay may katapat na multang hindi bababa sa Php 50,000.00, bukod pa sa posibleng legal na aksyon sa ilalim ng Intellectual Property Code of the Philippines.',
          ),
          const BulletPoint(
            text: 'Termination & Refund: Ang seryosong paglabag sa kasunduang ito ay magbibigay ng karapatan sa Developer na wakasan ang lisensya nang walang ibabalik na bayad (No Refund).',
          ),
          const SizedBox(height: 12),

          const Text(
            'SA KATUNAYAN NG LAHAT, ang magkabilang panig ay nagkasundo at lumagda ngayong araw at taon na nakasaad sa itaas.',
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, fontStyle: FontStyle.italic, height: 1.3),
          ),
          const SizedBox(height: 16),

          // Interactive Signature Canvas Container
          const Text(
            'LAGDA NG CLIENT (Client Signature):',
            style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.black87),
          ),
          const SizedBox(height: 6),
          Container(
            height: 130,
            decoration: BoxDecoration(
              color: Colors.grey[100],
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: Colors.grey.shade300),
            ),
            child: LayoutBuilder(
              builder: (context, constraints) {
                // Keep track of canvas size for offscreen scaling
                _sigCanvasSize = Size(constraints.maxWidth, constraints.maxHeight);
                return Stack(
                  children: [
                    GestureDetector(
                      onPanStart: (details) {
                        _setSigning(true);
                        setState(() {
                          final RenderBox box = context.findRenderObject() as RenderBox;
                          final localPos = box.globalToLocal(details.globalPosition);
                          _signaturePoints.add([localPos]);
                        });
                      },
                      onPanUpdate: (details) {
                        setState(() {
                          final RenderBox box = context.findRenderObject() as RenderBox;
                          final localPos = box.globalToLocal(details.globalPosition);
                          if (_signaturePoints.isNotEmpty) {
                            _signaturePoints.last.add(localPos);
                          }
                        });
                      },
                      onPanEnd: (details) {
                        _setSigning(false);
                      },
                      onPanCancel: () {
                        _setSigning(false);
                      },
                      child: CustomPaint(
                        painter: SignaturePainter(pointsList: _signaturePoints),
                        size: Size.infinite,
                      ),
                    ),
                    if (_signaturePoints.isEmpty)
                      const IgnorePointer(
                        child: Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.edit_rounded, color: Colors.grey, size: 24),
                              SizedBox(height: 4),
                              Text(
                                'Lagdaan gamit ang daliri rito',
                                style: TextStyle(fontSize: 11, color: Colors.grey),
                              ),
                            ],
                          ),
                        ),
                      ),
                    Positioned(
                      right: 8,
                      bottom: 8,
                      child: TextButton.icon(
                        onPressed: () {
                          setState(() {
                            _signaturePoints.clear();
                          });
                        },
                        icon: const Icon(Icons.delete_sweep_rounded, size: 16),
                        label: Text(settings.tr('Burahin', 'Clear')),
                        style: TextButton.styleFrom(
                          foregroundColor: Colors.red[800],
                          backgroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          elevation: 1,
                        ),
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
          const SizedBox(height: 4),
          Center(
            child: Column(
              children: [
                Text(
                  clientName,
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, decoration: TextDecoration.underline),
                ),
                Text(
                  settings.tr('Pangalan at Lagda ng Client / Store Owner', 'Client\'s Signature over Printed Name / Owner'),
                  style: TextStyle(fontSize: 10, color: Colors.grey[600]),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Witnesses Text Fields
          const Text(
            'MGA SAKSI (Witnesses):',
            style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.black87),
          ),
          const SizedBox(height: 6),
          TextField(
            controller: _witness1Controller,
            textCapitalization: TextCapitalization.characters,
            inputFormatters: [UpperCaseTextFormatter()],
            decoration: const InputDecoration(
              labelText: 'Pangalan ng Saksi 1',
              hintText: 'PANGALAN AT APELYIDO',
              contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            ),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _witness2Controller,
            textCapitalization: TextCapitalization.characters,
            inputFormatters: [UpperCaseTextFormatter()],
            decoration: const InputDecoration(
              labelText: 'Pangalan ng Saksi 2',
              hintText: 'PANGALAN AT APELYIDO',
              contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            ),
          ),
          const SizedBox(height: 16),

          // Acceptance Checkbox
          CheckboxListTile(
            value: _isAccepted,
            activeColor: AppColors.primary,
            onChanged: (val) {
              setState(() {
                _isAccepted = val ?? false;
              });
            },
            title: Text(
              settings.tr(
                'Nabasa, naintindihan, at sinasang-ayunan ko ang lahat ng nakasaad sa 3 pahina ng kasunduang ito.',
                'I have read, understood, and agreed to all terms specified on the 3 pages of this agreement.',
              ),
              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, height: 1.35),
            ),
            contentPadding: EdgeInsets.zero,
            controlAffinity: ListTileControlAffinity.leading,
          ),
        ],
      ),
    );
  }

  // ==========================================
  // HIGH-RESOLUTION PRINTABLE PAGES (A4 equivalent)
  // ==========================================

  Widget _buildPrintablePage1(SettingsProvider settings) {
    final today = DateTime.now();
    final ownerNameText = _ownerNameController.text.trim().toUpperCase();
    final storeNameText = _storeNameController.text.trim().toUpperCase();
    final addressText = _storeAddressController.text.trim().toUpperCase();
    final contactText = _contactController.text.trim();

    return Container(
      width: 794,
      height: 1123,
      color: Colors.white,
      padding: const EdgeInsets.symmetric(horizontal: 56.0, vertical: 46.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Center(
            child: Column(
              children: [
                Text(
                  'KASUNDUAN SA PAGBILI AT SERBISYO NG SOFTWARE',
                  style: TextStyle(
                    fontSize: 12.0,
                    fontWeight: FontWeight.bold,
                    fontFamily: 'serif',
                    color: Colors.black,
                  ),
                ),
                SizedBox(height: 2),
                Text(
                  '(SOFTWARE PURCHASE AND SERVICE AGREEMENT)',
                  style: TextStyle(
                    fontSize: 11.0,
                    fontWeight: FontWeight.bold,
                    fontFamily: 'serif',
                    color: Colors.black,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 14),
          RichText(
            text: TextSpan(
              style: const TextStyle(fontSize: 11.0, fontFamily: 'serif', color: Colors.black, height: 1.35),
              children: [
                const TextSpan(text: 'Ang kasunduang ito ay ginawa at nilagdaan ngayong ika-'),
                TextSpan(
                  text: ' ${today.day} ',
                  style: const TextStyle(fontWeight: FontWeight.bold, decoration: TextDecoration.underline),
                ),
                const TextSpan(text: ' ng '),
                TextSpan(
                  text: ' ${_getTagalogMonth(today.month)} ',
                  style: const TextStyle(fontWeight: FontWeight.bold, decoration: TextDecoration.underline),
                ),
                const TextSpan(text: ', 2026, sa pagitan nina:'),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // Developer Info
          const Text(
            'DEVELOPER:',
            style: TextStyle(fontSize: 11.0, fontWeight: FontWeight.bold, fontFamily: 'serif', color: Colors.black),
          ),
          const SizedBox(height: 2),
          Padding(
            padding: const EdgeInsets.only(left: 12.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                RichText(
                  text: const TextSpan(
                    style: TextStyle(fontSize: 11.0, fontFamily: 'serif', color: Colors.black, height: 1.35),
                    children: [
                      TextSpan(text: 'Pangalan: '),
                      TextSpan(
                        text: ' Mark Vincent B. Alegre ',
                        style: TextStyle(fontWeight: FontWeight.bold, decoration: TextDecoration.underline),
                      ),
                    ],
                  ),
                ),
                RichText(
                  text: const TextSpan(
                    style: TextStyle(fontSize: 11.0, fontFamily: 'serif', color: Colors.black, height: 1.35),
                    children: [
                      TextSpan(text: 'Tirahan: '),
                      TextSpan(
                        text: ' P-5 Bretania San Agustin SDS ',
                        style: TextStyle(fontWeight: FontWeight.bold, decoration: TextDecoration.underline),
                      ),
                    ],
                  ),
                ),
                RichText(
                  text: const TextSpan(
                    style: TextStyle(fontSize: 11.0, fontFamily: 'serif', color: Colors.black, height: 1.35),
                    children: [
                      TextSpan(text: 'Contact No.: '),
                      TextSpan(
                        text: ' 09514110886 ',
                        style: TextStyle(fontWeight: FontWeight.bold, decoration: TextDecoration.underline),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 6),
          const Center(
            child: Text(
              '— at —',
              style: TextStyle(fontSize: 11.0, fontFamily: 'serif', color: Colors.black, fontWeight: FontWeight.bold),
            ),
          ),
          const SizedBox(height: 6),

          // Client Info
          const Text(
            'CLIENT (STORE OWNER):',
            style: TextStyle(fontSize: 11.0, fontWeight: FontWeight.bold, fontFamily: 'serif', color: Colors.black),
          ),
          const SizedBox(height: 2),
          Padding(
            padding: const EdgeInsets.only(left: 12.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                RichText(
                  text: TextSpan(
                    style: const TextStyle(fontSize: 11.0, fontFamily: 'serif', color: Colors.black, height: 1.35),
                    children: [
                      const TextSpan(text: 'Pangalan ng May-ari: '),
                      TextSpan(
                        text: ownerNameText.isEmpty ? '_________________________________' : ' $ownerNameText ',
                        style: const TextStyle(fontWeight: FontWeight.bold, decoration: TextDecoration.underline),
                      ),
                    ],
                  ),
                ),
                RichText(
                  text: TextSpan(
                    style: const TextStyle(fontSize: 11.0, fontFamily: 'serif', color: Colors.black, height: 1.35),
                    children: [
                      const TextSpan(text: 'Pangalan ng Tindahan: '),
                      TextSpan(
                        text: storeNameText.isEmpty ? '________________________________' : ' $storeNameText ',
                        style: const TextStyle(fontWeight: FontWeight.bold, decoration: TextDecoration.underline),
                      ),
                    ],
                  ),
                ),
                RichText(
                  text: TextSpan(
                    style: const TextStyle(fontSize: 11.0, fontFamily: 'serif', color: Colors.black, height: 1.35),
                    children: [
                      const TextSpan(text: 'Address ng Tindahan: '),
                      TextSpan(
                        text: addressText.isEmpty ? '_________________________________' : ' $addressText ',
                        style: const TextStyle(fontWeight: FontWeight.bold, decoration: TextDecoration.underline),
                      ),
                    ],
                  ),
                ),
                RichText(
                  text: TextSpan(
                    style: const TextStyle(fontSize: 11.0, fontFamily: 'serif', color: Colors.black, height: 1.35),
                    children: [
                      const TextSpan(text: 'Contact No.: '),
                      TextSpan(
                        text: contactText.isEmpty ? '______________________________________' : ' $contactText ',
                        style: const TextStyle(fontWeight: FontWeight.bold, decoration: TextDecoration.underline),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          const Text(
            'Sa pamamagitan ng kasunduang ito, nagkasundo ang dalawang panig sa mga sumusunod na kondisyon:',
            style: TextStyle(fontSize: 11.0, fontWeight: FontWeight.bold, fontFamily: 'serif', color: Colors.black, height: 1.35),
          ),
          const SizedBox(height: 10),

          // Section 1
          const Text(
            '1. HALAGA NG SOFTWARE AT PAGBABAYAD (Price and Payment Terms)',
            style: TextStyle(fontSize: 11.0, fontWeight: FontWeight.bold, fontFamily: 'serif', color: Colors.black),
          ),
          const SizedBox(height: 3),
          RichText(
            text: const TextSpan(
              style: TextStyle(fontSize: 11.0, fontFamily: 'serif', color: Colors.black, height: 1.35),
              children: [
                TextSpan(text: 'Ang napagkasunduang kabuuang halaga para sa lisensya at pag-install ng Imbentaryo Application ay Php '),
                TextSpan(
                  text: ' 3,500.00 ',
                  style: TextStyle(fontWeight: FontWeight.bold, decoration: TextDecoration.underline),
                ),
                TextSpan(text: '.'),
              ],
            ),
          ),
          const SizedBox(height: 6),

          const Text(
            'Paraan ng Pagbabayad:',
            style: TextStyle(fontSize: 11.0, fontWeight: FontWeight.bold, fontFamily: 'serif', color: Colors.black),
          ),
          const SizedBox(height: 3),
          Padding(
            padding: const EdgeInsets.only(left: 12.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${_isFullPayment ? "[x]" : "[ ]"} Full Payment pagkatapos ng pag-install.',
                  style: const TextStyle(fontSize: 11.0, fontFamily: 'serif', color: Colors.black, height: 1.35),
                ),
                const SizedBox(height: 3),
                RichText(
                  text: TextSpan(
                    style: const TextStyle(fontSize: 11.0, fontFamily: 'serif', color: Colors.black, height: 1.35),
                    children: [
                      TextSpan(text: '${!_isFullPayment ? "[x]" : "[ ]"} 50% Downpayment (Php '),
                      TextSpan(
                        text: !_isFullPayment ? ' ${_downpaymentController.text.trim()} ' : ' ____________ ',
                        style: const TextStyle(fontWeight: FontWeight.bold, decoration: TextDecoration.underline),
                      ),
                      const TextSpan(text: ') bago magsimula ang pag-setup, at 50% Balance (Php '),
                      TextSpan(
                        text: !_isFullPayment ? ' ${_balanceController.text.trim()} ' : ' ____________ ',
                        style: const TextStyle(fontWeight: FontWeight.bold, decoration: TextDecoration.underline),
                      ),
                      const TextSpan(text: ') pagkatapos ma-install at ma-test ang system.'),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // Section 2
          const Text(
            '2. MGA KASAMA SA SERBISYO (Inclusions / What is Included)',
            style: TextStyle(fontSize: 11.0, fontWeight: FontWeight.bold, fontFamily: 'serif', color: Colors.black),
          ),
          const SizedBox(height: 4),
          const BulletPointPrint(
            text: 'Single Device Installation: Pag-install at pag-activate ng application sa isang (1) Android tablet o phone ng Client at pag-configure ng local database.',
          ),
          const BulletPointPrint(
            text: 'Hardware Integration: Pag-connect ng system sa Bluetooth 58mm Thermal Printer at Barcode Scanner (kung may hardware ang Client).',
          ),
          const BulletPointPrint(
            text: 'Initial Training: Pagtuturo sa cashier o may-ari kung paano gamitin ang POS (Sales), Stock-In, at Utang Ledger.',
          ),
          const BulletPointPrint(
            text: 'One (1) Month Free Support: Tatlumpung (30) araw na libreng technical support at pag-aayos ng anumang bug o system error simula sa petsa ng pag-install.',
          ),
          const Spacer(),
          const Center(
            child: Text(
              'Pahina 1 ng 3',
              style: TextStyle(fontSize: 11, color: Colors.grey, fontFamily: 'serif'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPrintablePage2(SettingsProvider settings) {
    return Container(
      width: 794,
      height: 1123,
      color: Colors.white,
      padding: const EdgeInsets.symmetric(horizontal: 56.0, vertical: 46.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Section 3
          const Text(
            '3. RESPONSIBILIDAD SA DATA AT DISCLAIMER (Data Loss Disclaimer)',
            style: TextStyle(fontSize: 11.0, fontWeight: FontWeight.bold, fontFamily: 'serif', color: Colors.black),
          ),
          const SizedBox(height: 4),
          const BulletPointPrint(
            text: 'Local Data Storage: Ang system ay offline-first. Lahat ng listahan ng produkto, benta, at utang ay direktang naka-save sa memory/storage ng device ng Client at hindi sa online cloud server.',
          ),
          const BulletPointPrint(
            text: 'Backup Responsibility: Tungkulin ng Client na regular na mag-backup ng kanilang data gamit ang "Auto-Backup" o "Manual Backup" (Google Drive / Local export) na feature sa Settings ng app.',
          ),
          const BulletPointPrint(
            text: 'Data Loss Disclaimer: Ang Developer ay WALANG PANANAGUTAN (Not Liable) sa anumang pagkawala ng data, pagkabura ng records, o pagkasira ng files dulot ng pagkasira ng device, factory reset, virus, o maling paggamit ng Client.',
          ),
          const BulletPointPrint(
            text: 'Pabatid sa Resibo: Ang resibong inilalabas ng 58mm thermal printer ay para sa internal store tracking at customer reference lamang, at hindi opisyal na kapalit ng manual BIR Official Receipts/Invoices ng tindahan.',
          ),
          const SizedBox(height: 10),

          // Section 4
          const Text(
            '4. LIMITASYON NG LIBRENG SUPORTA (Support Limitations)',
            style: TextStyle(fontSize: 11.0, fontWeight: FontWeight.bold, fontFamily: 'serif', color: Colors.black),
          ),
          const SizedBox(height: 4),
          const BulletPointPrint(
            text: 'Single-Device Limit: Ang biniling lisensya ay para lamang sa iisang (1) device. Ang pag-install sa karagdagang device o cashier counter ay mangangailangan ng panibagong lisensya at hiwalay na bayad.',
          ),
          const BulletPointPrint(
            text: 'On-Site Service Fee: Pagkatapos ng 30 araw na libreng suporta, ang anumang on-site support visit o troubleshooting ay may karaniwang service fee na Php 300.00 – Php 500.00 kada bisita depende sa layo.',
          ),
          const BulletPointPrint(
            text: 'Custom Features: Hindi kasama sa libreng support ang paggawa ng mga bagong feature o custom modifications na wala sa kasalukuyang release ng software.',
          ),
          const SizedBox(height: 10),

          // Section 5
          const Text(
            '5. PAGMAMAY-ARI NG SOFTWARE (Software Ownership)',
            style: TextStyle(fontSize: 11.0, fontWeight: FontWeight.bold, fontFamily: 'serif', color: Colors.black),
          ),
          const SizedBox(height: 3),
          RichText(
            text: const TextSpan(
              style: TextStyle(fontSize: 11.0, fontFamily: 'serif', color: Colors.black, height: 1.35),
              children: [
                TextSpan(text: 'Ang binili ng Client ay ang '),
                TextSpan(text: 'lisensya sa paggamit (license to use)', style: TextStyle(fontWeight: FontWeight.bold)),
                TextSpan(text: ' para sa kanilang partikular na tindahan. Ang copyright, source code, at intellectual property ng application ay nananatiling 100% pagmamay-ari ng Developer. Mahigpit na ipinagbabawal ang pagkopya, pamamahagi, o muling pagbebenta ng system nang walang nakasulat na pahintulot mula sa Developer.'),
              ],
            ),
          ),
          const SizedBox(height: 10),

          // Section 6
          const Text(
            '6. PAGLABAG SA KASUNDUAN AT MGA PARUSA (Breach of Contract and Penalties)',
            style: TextStyle(fontSize: 11.0, fontWeight: FontWeight.bold, fontFamily: 'serif', color: Colors.black),
          ),
          const SizedBox(height: 4),
          const BulletPointPrint(
            text: 'Non-Payment: Kung hindi mabayaran ang balanse sa itinakdang petsa, may karapatan ang Developer na itigil ang suporta o pansamantalang bawiin ang lisensya hanggang sa mabayaran nang buo ang halaga.',
          ),
          const BulletPointPrint(
            text: 'Unauthorized Distribution / Piracy: Ang ilegal na pamimigay, pag-clone, o pagbenta ng application sa ibang indibidwal o tindahan ay may katapat na multang hindi bababa sa Php 50,000.00, bukod pa sa posibleng legal na aksyon sa ilalim ng Intellectual Property Code of the Philippines.',
          ),
          const BulletPointPrint(
            text: 'Termination & Refund: Ang seryosong paglabag sa kasunduang ito ay magbibigay ng karapatan sa Developer na wakasan ang lisensya nang walang ibabalik na bayad (No Refund).',
          ),
          const Spacer(),
          const Center(
            child: Text(
              'Pahina 2 ng 3',
              style: TextStyle(fontSize: 11, color: Colors.grey, fontFamily: 'serif'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPrintablePage3(SettingsProvider settings) {
    final ownerNameText = _ownerNameController.text.trim().isEmpty ? '_________________________' : _ownerNameController.text.trim().toUpperCase();
    final witness1Text = _witness1Controller.text.trim().toUpperCase();
    final witness2Text = _witness2Controller.text.trim().toUpperCase();

    return Container(
      width: 794,
      height: 1123,
      color: Colors.white,
      padding: const EdgeInsets.symmetric(horizontal: 56.0, vertical: 46.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'SA KATUNAYAN NG LAHAT, ang magkabilang panig ay nagkasundo at lumagda ngayong araw at taon na nakasaad sa itaas.',
            style: TextStyle(
              fontSize: 11.0,
              fontWeight: FontWeight.bold,
              fontFamily: 'serif',
              color: Colors.black,
              height: 1.35,
            ),
          ),
          const SizedBox(height: 40),

          // Signatories Grid/Row
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              // Developer Side
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    // Image asset for the developer signature
                    Transform.translate(
                      offset: const Offset(0, 20), // Nudges the signature down closer to the name
                      child: Container(
                        height: 140,
                        width: 280,
                        color: Colors.transparent,
                        child: Image.asset(
                          'assets/images/developer_signature.png',
                          fit: BoxFit.contain,
                          alignment: Alignment.bottomCenter,
                        ),
                      ),
                    ),
                    const Text(
                      'Mark Vincent B. Alegre',
                      style: TextStyle(
                        fontSize: 11.0,
                        fontWeight: FontWeight.bold,
                        fontFamily: 'serif',
                        color: Colors.black,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Container(
                      width: 220,
                      height: 1,
                      color: Colors.black,
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      "Developer's Signature over Printed Name",
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 9.5,
                        fontFamily: 'serif',
                        color: Colors.black,
                      ),
                    ),
                    const Text(
                      "Developer",
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 9.5,
                        fontFamily: 'serif',
                        color: Colors.black,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 40),

              // Client Side (With Scaled Signature)
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    // Canvas Box to draw scaled points
                    Container(
                      height: 50,
                      width: 180,
                      color: Colors.transparent,
                      child: CustomPaint(
                        painter: OffscreenSignaturePainter(
                          pointsList: _signaturePoints,
                          interactiveCanvasSize: _sigCanvasSize,
                        ),
                      ),
                    ),
                    Text(
                      ownerNameText,
                      style: const TextStyle(
                        fontSize: 11.0,
                        fontWeight: FontWeight.bold,
                        fontFamily: 'serif',
                        color: Colors.black,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Container(
                      width: 220,
                      height: 1,
                      color: Colors.black,
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      "Client's Signature over Printed Name",
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 9.5,
                        fontFamily: 'serif',
                        color: Colors.black,
                      ),
                    ),
                    const Text(
                      "Client / Store Owner",
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 9.5,
                        fontFamily: 'serif',
                        color: Colors.black,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 50),

          // Witnesses Section
          const Text(
            'MGA SAKSI (Witnesses):',
            style: TextStyle(
              fontSize: 11.0,
              fontWeight: FontWeight.bold,
              fontFamily: 'serif',
              color: Colors.black,
            ),
          ),
          const SizedBox(height: 12),
          Padding(
            padding: const EdgeInsets.only(left: 12.0),
            child: Column(
              children: [
                Row(
                  children: [
                    const Text('1. ', style: TextStyle(fontSize: 11.0, fontFamily: 'serif', color: Colors.black)),
                    witness1Text.isEmpty
                        ? const Text('_____________________________________', style: TextStyle(fontSize: 11.0, fontFamily: 'serif', color: Colors.black))
                        : Text(
                            witness1Text,
                            style: const TextStyle(
                              fontSize: 11.0,
                              fontWeight: FontWeight.bold,
                              fontFamily: 'serif',
                              color: Colors.black,
                              decoration: TextDecoration.underline,
                            ),
                          ),
                  ],
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    const Text('2. ', style: TextStyle(fontSize: 11.0, fontFamily: 'serif', color: Colors.black)),
                    witness2Text.isEmpty
                        ? const Text('_____________________________________', style: TextStyle(fontSize: 11.0, fontFamily: 'serif', color: Colors.black))
                        : Text(
                            witness2Text,
                            style: const TextStyle(
                              fontSize: 11.0,
                              fontWeight: FontWeight.bold,
                              fontFamily: 'serif',
                              color: Colors.black,
                              decoration: TextDecoration.underline,
                            ),
                          ),
                  ],
                ),
              ],
            ),
          ),

          const Spacer(),
          const Center(
            child: Text(
              'Pahina 3 ng 3',
              style: TextStyle(fontSize: 11, color: Colors.grey, fontFamily: 'serif'),
            ),
          ),
        ],
      ),
    );
  }
}

// Bullets
class BulletPoint extends StatelessWidget {
  final String text;
  const BulletPoint({super.key, required this.text});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6.0, left: 4.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('• ', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.primary)),
          Expanded(
            child: Text(
              text,
              style: const TextStyle(fontSize: 12, height: 1.35, color: Colors.black87),
            ),
          ),
        ],
      ),
    );
  }
}

class BulletPointPrint extends StatelessWidget {
  final String text;
  const BulletPointPrint({super.key, required this.text});

  @override
  Widget build(BuildContext context) {
    // Split bold prefix if any, e.g., "Single Device Installation: Pag-install..."
    final parts = text.split(': ');
    if (parts.length > 1) {
      return Padding(
        padding: const EdgeInsets.only(bottom: 4.0, left: 12.0),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('•  ', style: TextStyle(fontSize: 11.0, fontFamily: 'serif', color: Colors.black, fontWeight: FontWeight.bold)),
            Expanded(
              child: RichText(
                text: TextSpan(
                  style: const TextStyle(fontSize: 11.0, fontFamily: 'serif', color: Colors.black, height: 1.35),
                  children: [
                    TextSpan(text: '${parts[0]}: ', style: const TextStyle(fontWeight: FontWeight.bold)),
                    TextSpan(text: parts.sublist(1).join(': ')),
                  ],
                ),
              ),
            ),
          ],
        ),
      );
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 4.0, left: 12.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('•  ', style: TextStyle(fontSize: 11.0, fontFamily: 'serif', color: Colors.black, fontWeight: FontWeight.bold)),
          Expanded(
            child: Text(
              text,
              style: const TextStyle(fontSize: 11.0, fontFamily: 'serif', color: Colors.black, height: 1.35),
            ),
          ),
        ],
      ),
    );
  }
}

// Painters
class SignaturePainter extends CustomPainter {
  final List<List<Offset>> pointsList;

  SignaturePainter({required this.pointsList});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = const ui.Color(0xFF0F2C59) // Dark Slate Blue for signature ink
      ..strokeCap = StrokeCap.round
      ..strokeWidth = 3.5;

    for (final stroke in pointsList) {
      for (int i = 0; i < stroke.length - 1; i++) {
        canvas.drawLine(stroke[i], stroke[i + 1], paint);
      }
    }
  }

  @override
  bool shouldRepaint(covariant SignaturePainter oldDelegate) => true;
}

class OffscreenSignaturePainter extends CustomPainter {
  final List<List<Offset>> pointsList;
  final Size interactiveCanvasSize;

  OffscreenSignaturePainter({
    required this.pointsList,
    required this.interactiveCanvasSize,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.black
      ..strokeCap = StrokeCap.round
      ..strokeWidth = 3.0;

    double scaleX = size.width / (interactiveCanvasSize.width > 0 ? interactiveCanvasSize.width : 1.0);
    double scaleY = size.height / (interactiveCanvasSize.height > 0 ? interactiveCanvasSize.height : 1.0);
    
    // Scale proportionally to preserve shape
    double scale = scaleX < scaleY ? scaleX : scaleY;

    // Center drawing horizontally and vertically if desired
    double offsetX = (size.width - (interactiveCanvasSize.width * scale)) / 2.0;
    double offsetY = (size.height - (interactiveCanvasSize.height * scale)) / 2.0;

    for (final stroke in pointsList) {
      for (int i = 0; i < stroke.length - 1; i++) {
        final p1 = Offset(
          stroke[i].dx * scale + offsetX,
          stroke[i].dy * scale + offsetY,
        );
        final p2 = Offset(
          stroke[i + 1].dx * scale + offsetX,
          stroke[i + 1].dy * scale + offsetY,
        );
        canvas.drawLine(p1, p2, paint);
      }
    }
  }

  @override
  bool shouldRepaint(covariant OffscreenSignaturePainter oldDelegate) => true;
}

class DeveloperSignaturePainter extends CustomPainter {
  const DeveloperSignaturePainter();

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.black
      ..strokeCap = StrokeCap.round
      ..strokeWidth = 2.5
      ..style = PaintingStyle.stroke
      ..isAntiAlias = true;

    // Handwritten Alegre m. strokes coordinates scaled relative to 100x50 box
    final List<List<Offset>> strokes = [
      // Letter "A" loop and stem
      [
        const Offset(18, 42),
        const Offset(22, 28),
        const Offset(26, 16),
        const Offset(29, 10),
        const Offset(31, 8),
        const Offset(32, 10),
        const Offset(31, 18),
        const Offset(27, 30),
        const Offset(23, 40),
        const Offset(20, 44),
        const Offset(18, 44),
        const Offset(17, 40),
        const Offset(19, 32),
        const Offset(24, 26),
        const Offset(30, 24),
        const Offset(37, 26),
        const Offset(43, 30),
        const Offset(45, 36),
      ],
      // Loop connecting to "l"
      [
        const Offset(42, 28),
        const Offset(44, 14),
        const Offset(46, 10),
        const Offset(48, 11),
        const Offset(47, 18),
        const Offset(49, 28),
        const Offset(52, 36),
      ],
      // Cursive letters e-g-r-e
      [
        const Offset(52, 36),
        const Offset(54, 31),
        const Offset(56, 28),
        const Offset(55, 27),
        const Offset(53, 30),
        const Offset(55, 35),
        const Offset(58, 37),
        const Offset(61, 31),
        const Offset(59, 29),
        const Offset(57, 32),
        const Offset(59, 39),
        const Offset(61, 44),
        const Offset(63, 43),
        const Offset(65, 36),
        const Offset(67, 28),
        const Offset(66, 32),
        const Offset(68, 36),
        const Offset(71, 32),
        const Offset(73, 29),
        const Offset(72, 27),
        const Offset(70, 29),
        const Offset(71, 34),
        const Offset(74, 37),
      ],
      // Superscript letters "m"
      [
        const Offset(78, 22),
        const Offset(78, 27),
        const Offset(80, 24),
        const Offset(80, 27),
        const Offset(82, 24),
        const Offset(82, 27),
      ],
      // Dot after "m"
      [
        const Offset(85, 27),
      ]
    ];

    double scaleX = size.width / 100.0;
    double scaleY = size.height / 50.0;
    
    // Scale proportionally to preserve shape
    double scale = scaleX < scaleY ? scaleX : scaleY;

    // Center drawing horizontally and vertically
    double offsetX = (size.width - (100.0 * scale)) / 2.0;
    double offsetY = (size.height - (50.0 * scale)) / 2.0;

    for (final stroke in strokes) {
      if (stroke.isEmpty) continue;
      
      final path = Path();
      path.moveTo(
        stroke[0].dx * scale + offsetX,
        stroke[0].dy * scale + offsetY,
      );
      
      for (int i = 1; i < stroke.length; i++) {
        path.lineTo(
          stroke[i].dx * scale + offsetX,
          stroke[i].dy * scale + offsetY,
        );
      }
      
      canvas.drawPath(path, paint);
    }
  }

  @override
  bool shouldRepaint(covariant DeveloperSignaturePainter oldDelegate) => false;
}
