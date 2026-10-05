import 'dart:convert';
import 'dart:io';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';

class LicenseObfuscator {
  // Symmetric XOR Salt - must match generator.html
  static const String _salt = "jka_sari_secret_2026";

  /// Encrypts plaintext to an formatted uppercase HEX activation key.
  /// Format: XXXX-XXXX-XXXX-XXXX
  static String encrypt(String plainText) {
    final List<int> bytes = utf8.encode(plainText);
    final List<int> saltBytes = utf8.encode(_salt);
    
    final StringBuffer hexBuffer = StringBuffer();
    for (int i = 0; i < bytes.length; i++) {
      final int xorByte = bytes[i] ^ saltBytes[i % saltBytes.length];
      final String hex = xorByte.toRadixString(16).padLeft(2, '0');
      hexBuffer.write(hex);
    }
    
    final String rawHex = hexBuffer.toString().toUpperCase();
    final StringBuffer formatted = StringBuffer();
    for (int i = 0; i < rawHex.length; i++) {
      if (i > 0 && i % 4 == 0) {
        formatted.write('-');
      }
      formatted.write(rawHex[i]);
    }
    return formatted.toString();
  }

  /// Decrypts a formatted HEX key back to plaintext.
  static String? decrypt(String formattedHex) {
    try {
      final String rawHex = formattedHex.replaceAll('-', '').toLowerCase();
      final List<int> bytes = [];
      for (int i = 0; i < rawHex.length; i += 2) {
        final String sub = rawHex.substring(i, i + 2);
        final int val = int.parse(sub, radix: 16);
        bytes.add(val);
      }
      
      final List<int> saltBytes = utf8.encode(_salt);
      final List<int> plainBytes = List.filled(bytes.length, 0);
      for (int i = 0; i < bytes.length; i++) {
        plainBytes[i] = bytes[i] ^ saltBytes[i % saltBytes.length];
      }
      
      return utf8.decode(plainBytes);
    } catch (_) {
      return null;
    }
  }
}

class LicenseValidationResult {
  final bool isValid;
  final String message;
  final DateTime? expiryDate;
  final bool isClockTempered;

  LicenseValidationResult({
    required this.isValid,
    required this.message,
    this.expiryDate,
    this.isClockTempered = false,
  });
}

class LicenseService {
  /// Fetches unique hardware ID based on platform.
  static Future<String> getDeviceId() async {
    final DeviceInfoPlugin deviceInfo = DeviceInfoPlugin();
    try {
      if (Platform.isAndroid) {
        final AndroidDeviceInfo androidInfo = await deviceInfo.androidInfo;
        // Use android ID, fall back to hardware identifier if null
        return androidInfo.id.toUpperCase();
      } else if (Platform.isIOS) {
        final IosDeviceInfo iosInfo = await deviceInfo.iosInfo;
        return (iosInfo.identifierForVendor ?? 'UNKNOWN_IOS').toUpperCase();
      } else if (Platform.isWindows) {
        final WindowsDeviceInfo windowsInfo = await deviceInfo.windowsInfo;
        return windowsInfo.deviceId.replaceAll('{', '').replaceAll('}', '').toUpperCase();
      } else if (Platform.isMacOS) {
        final MacOsDeviceInfo macInfo = await deviceInfo.macOsInfo;
        return macInfo.systemGUID ?? 'UNKNOWN_MACOS';
      } else {
        return 'DEVICE-ID-GENERIC';
      }
    } catch (_) {
      return 'UNKNOWN-DEVICE';
    }
  }

  /// Checks if client altered device clock back in time.
  static Future<bool> checkClockRollback() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final lastCheckStr = prefs.getString('last_system_time') ?? '';
      final now = DateTime.now();
      
      if (lastCheckStr.isNotEmpty) {
        final lastCheck = DateTime.parse(lastCheckStr);
        // Flag if clock went backward by more than 2 hours (to tolerate timezone changes)
        if (now.isBefore(lastCheck.subtract(const Duration(hours: 2)))) {
          return true; 
        }
      }
      
      // Save current timestamp as latest valid system time checkpoint
      await prefs.setString('last_system_time', now.toIso8601String());
      return false;
    } catch (_) {
      return false;
    }
  }

  /// Resets clock check (useful on fresh activation or support overwrite).
  static Future<void> resetClockCheckpoint() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('last_system_time', DateTime.now().toIso8601String());
    } catch (_) {}
  }

  /// Parses and validates the activation key offline.
  static LicenseValidationResult validateKey(String key, String currentDeviceId) {
    if (key.trim().isEmpty) {
      return LicenseValidationResult(isValid: false, message: "Walang inilagay na Activation Key.");
    }
    
    final decrypted = LicenseObfuscator.decrypt(key);
    if (decrypted == null || !decrypted.contains('|')) {
      return LicenseValidationResult(isValid: false, message: "Maling Activation Key format o luma na.");
    }
    
    final parts = decrypted.split('|');
    if (parts.length != 2) {
      return LicenseValidationResult(isValid: false, message: "Maling Activation Key structure.");
    }
    
    final keyDeviceId = parts[0];
    final keyExpiryStr = parts[1];
    
    if (keyDeviceId.toUpperCase() != currentDeviceId.toUpperCase()) {
      return LicenseValidationResult(
        isValid: false,
        message: "Ang key na ito ay para sa ibang device (Device ID mismatch).",
      );
    }
    
    try {
      DateTime expiryDate = DateTime.parse(keyExpiryStr);
      final bool hasSpecificTime = keyExpiryStr.contains('T') || keyExpiryStr.contains(' ') || keyExpiryStr.contains(':');
      
      // If date-only was provided (e.g. "YYYY-MM-DD"), treat as expiring at 23:59:59 of that date
      if (!hasSpecificTime) {
        expiryDate = DateTime(expiryDate.year, expiryDate.month, expiryDate.day, 23, 59, 59);
      }
      
      final now = DateTime.now();
      
      if (expiryDate.isBefore(now)) {
        final formattedExpiry = hasSpecificTime
            ? DateFormat('MMMM dd, yyyy - hh:mm a').format(expiryDate)
            : DateFormat('MMMM dd, yyyy').format(expiryDate);
        return LicenseValidationResult(
          isValid: false,
          message: "Ang lisensya ay nag-expire na noong $formattedExpiry.",
          expiryDate: expiryDate,
        );
      }
      
      final formattedExpiry = hasSpecificTime
          ? DateFormat('MMMM dd, yyyy - hh:mm a').format(expiryDate)
          : DateFormat('MMMM dd, yyyy').format(expiryDate);
      return LicenseValidationResult(
        isValid: true,
        message: "Activated hanggang $formattedExpiry",
        expiryDate: expiryDate,
      );
    } catch (_) {
      return LicenseValidationResult(isValid: false, message: "Maling format ng petsa sa key.");
    }
  }

  /// Generates a human-friendly 6-character recovery challenge code from Device ID
  static String generatePinChallengeCode(String deviceId) {
    if (deviceId.isEmpty) return "REC-8899";
    final clean = deviceId.replaceAll('-', '').toUpperCase();
    final sub = clean.length >= 4 ? clean.substring(clean.length - 4) : clean.padLeft(4, '0');
    return "REC-$sub";
  }

  /// Calculates a 4-digit Master Unlock PIN from a Challenge Code or Device ID
  static String calculateMasterPin(String inputCode) {
    final clean = inputCode.replaceAll('-', '').trim().toUpperCase();
    const salt = "jka_pin_master_salt_2026";
    int hash = 5381;
    for (int i = 0; i < clean.length; i++) {
      hash = (((hash << 5) + hash) + clean.codeUnitAt(i)).toSigned(32);
    }
    for (int i = 0; i < salt.length; i++) {
      hash = (((hash << 5) + hash) + salt.codeUnitAt(i)).toSigned(32);
    }
    final int pinNumber = (hash.abs() % 9000) + 1000;
    return pinNumber.toString();
  }

  /// Verifies if the entered PIN matches the Developer Master PIN
  static bool verifyMasterPin(String enteredPin, String challengeOrDeviceId) {
    final clean = enteredPin.trim();
    if (clean.length != 4) return false;
    // Developer emergency universal master override: 9876
    if (clean == "9876") return true;
    final expectedPin = calculateMasterPin(challengeOrDeviceId);
    return clean == expectedPin;
  }
}
