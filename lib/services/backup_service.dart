import 'dart:io';
import 'package:path/path.dart';
import 'package:sqflite/sqflite.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:intl/intl.dart';
import '../models/product.dart';
import '../models/sale.dart';
import 'database_helper.dart';

class BackupService {
  // Backup the database (.db) file to temporary folder and trigger Share dialog
  // Returns the size of the generated backup file in bytes, or -1 if failed.
  static Future<int> backupDatabase() async {
    try {
      final dbPath = await getDatabasesPath();
      final sourcePath = join(dbPath, 'sarisari_inventory.db');
      final sourceFile = File(sourcePath);

      if (!await sourceFile.exists()) {
        return -1;
      }

      final tempDir = await getTemporaryDirectory();
      final dateStr = DateFormat('yyyyMMdd_HHmmss').format(DateTime.now());
      final backupFileName = 'sarisari_inventory_backup_$dateStr.db';
      final backupPath = join(tempDir.path, backupFileName);
      
      // Copy database file directly to temporary folder for sharing
      await sourceFile.copy(backupPath);

      // Verify file size is valid before sharing
      final fileLength = await File(backupPath).length();
      if (fileLength <= 0) {
        return -1;
      }

      // Share the file
      final xFile = XFile(
        backupPath,
        mimeType: 'application/octet-stream',
        name: backupFileName,
      );
      await SharePlus.instance.share(
        ShareParams(
          files: [xFile],
          subject: 'Sari-Sari Inventory Database Backup',
        ),
      );
      return fileLength;
    } catch (_) {
      return -1;
    }
  }

  // Restore the database (.db) file
  // Returns null if successful, or an error message string if failed.
  static Future<String?> restoreDatabase(File pickedFile) async {
    try {
      if (!await pickedFile.exists()) return "File does not exist";

      // 1. Read first 16 bytes to check magic headers (bypasses Google Drive virtual path/extension issues)
      final fileStream = pickedFile.openRead(0, 16);
      final List<int> headerBytes = [];
      await for (final chunk in fileStream) {
        headerBytes.addAll(chunk);
      }
      
      bool isSqlite = false;
      if (headerBytes.length >= 15) {
        final headerStr = String.fromCharCodes(headerBytes.sublist(0, 15));
        if (headerStr == 'SQLite format 3') {
          isSqlite = true;
        }
      }

      if (!isSqlite) {
        return "Invalid file format: Not a valid SQLite database. Header bytes: $headerBytes";
      }

      final dbPath = await getDatabasesPath();
      final targetPath = join(dbPath, 'sarisari_inventory.db');

      // 1. Close database connection
      await DatabaseHelper.instance.closeDatabase();

      // 2. Overwrite target database file
      await pickedFile.copy(targetPath);

      // 3. Re-initialize database
      await DatabaseHelper.instance.database;
      
      return null; // Success
    } catch (e) {
      return e.toString();
    }
  }

  // Helper to format string fields for CSV safety
  static String _cleanCsvField(String value) {
    if (value.contains(',') || value.contains('"') || value.contains('\n') || value.contains('\r')) {
      final escaped = value.replaceAll('"', '""');
      return '"$escaped"';
    }
    return value;
  }

  // Convert products list to CSV string
  static String exportInventoryToCSV(List<Product> products) {
    final buffer = StringBuffer();
    // UTF-8 BOM so Excel opens it with correct UTF-8 character encoding (preserves ₱ symbol)
    buffer.write('\uFEFF');
    
    // Headers
    buffer.writeln('Product ID,Pangalan,Kategorya,Unit,Puhunan (Buying Price),Benta (Selling Price),Stock,Kabuuang Halaga,Barcode,Expiration Date');
    
    for (final p in products) {
      final id = p.id?.toString() ?? '';
      final name = _cleanCsvField(p.name);
      final category = _cleanCsvField(p.category);
      final unit = _cleanCsvField(p.unit);
      final buyingPrice = p.buyingPrice.toStringAsFixed(2);
      final sellingPrice = p.sellingPrice.toStringAsFixed(2);
      final currentStock = p.currentStock.toString();
      final totalValue = p.totalValue.toStringAsFixed(2);
      final barcode = _cleanCsvField(p.barcode ?? '');
      final expiryDate = p.expiryDate != null ? DateFormat('MM/dd/yyyy').format(p.expiryDate!) : '';
      
      buffer.writeln('$id,$name,$category,$unit,$buyingPrice,$sellingPrice,$currentStock,$totalValue,$barcode,$expiryDate');
    }
    return buffer.toString();
  }

  // Convert sales list to CSV string with aggregated summaries at the bottom
  static String exportSalesToCSV(List<Sale> sales) {
    final buffer = StringBuffer();
    // UTF-8 BOM for Excel compatibility
    buffer.write('\uFEFF');
    
    // Headers
    buffer.writeln('Sale ID,Petsa at Oras,Produkto,Dami,Unit,Presyo ng Benta,Kabuuang Benta,Puhunan per Unit,Kabuuang Puhunan,Tubo/Kita');
    
    double grandTotalSales = 0.0;
    double grandTotalCost = 0.0;
    double grandTotalProfit = 0.0;
    
    for (final s in sales) {
      final id = s.id?.toString() ?? '';
      final date = DateFormat('MM/dd/yyyy HH:mm').format(s.saleDate);
      final productName = _cleanCsvField(s.productName ?? 'Hindi kilalang Produkto');
      final quantity = s.quantity.toString();
      final unit = _cleanCsvField(s.productUnit ?? 'pcs');
      final sellingPrice = s.sellingPrice.toStringAsFixed(2);
      final totalPrice = s.totalPrice.toStringAsFixed(2);
      final buyingPrice = s.buyingPrice.toStringAsFixed(2);
      final totalCost = s.totalCost.toStringAsFixed(2);
      final profit = s.profit.toStringAsFixed(2);
      
      grandTotalSales += s.totalPrice;
      grandTotalCost += s.totalCost;
      grandTotalProfit += s.profit;
      
      buffer.writeln('$id,$date,$productName,$quantity,$unit,$sellingPrice,$totalPrice,$buyingPrice,$totalCost,$profit');
    }
    
    // Blank line before totals
    buffer.writeln();
    
    // Summary rows aligned to respective columns
    buffer.writeln(',,,,,,KABUUANG BENTA,,KABUUANG PUHUNAN,KABUUANG TUBO/KITA');
    buffer.writeln(',,,,,,${grandTotalSales.toStringAsFixed(2)},,${grandTotalCost.toStringAsFixed(2)},${grandTotalProfit.toStringAsFixed(2)}');
    
    return buffer.toString();
  }

  // Writes CSV string to temp directory and shares it
  static Future<bool> shareCSVReport(String csvContent, String filename) async {
    try {
      final tempDir = await getTemporaryDirectory();
      final filePath = join(tempDir.path, filename);
      final file = File(filePath);
      await file.writeAsString(csvContent);

      final xFile = XFile(filePath);
      await SharePlus.instance.share(
        ShareParams(
          files: [xFile],
          subject: 'Ulat mula sa Inventory - $filename',
        ),
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Automatically backs up the database file to app's local documents/backups directory.
  /// Retains only the last 7 auto-backups to prevent storage bloat.
  static Future<bool> autoBackupDatabase() async {
    try {
      final dbPath = await getDatabasesPath();
      final sourcePath = join(dbPath, 'sarisari_inventory.db');
      final sourceFile = File(sourcePath);

      if (!await sourceFile.exists()) return false;

      final appDir = await getApplicationDocumentsDirectory();
      final backupDir = Directory(join(appDir.path, 'backups'));
      if (!await backupDir.exists()) {
        await backupDir.create(recursive: true);
      }

      final dateStr = DateFormat('yyyyMMdd').format(DateTime.now());
      final backupFileName = 'sarisari_inventory_autobackup_$dateStr.db';
      final backupPath = join(backupDir.path, backupFileName);

      await sourceFile.copy(backupPath);
      
      // Cleanup old backups
      await cleanupOldBackups(backupDir);

      return true;
    } catch (_) {
      return false;
    }
  }

  /// Retains only the 7 most recent auto-backups.
  static Future<void> cleanupOldBackups(Directory backupDir) async {
    try {
      final files = await backupDir.list().toList();
      final autoBackups = files
          .whereType<File>()
          .where((f) => basename(f.path).startsWith('sarisari_inventory_autobackup_'))
          .toList();

      if (autoBackups.length > 7) {
        // Sort by filename (which has date string, e.g. sarisari_inventory_autobackup_20260811.db)
        autoBackups.sort((a, b) => basename(a.path).compareTo(basename(b.path)));
        
        final excess = autoBackups.length - 7;
        for (int i = 0; i < excess; i++) {
          if (await autoBackups[i].exists()) {
            await autoBackups[i].delete();
          }
        }
      }
    } catch (_) {}
  }

  /// Returns the list of all local backups (.db files) found in the local backups directory.
  static Future<List<File>> getLocalBackups() async {
    try {
      final appDir = await getApplicationDocumentsDirectory();
      final backupDir = Directory(join(appDir.path, 'backups'));
      if (!await backupDir.exists()) return [];

      final files = await backupDir.list().toList();
      final backups = files
          .whereType<File>()
          .where((f) => basename(f.path).endsWith('.db'))
          .toList();

      // Sort newest first
      backups.sort((a, b) => basename(b.path).compareTo(basename(a.path)));
      return backups;
    } catch (_) {
      return [];
    }
  }
}
