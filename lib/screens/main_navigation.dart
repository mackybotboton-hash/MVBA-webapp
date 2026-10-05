import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/navigation_provider.dart';
import '../providers/settings_provider.dart';
import '../services/backup_service.dart';
import '../services/printer_service.dart';
import '../widgets/lazy_indexed_stack.dart';
import 'dashboard_screen.dart';
import 'product_list_screen.dart';
import 'stock_in_screen.dart';
import 'sales_screen.dart';
import 'sales_history_screen.dart';
import 'utang_screen.dart';
import 'pin_lock_screen.dart';
import 'license_lock_screen.dart';
import 'contract_screen.dart';
import '../main.dart';

class MainNavigation extends StatefulWidget {
  const MainNavigation({super.key});

  @override
  State<MainNavigation> createState() => _MainNavigationState();
}

class _MainNavigationState extends State<MainNavigation> with WidgetsBindingObserver {
  bool _isStartupUnlocked = false;
  Timer? _licensePeriodicTimer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _checkAutoBackup();
      _checkLicense();
      _checkPrinterConnection();
    });

    // Check license periodically every 15 seconds for real-time expiration locking
    _licensePeriodicTimer = Timer.periodic(const Duration(seconds: 15), (_) {
      _checkLicense();
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _licensePeriodicTimer?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // When returning to app from background or unlocking tablet
    if (state == AppLifecycleState.resumed) {
      _checkLicense();
      _checkAutoBackup();
      _checkPrinterConnection();
    }
  }

  Future<void> _checkLicense() async {
    try {
      final settings = Provider.of<SettingsProvider>(context, listen: false);
      await settings.checkLicenseStatus();
      if (!settings.isActivated && mounted) {
        // Pop any opened sub-routes/modals so the license lock screen is immediately visible
        appNavigatorKey.currentState?.popUntil((route) => route.isFirst);
      }
    } catch (_) {}
  }

  Future<void> _checkAutoBackup() async {
    try {
      final settings = Provider.of<SettingsProvider>(context, listen: false);
      if (!settings.autoBackupEnabled) return;

      final now = DateTime.now();
      final lastBackupStr = settings.lastAutoBackupDate;
      
      bool shouldBackup = false;
      if (lastBackupStr.isEmpty) {
        shouldBackup = true;
      } else {
        final lastBackup = DateTime.parse(lastBackupStr);
        final today = DateTime(now.year, now.month, now.day);
        final lastBackupDay = DateTime(lastBackup.year, lastBackup.month, lastBackup.day);
        final difference = today.difference(lastBackupDay).inDays;
        
        if (settings.autoBackupFrequency == 'daily' && difference >= 1) {
          shouldBackup = true;
        } else if (settings.autoBackupFrequency == 'weekly' && difference >= 7) {
          shouldBackup = true;
        }
      }

      if (shouldBackup) {
        final success = await BackupService.autoBackupDatabase();
        if (success) {
          await settings.setLastAutoBackupDate(now.toIso8601String());
        }
      }
    } catch (_) {}
  }

  Future<void> _checkPrinterConnection() async {
    try {
      bool btEnabled = await PrinterService.isBluetoothEnabled();
      if (!btEnabled) {
        btEnabled = await PrinterService.enableBluetooth();
      }

      if (btEnabled && mounted) {
        final settings = Provider.of<SettingsProvider>(context, listen: false);
        final macAddress = settings.selectedPrinterMac;
        
        if (macAddress.isNotEmpty) {
          bool connected = await PrinterService.isConnected();
          if (!connected) {
            await PrinterService.connect(macAddress);
          }
        }
      }
    } catch (_) {}
  }

  final List<Widget> _screens = [
    const DashboardScreen(),
    const ProductListScreen(),
    const StockInScreen(isTab: true),
    const SalesScreen(),
    const UtangScreen(),
    const SalesHistoryScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    final settings = Provider.of<SettingsProvider>(context);

    // 1. Primary Developer License Guard (Hardware & Expiration Check)
    if (!settings.isActivated) {
      return const LicenseLockScreen();
    }

    // 2. Legal Contract & Terms Agreement Guard
    if (!settings.hasAgreedToTerms) {
      return const ContractScreen();
    }

    // 3. Store Owner Startup PIN Lock
    final needLock = settings.isStartupLockEnabled && settings.hasPin;

    if (needLock && !_isStartupUnlocked) {
      return PinLockScreen(
        isStartup: true,
        onUnlocked: () {
          setState(() {
            _isStartupUnlocked = true;
          });
        },
      );
    }

    final navProvider = Provider.of<NavigationProvider>(context);
    final selectedIndex = navProvider.currentTabIndex;

    return Scaffold(
      body: LazyIndexedStack(
        index: selectedIndex,
        children: _screens,
      ),
      bottomNavigationBar: null,
    );
  }
}
