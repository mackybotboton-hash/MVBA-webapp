import 'dart:convert';
import 'package:flutter/services.dart';
import 'package:print_bluetooth_thermal/print_bluetooth_thermal.dart';
import '../models/product.dart';
import 'package:intl/intl.dart';

class PrinterService {
  static const int _lineLength = 32; // 58mm standard printer line length
  static const _btChannel = MethodChannel('com.sarisari.inventory/bluetooth');

  /// Prompts the user with the native Android "Turn on Bluetooth?" dialog.
  /// Returns true if the user accepted and Bluetooth was enabled.
  static Future<bool> enableBluetooth() async {
    try {
      final result = await _btChannel.invokeMethod<bool>('enableBluetooth');
      return result ?? false;
    } catch (_) {
      return false;
    }
  }

  /// Opens the system Bluetooth settings page as a fallback.
  static Future<void> openBluetoothSettings() async {
    try {
      await _btChannel.invokeMethod('openBluetoothSettings');
    } catch (_) {}
  }


  // Scan and get list of paired devices
  static Future<List<BluetoothInfo>> getBluetoothDevices() async {
    try {
      final List<BluetoothInfo> list = await PrintBluetoothThermal.pairedBluetooths;
      return list;
    } catch (_) {
      return [];
    }
  }

  // Check if bluetooth is enabled
  static Future<bool> isBluetoothEnabled() async {
    try {
      return await PrintBluetoothThermal.bluetoothEnabled;
    } catch (_) {
      return false;
    }
  }

  // Connect to a device by MAC address
  static Future<bool> connect(String macAddress) async {
    try {
      return await PrintBluetoothThermal.connect(macPrinterAddress: macAddress);
    } catch (_) {
      return false;
    }
  }

  // Disconnect from the current device
  static Future<bool> disconnect() async {
    try {
      return await PrintBluetoothThermal.disconnect;
    } catch (_) {
      return false;
    }
  }

  // Check if a printer is connected
  static Future<bool> isConnected() async {
    try {
      return await PrintBluetoothThermal.connectionStatus;
    } catch (_) {
      return false;
    }
  }

  // Format Helper: Left and Right align text on one line (e.g. for pricing)
  static String _justifyText(String left, String right) {
    final spacesNeeded = _lineLength - left.length - right.length;
    if (spacesNeeded <= 0) {
      return '$left $right'; // fallback
    }
    return '$left${' ' * spacesNeeded}$right';
  }

  // Format Helper: Separator line
  static String _separatorLine({String char = '-'}) {
    return char * _lineLength;
  }

  // Compile ESC/POS bytes for sale receipt
  static List<int> _buildReceiptBytes({
    required String storeName,
    required String ownerName,
    required List<Map<String, dynamic>> items, // [{ 'name': ..., 'qty': ..., 'price': ..., 'subtotal': ... }]
    required double total,
    required double amountPaid,
    required double changeGiven,
    required String currencySymbol,
    String? creditCustomerName,
  }) {
    List<int> bytes = [];

    // Initialize printer
    bytes.addAll([0x1B, 0x40]);

    // Store Name (Bold, Center, Double Height/Width)
    bytes.addAll([0x1B, 0x61, 0x01]); // Center align
    bytes.addAll([0x1B, 0x45, 0x01]); // Bold on
    bytes.addAll([0x1D, 0x21, 0x11]); // Double height/width
    bytes.addAll(latin1.encode('$storeName\n'));
    
    // Reset sizes to normal, keep center
    bytes.addAll([0x1D, 0x21, 0x00]); // Normal size
    bytes.addAll([0x1B, 0x45, 0x00]); // Bold off
    if (ownerName.isNotEmpty) {
      bytes.addAll(latin1.encode('Prop: $ownerName\n'));
    }
    
    final dateTimeStr = DateFormat('MM/dd/yyyy hh:mm a').format(DateTime.now());
    bytes.addAll(latin1.encode('$dateTimeStr\n'));
    
    // Add Separator Line
    bytes.addAll([0x1B, 0x61, 0x00]); // Left align
    bytes.addAll(latin1.encode(_separatorLine() + '\n'));

    // Column Headers
    bytes.addAll(latin1.encode(_justifyText('Item (Qty x Presyo)', 'Halaga') + '\n'));
    bytes.addAll(latin1.encode(_separatorLine() + '\n'));

    // Print Items
    for (var item in items) {
      final name = item['name'] as String;
      final qty = item['qty'];
      final price = item['price'] as double;
      final subtotal = item['subtotal'] as double;

      // Print item name on its own line if too long
      if (name.length > 18) {
        bytes.addAll(latin1.encode('$name\n'));
        final detailsStr = '  $qty x ${price.toStringAsFixed(2)}';
        final subtotalStr = '$currencySymbol${subtotal.toStringAsFixed(2)}';
        bytes.addAll(latin1.encode(_justifyText(detailsStr, subtotalStr) + '\n'));
      } else {
        final leftStr = '$name (x$qty)';
        final subtotalStr = '$currencySymbol${subtotal.toStringAsFixed(2)}';
        bytes.addAll(latin1.encode(_justifyText(leftStr, subtotalStr) + '\n'));
      }
    }

    bytes.addAll(latin1.encode(_separatorLine() + '\n'));

    // Grand Total, Paid, Change (Bold, Right)
    bytes.addAll([0x1B, 0x61, 0x02]); // Right align
    bytes.addAll([0x1B, 0x45, 0x01]); // Bold on
    bytes.addAll(latin1.encode('KABUOAN: $currencySymbol${total.toStringAsFixed(2)}\n'));
    if (creditCustomerName != null) {
      bytes.addAll(latin1.encode('PARAAN: UTANG (CREDIT)\n'));
      bytes.addAll(latin1.encode('PANGALAN: $creditCustomerName\n'));
    } else {
      bytes.addAll(latin1.encode('BAYAD: $currencySymbol${amountPaid.toStringAsFixed(2)}\n'));
      bytes.addAll(latin1.encode('SUKLI: $currencySymbol${changeGiven.toStringAsFixed(2)}\n'));
    }
    bytes.addAll([0x1B, 0x45, 0x00]); // Bold off

    bytes.addAll(latin1.encode(_separatorLine() + '\n'));

    // Footer (Center)
    bytes.addAll([0x1B, 0x61, 0x01]); // Center align
    bytes.addAll(latin1.encode('Salamat sa inyong pagbili!\n\n'));

    // Feed paper
    bytes.addAll([0x1B, 0x64, 0x04]); // Feed 4 lines

    return bytes;
  }

  // Print transaction receipt
  static Future<bool> printReceipt({
    required String storeName,
    required String ownerName,
    required List<Map<String, dynamic>> items,
    required double total,
    required double amountPaid,
    required double changeGiven,
    required String currencySymbol,
    String? creditCustomerName,
  }) async {
    try {
      final isConnectedDevice = await isConnected();
      if (!isConnectedDevice) return false;

      final bytes = _buildReceiptBytes(
        storeName: storeName,
        ownerName: ownerName,
        items: items,
        total: total,
        amountPaid: amountPaid,
        changeGiven: changeGiven,
        currencySymbol: currencySymbol == '₱' ? 'P' : currencySymbol, // Fallback '₱' symbol to standard ASCII 'P'
        creditCustomerName: creditCustomerName,
      );

      final result = await PrintBluetoothThermal.writeBytes(bytes);
      return result;
    } catch (_) {
      return false;
    }
  }

  // Compile ESC/POS bytes for inventory report
  static List<int> _buildInventoryBytes({
    required String storeName,
    required List<Product> products,
    required double totalVal,
  }) {
    List<int> bytes = [];

    // Initialize printer
    bytes.addAll([0x1B, 0x40]);

    // Title (Center, Bold, Large)
    bytes.addAll([0x1B, 0x61, 0x01]); // Center
    bytes.addAll([0x1B, 0x45, 0x01]); // Bold on
    bytes.addAll([0x1D, 0x21, 0x11]); // Double size
    bytes.addAll(latin1.encode('ULAT SA STOCKS\n'));
    
    // Normal size, center
    bytes.addAll([0x1D, 0x21, 0x00]);
    bytes.addAll([0x1B, 0x45, 0x00]);
    bytes.addAll(latin1.encode('$storeName\n'));
    
    final dateTimeStr = DateFormat('MM/dd/yyyy hh:mm a').format(DateTime.now());
    bytes.addAll(latin1.encode('Petsa: $dateTimeStr\n'));

    // Separator
    bytes.addAll([0x1B, 0x61, 0x00]); // Left align
    bytes.addAll(latin1.encode(_separatorLine() + '\n'));
    bytes.addAll(latin1.encode(_justifyText('Item (Stock)', 'Threshold') + '\n'));
    bytes.addAll(latin1.encode(_separatorLine() + '\n'));

    // Products stock levels
    for (var prod in products) {
      final isLow = prod.isLowStock;
      final name = prod.name;
      final stockStr = '${prod.currentStock % 1 == 0 ? prod.currentStock.toInt() : prod.currentStock} ${prod.unit}';
      
      final label = isLow ? '*$name' : name; // Highlight low stock items with * prefix
      
      bytes.addAll(latin1.encode(_justifyText(
        label.length > 18 ? label.substring(0, 18) : label,
        '$stockStr / ${prod.minStockThreshold.toInt()}',
      ) + '\n'));
    }

    bytes.addAll(latin1.encode(_separatorLine() + '\n'));

    // Valuation Summary
    bytes.addAll([0x1B, 0x45, 0x01]); // Bold
    bytes.addAll(latin1.encode('Halaga ng Stocks (Puhunan):\n'));
    bytes.addAll([0x1B, 0x61, 0x02]); // Right
    bytes.addAll(latin1.encode('PHP ${totalVal.toStringAsFixed(2)}\n'));
    bytes.addAll([0x1B, 0x45, 0x00]); // Bold off

    bytes.addAll(latin1.encode(_separatorLine() + '\n'));
    
    // Note footer
    bytes.addAll([0x1B, 0x61, 0x01]); // Center
    bytes.addAll(latin1.encode('(*) May mababang stock (Low Stock)\n\n'));

    // Feed paper
    bytes.addAll([0x1B, 0x64, 0x04]);

    return bytes;
  }

  // Print Inventory Report
  static Future<bool> printInventoryReport({
    required String storeName,
    required List<Product> products,
    required double totalVal,
  }) async {
    try {
      final isConnectedDevice = await isConnected();
      if (!isConnectedDevice) return false;

      final bytes = _buildInventoryBytes(
        storeName: storeName,
        products: products,
        totalVal: totalVal,
      );

      final result = await PrintBluetoothThermal.writeBytes(bytes);
      return result;
    } catch (_) {
      return false;
    }
  }

  // Test Print
  static Future<bool> printTestReceipt(String storeName) async {
    try {
      final isConnectedDevice = await isConnected();
      if (!isConnectedDevice) return false;

      List<int> bytes = [];
      bytes.addAll([0x1B, 0x40]); // Init
      bytes.addAll([0x1B, 0x61, 0x01]); // Center
      bytes.addAll([0x1B, 0x45, 0x01]); // Bold
      bytes.addAll(latin1.encode('TEST PRINT SUCCESS!\n'));
      bytes.addAll([0x1B, 0x45, 0x00]);
      bytes.addAll(latin1.encode('Mula kay: $storeName\n'));
      bytes.addAll(latin1.encode('Konektado na ang iyong PT-220.\n'));
      bytes.addAll(latin1.encode('================================\n'));
      bytes.addAll(latin1.encode(DateFormat('MM/dd/yyyy hh:mm a').format(DateTime.now()) + '\n\n'));
      bytes.addAll([0x1B, 0x64, 0x04]); // Feed 4 lines

      final result = await PrintBluetoothThermal.writeBytes(bytes);
      return result;
    } catch (_) {
      return false;
    }
  }
}
