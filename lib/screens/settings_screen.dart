import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:print_bluetooth_thermal/print_bluetooth_thermal.dart';
import 'package:permission_handler/permission_handler.dart';
import '../providers/settings_provider.dart';
import '../services/printer_service.dart';
import 'backup_export_screen.dart';
import 'pin_lock_screen.dart';
import 'contract_screen.dart';
import 'manage_categories_units_screen.dart';
import '../utils/app_constants.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  static void navigate(BuildContext context) {
    final settings = Provider.of<SettingsProvider>(context, listen: false);
    if (settings.isAdminLockEnabled && settings.hasPin) {
      Navigator.push<bool>(
        context,
        MaterialPageRoute(
          builder: (context) => const PinLockScreen(
            isStartup: false,
          ),
        ),
      ).then((unlocked) {
        if (unlocked == true && context.mounted) {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (context) => const SettingsScreen()),
          );
        }
      });
    } else {
      Navigator.push(
        context,
        MaterialPageRoute(builder: (context) => const SettingsScreen()),
      );
    }
  }

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  static const _feedbackChannel = MethodChannel('com.sarisari.inventory/scan_feedback');

  Future<void> _playPreview(double volume, double strength) async {
    try {
      await _feedbackChannel.invokeMethod('playScanFeedback', {
        'volume': volume.toInt(),
        'vibrateStrength': strength.toInt(),
      });
    } catch (_) {}
  }

  final _storeNameController = TextEditingController();
  final _ownerNameController = TextEditingController();
  
  List<BluetoothInfo> _pairedDevices = [];
  bool _isScanning = false;
  bool _isConnecting = false;
  bool _isConnected = false;
  String _connectionError = '';

  @override
  void initState() {
    super.initState();
    final settings = Provider.of<SettingsProvider>(context, listen: false);
    _storeNameController.text = settings.storeName;
    _ownerNameController.text = settings.ownerName;
    _checkCurrentConnection();
    _loadPairedDevices();
  }

  @override
  void dispose() {
    _storeNameController.dispose();
    _ownerNameController.dispose();
    super.dispose();
  }

  Future<void> _checkCurrentConnection() async {
    final connected = await PrinterService.isConnected();
    if (mounted) {
      setState(() {
        _isConnected = connected;
      });
    }
  }

  Future<void> _loadPairedDevices() async {
    if (mounted) setState(() => _isScanning = true);
    
    // Request Bluetooth permissions dynamically
    try {
      await Permission.bluetoothConnect.request();
      await Permission.bluetoothScan.request();
      await Permission.location.request();
    } catch (_) {}

    final devices = await PrinterService.getBluetoothDevices();
    if (mounted) {
      setState(() {
        _pairedDevices = devices;
        _isScanning = false;
      });
    }
  }

  Future<void> _connectToPrinter(String name, String mac) async {
    if (mounted) {
      setState(() {
        _isConnecting = true;
        _connectionError = '';
      });
    }

    final success = await PrinterService.connect(mac);
    final settings = Provider.of<SettingsProvider>(context, listen: false);

    if (success) {
      await settings.setSelectedPrinter(name, mac);
      _checkCurrentConnection();
    } else {
      if (mounted) {
        setState(() {
          _connectionError = 'Hindi makakonekta sa $name. Pakibuksan ang printer at Bluetooth.';
        });
      }
    }

    if (mounted) {
      setState(() {
        _isConnecting = false;
      });
    }
  }

  Future<void> _disconnectPrinter() async {
    if (mounted) setState(() => _isConnecting = true);
    await PrinterService.disconnect();
    final settings = Provider.of<SettingsProvider>(context, listen: false);
    await settings.setSelectedPrinter('', '');
    _checkCurrentConnection();
    if (mounted) setState(() => _isConnecting = false);
  }

  Future<void> _testPrint() async {
    final settings = Provider.of<SettingsProvider>(context, listen: false);
    final success = await PrinterService.printTestReceipt(settings.storeName);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(success ? 'Naipadala ang test print sa printer!' : 'Hindi ma-test print. Paki-check ang Bluetooth connection.'),
          backgroundColor: success ? AppColors.secondary : Colors.red[800],
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final settings = Provider.of<SettingsProvider>(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Settings',
          style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
        ),
        backgroundColor: AppColors.primary,
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Language Selection Card
            Card(
              elevation: 2,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.language_rounded, color: AppColors.primary),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            settings.tr('Wika ng App (App Language)', 'App Language (Wika)'),
                            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.primary),
                          ),
                        ),
                      ],
                    ),
                    const Divider(height: 24),
                    Text(
                      settings.tr('Pumili ng wika ng application:', 'Select application language:'),
                      style: const TextStyle(fontSize: 13, color: Colors.black87),
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        Expanded(
                          child: ChoiceChip(
                            avatar: const Text('🇵🇭', style: TextStyle(fontSize: 16)),
                            label: const Center(child: Text('Tagalog', style: TextStyle(fontWeight: FontWeight.bold))),
                            selected: settings.language == 'tl',
                            selectedColor: AppColors.primary,
                            labelStyle: TextStyle(
                              color: settings.language == 'tl' ? Colors.white : Colors.black87,
                            ),
                            onSelected: (selected) {
                              if (selected) settings.setLanguage('tl');
                            },
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: ChoiceChip(
                            avatar: const Text('🇺🇸', style: TextStyle(fontSize: 16)),
                            label: const Center(child: Text('English', style: TextStyle(fontWeight: FontWeight.bold))),
                            selected: settings.language == 'en',
                            selectedColor: AppColors.primary,
                            labelStyle: TextStyle(
                              color: settings.language == 'en' ? Colors.white : Colors.black87,
                            ),
                            onSelected: (selected) {
                              if (selected) settings.setLanguage('en');
                            },
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Store details Config Card
            Card(
              elevation: 2,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.store_rounded, color: AppColors.primary),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            settings.tr('Detalye ng Tindahan', 'Store Details'),
                            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.primary),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                    const Divider(height: 24),
                    
                    // Store Name field
                    TextField(
                      controller: _storeNameController,
                      decoration: InputDecoration(
                        labelText: settings.tr('Pangalan ng Tindahan *', 'Store Name *'),
                        prefixIcon: const Icon(Icons.shop_two_outlined),
                      ),
                      onChanged: (val) => settings.setStoreName(val.trim()),
                    ),
                    const SizedBox(height: 16),
                    
                    // Owner Name field
                    TextField(
                      controller: _ownerNameController,
                      decoration: InputDecoration(
                        labelText: settings.tr('May-ari ng Tindahan *', 'Store Owner *'),
                        prefixIcon: const Icon(Icons.person_outline),
                      ),
                      onChanged: (val) => settings.setOwnerName(val.trim()),
                    ),
                    const SizedBox(height: 16),

                    // Business Type dropdown
                    DropdownButtonFormField<String>(
                      value: settings.businessType,
                      decoration: InputDecoration(
                        labelText: settings.tr('Uri ng Negosyo', 'Business Type'),
                        prefixIcon: const Icon(Icons.storefront_outlined),
                      ),
                      items: const [
                        DropdownMenuItem(value: 'Sari-Sari Store', child: Text('Sari-Sari Store')),
                        DropdownMenuItem(value: 'Mini-Mart / Grocery', child: Text('Mini-Mart / Grocery')),
                        DropdownMenuItem(value: 'Pharmacy / Botika', child: Text('Pharmacy / Botika')),
                        DropdownMenuItem(value: 'Hardware Store', child: Text('Hardware Store')),
                      ],
                      onChanged: (val) {
                        if (val != null && val != settings.businessType) {
                          showDialog(
                            context: context,
                            builder: (ctx) => AlertDialog(
                              title: Text(settings.tr('Palitan ang Uri ng Negosyo', 'Change Business Type')),
                              content: Text(settings.tr('Gusto mo bang i-reset ang iyong mga Kategorya at Units para sa negosyong ito?', 'Do you want to reset your Categories and Units to default for this business?')),
                              actions: [
                                TextButton(
                                  onPressed: () {
                                    settings.setBusinessType(val, resetCategories: false);
                                    Navigator.pop(ctx);
                                  },
                                  child: Text(settings.tr('Hindi', 'No')),
                                ),
                                ElevatedButton(
                                  onPressed: () {
                                    settings.setBusinessType(val, resetCategories: true);
                                    Navigator.pop(ctx);
                                  },
                                  style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: Colors.white),
                                  child: Text(settings.tr('Oo, i-reset', 'Yes, reset')),
                                ),
                              ],
                            ),
                          );
                        }
                      },
                    ),
                    const SizedBox(height: 16),

                    // Currency Symbol selector dropdown
                    DropdownButtonFormField<String>(
                      value: settings.currencySymbol,
                      decoration: InputDecoration(
                        labelText: settings.tr('Simbolo ng Pera', 'Default Currency Symbol'),
                        prefixIcon: const Icon(Icons.monetization_on_outlined),
                      ),
                      items: const [
                        DropdownMenuItem(value: '₱', child: Text('Peso (₱)')),
                        DropdownMenuItem(value: '\$', child: Text('Dollar (\$)')),
                        DropdownMenuItem(value: 'PHP', child: Text('PHP')),
                      ],
                      onChanged: (val) {
                        if (val != null) settings.setCurrencySymbol(val);
                      },
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Feature Options Toggles Card
            Card(
              elevation: 2,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.toggle_on_outlined, color: AppColors.primary),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            settings.tr('Mga Feature Options', 'Feature Options'),
                            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.primary),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                    const Divider(height: 24),
                    
                    SwitchListTile(
                      activeColor: AppColors.secondary,
                      title: Text(settings.tr('Petsa ng Pagkalipas (Expiry Date)', 'Expiry Date Feature')),
                      subtitle: Text(settings.tr('Ipakita o itago ang field para sa petsa ng expiry ng produkto.', 'Show or hide the expiry date field for products.')),
                      value: settings.showExpiryDate,
                      onChanged: (val) => settings.setShowExpiryDate(val),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Scan Feedback Card
            Card(
              elevation: 2,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.volume_up_rounded, color: AppColors.primary),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            settings.tr('Mga Tunog at Vibration (Feedback)', 'Sounds & Vibration Feedback'),
                            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.primary),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                    const Divider(height: 24),
                    
                    // Beep Volume Slider
                    Text(
                      settings.tr('Lakas ng Beep: ${settings.beepVolume.toInt()}%', 'Beep Volume: ${settings.beepVolume.toInt()}%'),
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                    SliderTheme(
                      data: SliderTheme.of(context).copyWith(
                        activeTrackColor: AppColors.secondary,
                        inactiveTrackColor: AppColors.surfaceBorder,
                        thumbColor: AppColors.primary,
                        overlayColor: AppColors.primary.withOpacity(0.2),
                      ),
                      child: Slider(
                        value: settings.beepVolume,
                        min: 0.0,
                        max: 100.0,
                        divisions: 10,
                        onChanged: (val) {
                          settings.setBeepVolume(val);
                        },
                        onChangeEnd: (val) {
                          _playPreview(val, settings.vibrationStrength);
                        },
                      ),
                    ),
                    
                    const SizedBox(height: 12),
                    
                    // Vibration Strength Slider
                    Text(
                      settings.tr('Lakas ng Vibration: ${settings.vibrationStrength.toInt()}%', 'Vibration Strength: ${settings.vibrationStrength.toInt()}%'),
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                    SliderTheme(
                      data: SliderTheme.of(context).copyWith(
                        activeTrackColor: AppColors.secondary,
                        inactiveTrackColor: AppColors.surfaceBorder,
                        thumbColor: AppColors.primary,
                        overlayColor: AppColors.primary.withOpacity(0.2),
                      ),
                      child: Slider(
                        value: settings.vibrationStrength,
                        min: 0.0,
                        max: 100.0,
                        divisions: 10,
                        onChanged: (val) {
                          settings.setVibrationStrength(val);
                        },
                        onChangeEnd: (val) {
                          _playPreview(settings.beepVolume, val);
                        },
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Security Settings Card
            Card(
              elevation: 2,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.security_rounded, color: AppColors.primary),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            settings.tr('Seguridad (Security PIN Lock)', 'Security PIN Lock'),
                            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.primary),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                    const Divider(height: 24),

                    // PIN Status and Set/Change Trigger
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: Icon(
                        settings.hasPin ? Icons.vpn_key_rounded : Icons.vpn_key_outlined,
                        color: settings.hasPin ? AppColors.secondary : Colors.grey,
                      ),
                      title: Text(
                        settings.hasPin ? settings.tr('May nakatakdang PIN Code', 'PIN Code Setup Active') : settings.tr('Walang PIN Code', 'No PIN Code Configured'),
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                      subtitle: Text(
                        settings.hasPin
                            ? settings.tr('I-tap upang baguhin o tanggalin ang iyong PIN.', 'Tap to change or remove your PIN.')
                            : settings.tr('Gumawa ng 4-digit PIN upang ma-secure ang app.', 'Create a 4-digit PIN to secure the app.'),
                      ),
                      trailing: ElevatedButton(
                        onPressed: () => _showPinSetupDialog(context),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.surfaceLight,
                          foregroundColor: AppColors.primary,
                          elevation: 0,
                        ),
                        child: Text(settings.hasPin ? settings.tr('Baguhin', 'Change') : settings.tr('I-set PIN', 'Set PIN')),
                      ),
                    ),

                    if (settings.hasPin) ...[
                      const Divider(height: 16),
                      // Startup Lock Switch
                      SwitchListTile(
                        activeColor: AppColors.secondary,
                        contentPadding: EdgeInsets.zero,
                        title: Text(settings.tr('Lock sa Pagsisimula (Startup Lock)', 'Startup Screen Lock')),
                        subtitle: Text(settings.tr('Hingian ng PIN sa tuwing bubuksan ang application.', 'Require PIN every time the app opens.')),
                        value: settings.isStartupLockEnabled,
                        onChanged: (val) => settings.setStartupLockEnabled(val),
                      ),

                      // Admin Actions Lock Switch
                      SwitchListTile(
                        activeColor: AppColors.secondary,
                        contentPadding: EdgeInsets.zero,
                        title: Text(settings.tr('Lock sa Admin Settings at Produkto', 'Settings & Product Admin Lock')),
                        subtitle: Text(settings.tr('Hingian ng PIN bago ma-access ang Settings at mag-edit/magbura ng produkto.', 'Require PIN to edit settings or modify products.')),
                        value: settings.isAdminLockEnabled,
                        onChanged: (val) => settings.setAdminLockEnabled(val),
                      ),
                      
                      const Divider(height: 16),
                      // Delete PIN Code Option
                      TextButton.icon(
                        onPressed: () => _showDisablePinConfirmation(context),
                        icon: const Icon(Icons.delete_outline_rounded, color: Colors.red),
                        label: Text(
                          settings.tr('Tanggalin ang PIN Code (Disable Security)', 'Remove PIN Code (Disable Security)'),
                          style: const TextStyle(color: Colors.red, fontWeight: FontWeight.w600),
                        ),
                        style: TextButton.styleFrom(
                          padding: EdgeInsets.zero,
                          alignment: Alignment.centerLeft,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Bluetooth printer setup card
            Card(
              elevation: 2,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Row(
                            children: [
                              const Icon(Icons.print_rounded, color: AppColors.primary),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  'Bluetooth Thermal Printer',
                                  style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.primary),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ),
                        ),
                        IconButton(
                          icon: _isScanning 
                              ? const SizedBox(
                                  width: 20, 
                                  height: 20, 
                                  child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary)
                                )
                              : const Icon(Icons.refresh, color: AppColors.primary),
                          onPressed: _isScanning ? null : _loadPairedDevices,
                        ),
                      ],
                    ),
                    const Divider(height: 20),

                    // Connection Status flag
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: _isConnected ? Colors.green.shade50 : Colors.orange.shade50,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: _isConnected ? Colors.green.shade200 : Colors.orange.shade200),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            _isConnected ? Icons.check_circle : Icons.warning_rounded,
                            color: _isConnected ? Colors.green[800] : Colors.orange[800],
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  _isConnected ? settings.tr('Konektado', 'Connected') : settings.tr('Hindi Konektado', 'Disconnected'),
                                  style: TextStyle(
                                    fontWeight: FontWeight.bold, 
                                    color: _isConnected ? Colors.green[900] : Colors.orange[900]
                                  ),
                                ),
                                if (settings.selectedPrinterName.isNotEmpty)
                                  Text(
                                    'Printer: ${settings.selectedPrinterName} (${settings.selectedPrinterMac})',
                                    style: TextStyle(fontSize: 12, color: Colors.grey[700]),
                                  ),
                              ],
                            ),
                          ),
                          if (_isConnected)
                            ElevatedButton(
                              onPressed: _isConnecting ? null : _disconnectPrinter,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.red[800],
                                foregroundColor: Colors.white,
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 0),
                              ),
                              child: Text(settings.tr('Disconnect', 'Disconnect'), style: const TextStyle(fontSize: 12)),
                            )
                          else if (settings.selectedPrinterMac.isNotEmpty)
                            ElevatedButton(
                              onPressed: _isConnecting 
                                  ? null 
                                  : () => _connectToPrinter(settings.selectedPrinterName, settings.selectedPrinterMac),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppColors.secondary,
                                foregroundColor: Colors.white,
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 0),
                              ),
                              child: _isConnecting 
                                  ? const SizedBox(width: 15, height: 15, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                                  : Text(settings.tr('Connect', 'Connect'), style: const TextStyle(fontSize: 12)),
                            ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),

                    if (_connectionError.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12.0),
                        child: Text(
                          _connectionError,
                          style: const TextStyle(color: Colors.red, fontSize: 13, fontWeight: FontWeight.w500),
                        ),
                      ),

                    if (_isConnected)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12.0),
                        child: SizedBox(
                          width: double.infinity,
                          child: ElevatedButton.icon(
                            onPressed: _testPrint,
                            icon: const Icon(Icons.print_rounded),
                            label: Text(settings.tr('Mag-print ng Test Receipt', 'Print Test Receipt')),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.primary,
                              foregroundColor: Colors.white,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                            ),
                          ),
                        ),
                      ),
                    
                    Text(
                      settings.tr('Paired Devices (I-pair muna ang printer sa system settings ng iyong phone):', 'Paired Devices (Pair printer in phone system settings first):'),
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.black54),
                    ),
                    const SizedBox(height: 8),

                    _pairedDevices.isEmpty
                        ? Center(
                            child: Padding(
                              padding: const EdgeInsets.all(16.0),
                              child: Text(
                                settings.tr('Walang paired Bluetooth device. I-check ang phone system Bluetooth settings.', 'No paired Bluetooth devices found. Please check phone settings.'),
                                textAlign: TextAlign.center,
                                style: const TextStyle(color: Colors.grey, fontSize: 12),
                              ),
                            ),
                          )
                        : ListView.separated(
                            shrinkWrap: true,
                            physics: const NeverScrollableScrollPhysics(),
                            itemCount: _pairedDevices.length,
                            separatorBuilder: (context, index) => const Divider(height: 1),
                            itemBuilder: (context, index) {
                              final dev = _pairedDevices[index];
                              final isCurrent = dev.macAdress == settings.selectedPrinterMac;
                              return ListTile(
                                dense: true,
                                contentPadding: EdgeInsets.zero,
                                leading: Icon(Icons.bluetooth, color: isCurrent ? AppColors.primary : Colors.grey),
                                title: Text(
                                  dev.name,
                                  style: TextStyle(fontWeight: isCurrent ? FontWeight.bold : FontWeight.normal),
                                ),
                                subtitle: Text(dev.macAdress),
                                trailing: isCurrent && _isConnected
                                    ? const Icon(Icons.check, color: AppColors.primary)
                                    : ElevatedButton(
                                        onPressed: _isConnecting 
                                            ? null 
                                            : () => _connectToPrinter(dev.name, dev.macAdress),
                                        style: ElevatedButton.styleFrom(
                                          backgroundColor: AppColors.surfaceLight,
                                          foregroundColor: AppColors.primary,
                                          elevation: 0,
                                        ),
                                        child: const Text('Connect'),
                                      ),
                              );
                            },
                          ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            Card(
              elevation: 2,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
              child: ListTile(
                leading: const Icon(Icons.category_rounded, color: AppColors.primary),
                title: Text(
                  settings.tr('Kategorya at Units (Categories & Units)', 'Categories & Units'),
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
                subtitle: Text(settings.tr('Magdagdag o mag-alis ng Kategorya at Unit of Measurement para sa negosyo mo', 'Add or remove Categories and Units of Measurement for your business')),
                trailing: const Icon(Icons.arrow_forward_ios_rounded, size: 16, color: AppColors.primary),
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (context) => const ManageCategoriesUnitsScreen()),
                  );
                },
              ),
            ),
            const SizedBox(height: 16),
            Card(
              elevation: 2,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
              child: ListTile(
                leading: const Icon(Icons.backup_rounded, color: AppColors.primary),
                title: Text(
                  settings.tr('Backup at Export ng Data', 'Data Backup & Export'),
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
                subtitle: Text(settings.tr('I-backup ang database o i-export ang mga ulat sa Excel/CSV', 'Backup database or export reports to Excel/CSV')),
                trailing: const Icon(Icons.arrow_forward_ios_rounded, size: 16, color: AppColors.primary),
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (context) => const BackupExportScreen()),
                  );
                },
              ),
            ),
            const SizedBox(height: 16),

            // License & Activation Management Card
            Card(
              elevation: 2,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.vpn_key_rounded, color: AppColors.primary),
                        const SizedBox(width: 8),
                        Text(
                          settings.tr('Lisensya at Activation (App License)', 'License & Activation'),
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: AppColors.primary,
                          ),
                        ),
                      ],
                    ),
                    const Divider(height: 20),
                    
                    // Device ID Display
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(
                        color: Colors.grey.shade100,
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
                                  settings.tr('DEVICE ID:', 'DEVICE ID:'),
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold,
                                    color: Colors.grey[600],
                                  ),
                                ),
                                const SizedBox(height: 2),
                                SelectableText(
                                  settings.deviceId.isEmpty ? 'LOADING...' : settings.deviceId,
                                  style: const TextStyle(
                                    fontSize: 14,
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
                            tooltip: settings.tr('Kopyahin ang Device ID', 'Copy Device ID'),
                            onPressed: settings.deviceId.isEmpty
                                ? null
                                : () {
                                    Clipboard.setData(ClipboardData(text: settings.deviceId));
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(
                                        content: Text(settings.tr('Kinopya ang Device ID!', 'Device ID copied!')),
                                        backgroundColor: AppColors.primary,
                                        duration: const Duration(seconds: 2),
                                      ),
                                    );
                                  },
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),

                    // Expiration info
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(Icons.verified_rounded, color: AppColors.secondary, size: 18),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            settings.getLicenseExpiryInfo(),
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: Colors.green.shade900,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),

                    // Action buttons: Update Key / Re-lock for testing
                    Row(
                      children: [
                        Expanded(
                          child: ElevatedButton.icon(
                            onPressed: () => _showUpdateLicenseDialog(context),
                            icon: const Icon(Icons.key_rounded, size: 16),
                            label: Text(
                              settings.tr('I-update ang Key', 'Update Key'),
                              style: const TextStyle(fontSize: 12),
                            ),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.primary,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 10),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        OutlinedButton.icon(
                          onPressed: () => _showResetLicenseConfirmation(context),
                          icon: const Icon(Icons.lock_reset_rounded, size: 16, color: Colors.orange),
                          label: Text(
                            settings.tr('I-lock (Test)', 'Lock (Test)'),
                            style: const TextStyle(fontSize: 12, color: Colors.orange),
                          ),
                          style: OutlinedButton.styleFrom(
                            side: const BorderSide(color: Colors.orange),
                            padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            Card(
              elevation: 2,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
              child: ListTile(
                leading: const Icon(Icons.gavel_rounded, color: AppColors.primary),
                title: Text(
                  settings.tr('Kontrata ng Software', 'Software Contract'),
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
                subtitle: Text(settings.tr('Buksan muli ang kontrata upang i-update o pirmahan', 'Open contract again to update or sign')),
                trailing: const Icon(Icons.arrow_forward_ios_rounded, size: 16, color: AppColors.primary),
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (context) => const ContractScreen()),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showUpdateLicenseDialog(BuildContext context) {
    final settings = Provider.of<SettingsProvider>(context, listen: false);
    final keyController = TextEditingController();
    String errorMsg = '';

    showDialog(
      context: context,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              title: Text(
                settings.tr('Palitan / I-renew ang Activation Key', 'Update / Renew Activation Key'),
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    settings.tr(
                      'Ilagay ang bagong Activation Key mula sa Key Generator para baguhin ang expiration date/time.',
                      'Enter the new Activation Key from Key Generator to change the expiration schedule.',
                    ),
                    style: const TextStyle(fontSize: 13, color: Colors.black87),
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: keyController,
                    textCapitalization: TextCapitalization.characters,
                    decoration: InputDecoration(
                      labelText: settings.tr('Activation Key', 'Activation Key'),
                      hintText: 'XXXX-XXXX-XXXX-XXXX',
                      prefixIcon: const Icon(Icons.vpn_key_rounded),
                    ),
                  ),
                  if (errorMsg.isNotEmpty) ...[
                    const SizedBox(height: 10),
                    Text(
                      errorMsg,
                      style: const TextStyle(color: Colors.red, fontSize: 12, fontWeight: FontWeight.bold),
                    ),
                  ],
                ],
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(dialogContext),
                  child: Text(settings.tr('I-cancel', 'Cancel')),
                ),
                ElevatedButton(
                  onPressed: () async {
                    final cleanKey = keyController.text.trim();
                    if (cleanKey.isEmpty) {
                      setDialogState(() {
                        errorMsg = settings.tr('Mangyaring ilagay ang key.', 'Please enter key.');
                      });
                      return;
                    }

                    final result = await settings.activateLicense(cleanKey);
                    if (result.isValid) {
                      if (dialogContext.mounted) {
                        Navigator.pop(dialogContext);
                      }
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(
                              settings.tr(
                                'Matagumpay na na-update ang lisensya!',
                                'License updated successfully!',
                              ),
                            ),
                            backgroundColor: AppColors.primary,
                          ),
                        );
                      }
                    } else {
                      if (dialogContext.mounted) {
                        setDialogState(() {
                          errorMsg = result.message;
                        });
                      }
                    }
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                  ),
                  child: Text(settings.tr('I-save at I-activate', 'Save & Activate')),
                ),
              ],
            );
          },
        );
      },
    );
  }

  void _showResetLicenseConfirmation(BuildContext context) {
    final settings = Provider.of<SettingsProvider>(context, listen: false);

    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: Text(
            settings.tr('I-lock ang App (Testing)', 'Lock App for Testing'),
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.orange),
          ),
          content: Text(
            settings.tr(
              'Ito ay mag-aalis sa kasalukuyang activation key at babalik sa License Lock Screen upang masubukan mo ang pag-activate ng bagong key.',
              'This will clear the current activation key and return to the License Lock Screen so you can test activating with a new key.',
            ),
            style: const TextStyle(fontSize: 13),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: Text(settings.tr('Huwag', 'Cancel')),
            ),
            ElevatedButton(
              onPressed: () async {
                Navigator.pop(context); // Close dialog
                Navigator.pop(context); // Close Settings screen
                await settings.resetLicense();
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.orange[800],
                foregroundColor: Colors.white,
              ),
              child: Text(settings.tr('Oo, I-lock Ngayon', 'Yes, Lock Now')),
            ),
          ],
        );
      },
    );
  }

  void _showPinSetupDialog(BuildContext context) {
    final settings = Provider.of<SettingsProvider>(context, listen: false);
    final pinController = TextEditingController();
    final confirmController = TextEditingController();
    final formKey = GlobalKey<FormState>();

    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: Text(
            settings.tr('Baguhin ang PIN Code', 'Change PIN Code'),
            style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.primary),
          ),
          content: Form(
            key: formKey,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    settings.tr('Maglagay ng 4-digit passcode upang ma-secure ang admin actions at startup.', 'Enter a 4-digit passcode to secure admin actions and startup.'),
                    style: const TextStyle(fontSize: 13, color: Colors.black54),
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: pinController,
                    obscureText: true,
                    keyboardType: TextInputType.number,
                    maxLength: 4,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    decoration: InputDecoration(
                      labelText: settings.tr('Bagong PIN (4 digits)', 'New PIN (4 digits)'),
                      border: const OutlineInputBorder(),
                      prefixIcon: const Icon(Icons.lock_outline_rounded),
                    ),
                    validator: (val) {
                      if (val == null || val.length != 4) {
                        return settings.tr('Dapat ay eksaktong 4 na numero.', 'Must be exactly 4 digits.');
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: confirmController,
                    obscureText: true,
                    keyboardType: TextInputType.number,
                    maxLength: 4,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    decoration: InputDecoration(
                      labelText: settings.tr('Kumpirmahin ang PIN', 'Confirm PIN'),
                      border: const OutlineInputBorder(),
                      prefixIcon: const Icon(Icons.lock_outline_rounded),
                    ),
                    validator: (val) {
                      if (val != pinController.text) {
                        return settings.tr('Hindi nagtutugma ang PIN.', 'PINs do not match.');
                      }
                      return null;
                    },
                  ),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: Text(settings.tr('I-cancel', 'Cancel')),
            ),
            ElevatedButton(
              onPressed: () {
                if (formKey.currentState!.validate()) {
                  settings.setOwnerPin(pinController.text);
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(settings.tr('Matagumpay na nai-set ang iyong PIN Code!', 'PIN Code successfully set!')),
                      backgroundColor: AppColors.secondary,
                    ),
                  );
                }
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
              ),
              child: Text(settings.tr('I-save', 'Save')),
            ),
          ],
        );
      },
    );
  }

  void _showDisablePinConfirmation(BuildContext context) {
    final settings = Provider.of<SettingsProvider>(context, listen: false);
    final pinController = TextEditingController();
    final formKey = GlobalKey<FormState>();

    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: Text(
            settings.tr('Tanggalin ang PIN Security?', 'Remove PIN Security?'),
            style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.red),
          ),
          content: Form(
            key: formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  settings.tr('Babala: Mabubura ang iyong PIN at mawawala ang lock screen sa pagsisimula at sa admin settings.', 'Warning: Your PIN will be deleted, disabling startup lock and settings lock.'),
                  style: const TextStyle(fontSize: 13, color: Colors.black54),
                ),
                const SizedBox(height: 16),
                TextFormField(
                  controller: pinController,
                  obscureText: true,
                  keyboardType: TextInputType.number,
                  maxLength: 4,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                  decoration: InputDecoration(
                    labelText: settings.tr('Ipasok ang kasalukuyang PIN', 'Enter current PIN'),
                    border: const OutlineInputBorder(),
                    prefixIcon: const Icon(Icons.lock_outline_rounded),
                  ),
                  validator: (val) {
                    if (val != settings.ownerPin) {
                      return settings.tr('Maling PIN. Subukan muli.', 'Incorrect PIN. Try again.');
                    }
                    return null;
                  },
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: Text(settings.tr('I-cancel', 'Cancel')),
            ),
            ElevatedButton(
              onPressed: () {
                if (formKey.currentState!.validate()) {
                  // Reset toggles first, then delete PIN
                  settings.setStartupLockEnabled(false);
                  settings.setAdminLockEnabled(false);
                  settings.setOwnerPin('');
                  
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(settings.tr('Tinanggal na ang PIN Security.', 'PIN Security removed.')),
                      backgroundColor: Colors.orange,
                    ),
                  );
                }
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.red[800],
                foregroundColor: Colors.white,
              ),
              child: Text(settings.tr('Oo, Tanggalin', 'Yes, Delete')),
            ),
          ],
        );
      },
    );
  }
}
