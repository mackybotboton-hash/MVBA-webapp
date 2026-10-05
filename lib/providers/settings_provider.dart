import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/license_service.dart';

class SettingsProvider with ChangeNotifier {
  String _storeName = 'My Sari-Sari Store';
  String _ownerName = 'Negosyante';
  String _selectedPrinterName = '';
  String _selectedPrinterMac = '';
  String _currencySymbol = '₱';
  bool _showExpiryDate = true;
  double _beepVolume = 80.0;
  double _vibrationStrength = 50.0;
  String _ownerPin = '';
  bool _isStartupLockEnabled = false;
  bool _isAdminLockEnabled = false;
  String _language = 'tl'; // 'tl' for Tagalog, 'en' for English
  bool _autoBackupEnabled = true;
  String _autoBackupFrequency = 'daily'; // 'daily' or 'weekly'
  String _lastAutoBackupDate = '';
  bool _hasAgreedToTerms = false;
  String _businessType = 'Sari-Sari Store';

  // Custom Categories & Units
  List<String> _productCategories = [
    'Beverages',
    'Canned Goods',
    'Snacks',
    'Condiments',
    'Personal Care',
    'Others'
  ];

  List<String> _productUnits = [
    'pcs',
    'pack',
    'box',
    'kg',
    'dozen'
  ];

  // Licensing properties
  String _licenseKey = '';
  bool _isActivated = false;
  String _deviceId = '';
  bool _isClockTempered = false;

  String get storeName => _storeName;
  String get ownerName => _ownerName;
  String get selectedPrinterName => _selectedPrinterName;
  String get selectedPrinterMac => _selectedPrinterMac;
  String get currencySymbol => _currencySymbol;
  bool get showExpiryDate => _showExpiryDate;
  double get beepVolume => _beepVolume;
  double get vibrationStrength => _vibrationStrength;
  String get ownerPin => _ownerPin;
  bool get isStartupLockEnabled => _isStartupLockEnabled;
  bool get isAdminLockEnabled => _isAdminLockEnabled;
  bool get hasPin => _ownerPin.isNotEmpty;
  String get language => _language;
  bool get isEnglish => _language == 'en';
  bool get autoBackupEnabled => _autoBackupEnabled;
  String get autoBackupFrequency => _autoBackupFrequency;
  String get lastAutoBackupDate => _lastAutoBackupDate;
  bool get hasAgreedToTerms => _hasAgreedToTerms;
  String get businessType => _businessType;
  
  List<String> get productCategories => _productCategories;
  List<String> get productUnits => _productUnits;

  // Licensing getters
  String get licenseKey => _licenseKey;
  bool get isActivated => _isActivated;
  String get deviceId => _deviceId;
  bool get isClockTempered => _isClockTempered;

  /// Helper to return localized text based on current language selection
  String tr(String tagalogText, String englishText) {
    return isEnglish ? englishText : tagalogText;
  }

  SettingsProvider() {
    loadSettings();
  }

  // ==========================================
  // SHARED PERSISTENCE HELPERS (Phase 5)
  // ==========================================
  // Replaces ~77 lines of repeated try/catch + SharedPreferences boilerplate
  // with a single generic helper per type.

  Future<void> _saveString(String key, String value) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(key, value);
    } catch (_) {}
  }

  Future<void> _saveBool(String key, bool value) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(key, value);
    } catch (_) {}
  }

  Future<void> _saveDouble(String key, double value) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setDouble(key, value);
    } catch (_) {}
  }

  Future<void> _saveStringList(String key, List<String> value) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setStringList(key, value);
    } catch (_) {}
  }

  // ==========================================
  // LOAD
  // ==========================================

  Future<void> loadSettings() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      _storeName = prefs.getString('storeName') ?? 'My Sari-Sari Store';
      _ownerName = prefs.getString('ownerName') ?? 'Negosyante';
      _selectedPrinterName = prefs.getString('selectedPrinterName') ?? '';
      _selectedPrinterMac = prefs.getString('selectedPrinterMac') ?? '';
      _currencySymbol = prefs.getString('currencySymbol') ?? '₱';
      _showExpiryDate = prefs.getBool('showExpiryDate') ?? true;
      _beepVolume = prefs.getDouble('beepVolume') ?? 80.0;
      _vibrationStrength = prefs.getDouble('vibrationStrength') ?? 50.0;
      _ownerPin = prefs.getString('ownerPin') ?? '';
      _isStartupLockEnabled = prefs.getBool('isStartupLockEnabled') ?? false;
      _isAdminLockEnabled = prefs.getBool('isAdminLockEnabled') ?? false;
      _language = prefs.getString('language') ?? 'tl';
      _autoBackupEnabled = prefs.getBool('autoBackupEnabled') ?? true;
      _autoBackupFrequency = prefs.getString('autoBackupFrequency') ?? 'daily';
      _lastAutoBackupDate = prefs.getString('lastAutoBackupDate') ?? '';
      _hasAgreedToTerms = prefs.getBool('hasAgreedToTerms') ?? false;
      _businessType = prefs.getString('businessType') ?? 'Sari-Sari Store';

      _productCategories = prefs.getStringList('productCategories') ?? _productCategories;
      _productUnits = prefs.getStringList('productUnits') ?? _productUnits;
      
      _licenseKey = prefs.getString('licenseKey') ?? '';
      
      // Load unique hardware ID
      _deviceId = await LicenseService.getDeviceId();
      
      // Check clock tempering
      _isClockTempered = await LicenseService.checkClockRollback();
      
      if (_isClockTempered) {
        _isActivated = false;
      } else if (_licenseKey.isNotEmpty) {
        final result = LicenseService.validateKey(_licenseKey, _deviceId);
        _isActivated = result.isValid;
      } else {
        _isActivated = false;
      }
      
      notifyListeners();
    } catch (_) {}
  }

  /// Validates and saves an activation license key
  Future<LicenseValidationResult> activateLicense(String key) async {
    final cleanKey = key.trim();
    if (_deviceId.isEmpty) {
      _deviceId = await LicenseService.getDeviceId();
    }
    final result = LicenseService.validateKey(cleanKey, _deviceId);
    if (result.isValid) {
      _licenseKey = cleanKey;
      _isActivated = true;
      _isClockTempered = false;
      await LicenseService.resetClockCheckpoint();
      await _saveString('licenseKey', cleanKey);
      notifyListeners();
    }
    return result;
  }

  /// Run check explicitly (for tab resumes / screen loads)
  Future<void> checkLicenseStatus() async {
    _isClockTempered = await LicenseService.checkClockRollback();
    if (_isClockTempered) {
      _isActivated = false;
    } else if (_licenseKey.isNotEmpty) {
      if (_deviceId.isEmpty) {
        _deviceId = await LicenseService.getDeviceId();
      }
      final result = LicenseService.validateKey(_licenseKey, _deviceId);
      _isActivated = result.isValid;
    } else {
      _isActivated = false;
    }
    notifyListeners();
  }

  /// Returns friendly status string of current license
  String getLicenseExpiryInfo() {
    if (!_isActivated || _licenseKey.isEmpty) {
      return tr('Hindi Activated (Locked)', 'Not Activated (Locked)');
    }
    final result = LicenseService.validateKey(_licenseKey, _deviceId);
    return result.message;
  }

  /// Clears the saved license key (useful for testing or re-locking)
  Future<void> resetLicense() async {
    _licenseKey = '';
    _isActivated = false;
    await _saveString('licenseKey', '');
    notifyListeners();
  }

  // ==========================================
  // SETTERS (using shared helpers)
  // ==========================================

  Future<void> setStoreName(String val) async {
    _storeName = val;
    notifyListeners();
    await _saveString('storeName', val);
  }

  Future<void> setOwnerName(String val) async {
    _ownerName = val;
    notifyListeners();
    await _saveString('ownerName', val);
  }

  Future<void> setSelectedPrinter(String name, String mac) async {
    _selectedPrinterName = name;
    _selectedPrinterMac = mac;
    notifyListeners();
    await _saveString('selectedPrinterName', name);
    await _saveString('selectedPrinterMac', mac);
  }

  Future<void> setCurrencySymbol(String val) async {
    _currencySymbol = val;
    notifyListeners();
    await _saveString('currencySymbol', val);
  }

  Future<void> setShowExpiryDate(bool val) async {
    _showExpiryDate = val;
    notifyListeners();
    await _saveBool('showExpiryDate', val);
  }

  Future<void> setBeepVolume(double val) async {
    _beepVolume = val;
    notifyListeners();
    await _saveDouble('beepVolume', val);
  }

  Future<void> setVibrationStrength(double val) async {
    _vibrationStrength = val;
    notifyListeners();
    await _saveDouble('vibrationStrength', val);
  }

  Future<void> setOwnerPin(String val) async {
    _ownerPin = val;
    notifyListeners();
    await _saveString('ownerPin', val);
  }

  Future<void> setStartupLockEnabled(bool val) async {
    _isStartupLockEnabled = val;
    notifyListeners();
    await _saveBool('isStartupLockEnabled', val);
  }

  Future<void> setAdminLockEnabled(bool val) async {
    _isAdminLockEnabled = val;
    notifyListeners();
    await _saveBool('isAdminLockEnabled', val);
  }

  Future<void> setLanguage(String val) async {
    _language = val;
    notifyListeners();
    await _saveString('language', val);
  }

  Future<void> setAutoBackupEnabled(bool val) async {
    _autoBackupEnabled = val;
    notifyListeners();
    await _saveBool('autoBackupEnabled', val);
  }

  Future<void> setAutoBackupFrequency(String val) async {
    _autoBackupFrequency = val;
    notifyListeners();
    await _saveString('autoBackupFrequency', val);
  }

  Future<void> setLastAutoBackupDate(String val) async {
    _lastAutoBackupDate = val;
    notifyListeners();
    await _saveString('lastAutoBackupDate', val);
  }

  Future<void> setHasAgreedToTerms(bool val) async {
    _hasAgreedToTerms = val;
    notifyListeners();
    await _saveBool('hasAgreedToTerms', val);
  }

  /// Resets owner PIN and disables PIN lock after Developer Master Unlock
  Future<void> resetOwnerPin() async {
    _ownerPin = '';
    _isStartupLockEnabled = false;
    _isAdminLockEnabled = false;
    notifyListeners();
    await _saveString('ownerPin', '');
    await _saveBool('isStartupLockEnabled', false);
    await _saveBool('isAdminLockEnabled', false);
  }
  // Customization methods
  Future<void> addProductCategory(String category) async {
    if (!_productCategories.contains(category)) {
      _productCategories.add(category);
      await _saveStringList('productCategories', _productCategories);
      notifyListeners();
    }
  }

  Future<void> removeProductCategory(String category) async {
    if (_productCategories.contains(category)) {
      _productCategories.remove(category);
      await _saveStringList('productCategories', _productCategories);
      notifyListeners();
    }
  }

  Future<void> addProductUnit(String unit) async {
    if (!_productUnits.contains(unit)) {
      _productUnits.add(unit);
      await _saveStringList('productUnits', _productUnits);
      notifyListeners();
    }
  }

  Future<void> removeProductUnit(String unit) async {
    if (_productUnits.contains(unit)) {
      _productUnits.remove(unit);
      await _saveStringList('productUnits', _productUnits);
      notifyListeners();
    }
  }

  Future<void> setBusinessType(String type, {bool resetCategories = false}) async {
    _businessType = type;
    await _saveString('businessType', type);
    
    if (resetCategories) {
      if (type == 'Hardware Store') {
        _productCategories = ['Electrical', 'Plumbing', 'Paints', 'Tools', 'Construction', 'Others'];
        _productUnits = ['pcs', 'meters', 'liters', 'kilos', 'rolls', 'box'];
      } else if (type == 'Pharmacy / Botika') {
        _productCategories = ['Generic Meds', 'Branded Meds', 'Vitamins', 'First Aid', 'Baby Care', 'Others'];
        _productUnits = ['pcs', 'tabs', 'caps', 'banig', 'box', 'bottle'];
      } else if (type == 'Mini-Mart / Grocery') {
        _productCategories = ['Canned Goods', 'Noodles', 'Beverages', 'Condiments', 'Frozen', 'Produce', 'Others'];
        _productUnits = ['pcs', 'pack', 'kg', 'box', 'dozen'];
      } else {
        // Sari-Sari Store
        _productCategories = ['Beverages', 'Canned Goods', 'Snacks', 'Condiments', 'Personal Care', 'Others'];
        _productUnits = ['pcs', 'pack', 'box', 'kg', 'dozen'];
      }
      await _saveStringList('productCategories', _productCategories);
      await _saveStringList('productUnits', _productUnits);
    }
    notifyListeners();
  }
}
