import 'dart:io';
import 'dart:ui' as ui;
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:provider/provider.dart';
import 'package:file_picker/file_picker.dart';
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:gal/gal.dart';
import '../providers/inventory_provider.dart';
import '../models/product.dart';
import '../models/sale.dart';
import '../services/backup_service.dart';
import '../providers/settings_provider.dart';
import '../widgets/app_loading_overlay.dart';
import '../utils/currency_formatter.dart';
import 'package:path/path.dart' as p;
import '../utils/app_constants.dart';

class BackupExportScreen extends StatefulWidget {
  const BackupExportScreen({super.key});

  @override
  State<BackupExportScreen> createState() => _BackupExportScreenState();
}

class _BackupExportScreenState extends State<BackupExportScreen> {
  bool _isLoading = false;
  String _selectedSalesPeriod = 'Lahat';
  List<File> _localBackups = [];
  Widget? _captureWidget;
  final GlobalKey _boundaryKey = GlobalKey();

  @override
  void initState() {
    super.initState();
    _loadLocalBackups();
  }

  Future<void> _loadLocalBackups() async {
    final list = await BackupService.getLocalBackups();
    setState(() {
      _localBackups = list;
    });
  }

  Future<void> _handleLocalRestore(File file) async {
    final settings = Provider.of<SettingsProvider>(context, listen: false);
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: Text(settings.tr('I-restore ang Local Backup?', 'Restore Local Backup?')),
          content: Text(
            settings.tr(
              'Sigurado ka bang nais mong i-restore ang backup mula sa petsa na ito?\n\n'
              'Babala: Lahat ng iyong kasalukuyang impormasyon ay mapapalitan ng data mula sa backup na ito.',
              'Are you sure you want to restore the backup from this date?\n\n'
              'Warning: All your current data will be overwritten by this backup.'
            )
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: Text(settings.tr('I-cancel', 'Cancel')),
            ),
            ElevatedButton(
              onPressed: () => Navigator.pop(context, true),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.red[800],
                foregroundColor: Colors.white,
              ),
              child: Text(settings.tr('Oo, I-restore', 'Yes, Restore')),
            ),
          ],
        );
      },
    );

    if (confirm != true) return;

    String? errorMessage;
    final success = await AppLoadingOverlay.runWithLoading(
      context: context,
      message: settings.tr('I-ne-restore ang database...', 'Restoring database...'),
      asyncTask: () async {
        final err = await BackupService.restoreDatabase(file);
        errorMessage = err;
        final res = (err == null);
        if (res && mounted) {
          final provider = Provider.of<InventoryProvider>(context, listen: false);
          await provider.loadData();
        }
        return res;
      },
    );

    if (mounted) {
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (context) => AlertDialog(
          title: Text(success ? settings.tr('Matagumpay ang Restore!', 'Restore Successful!') : settings.tr('Pumalya ang Restore', 'Restore Failed')),
          content: Text(
            success 
                ? settings.tr('Matagumpay na naibalik ang iyong mga impormasyon. I-restart ang application upang masigurong walang error sa database.', 'Your data has been successfully restored. Please restart the app to ensure database consistency.')
                : settings.tr('Hindi naibalik ang database. Error: $errorMessage', 'Database was not restored. Error: $errorMessage'),
          ),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.pop(context);
                if (success) {
                  Navigator.pop(context); // Go back to settings
                }
              },
              child: const Text('OK'),
            ),
          ],
        ),
      );
    }
  }

  Future<void> _handleLocalDelete(File file) async {
    final settings = Provider.of<SettingsProvider>(context, listen: false);
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: Text(settings.tr('Burahin ang Backup File?', 'Delete Backup File?')),
          content: Text(
            settings.tr(
              'Sigurado ka bang nais mong burahin ang backup file na ito?\n\n'
              'Hindi na ito mababawi kapag nabura.',
              'Are you sure you want to delete this backup file?\n\n'
              'This action cannot be undone.'
            )
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: Text(settings.tr('I-cancel', 'Cancel')),
            ),
            ElevatedButton(
              onPressed: () => Navigator.pop(context, true),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.red[800],
                foregroundColor: Colors.white,
              ),
              child: Text(settings.tr('Oo, Burahin', 'Yes, Delete')),
            ),
          ],
        );
      },
    );

    if (confirm != true) return;

    try {
      if (await file.exists()) {
        await file.delete();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(settings.tr('Matagumpay na nabura ang backup file!', 'Backup file successfully deleted!')),
              backgroundColor: AppColors.secondary,
            ),
          );
        }
        _loadLocalBackups(); // Reload list
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(settings.tr('Pumalya ang pagbura ng backup file.', 'Failed to delete backup file.')),
            backgroundColor: Colors.red[800],
          ),
        );
      }
    }
  }

  Future<String?> _showFormatSelector() async {
    final settings = Provider.of<SettingsProvider>(context, listen: false);
    return await showModalBottomSheet<String>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 20.0),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  settings.tr('Piliin ang Format ng Export', 'Choose Export Format'),
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),
                ListTile(
                  leading: CircleAvatar(
                    backgroundColor: Colors.green.shade50,
                    child: const Icon(Icons.table_view_rounded, color: Colors.green),
                  ),
                  title: Text(settings.tr('Excel / CSV File (.csv)', 'Excel / CSV File (.csv)')),
                  subtitle: Text(
                    settings.tr(
                      'Pinakamainam para sa Microsoft Excel o Google Sheets. Ligtas na itatago ang lahat ng records.',
                      'Best for Microsoft Excel or Google Sheets. Saves all records.'
                    ),
                    style: const TextStyle(fontSize: 11),
                  ),
                  onTap: () => Navigator.pop(context, 'csv'),
                ),
                const Divider(),
                ListTile(
                  leading: CircleAvatar(
                    backgroundColor: Colors.blue.shade50,
                    child: const Icon(Icons.send_rounded, color: Colors.blue),
                  ),
                  title: Text(settings.tr('I-share ang Larawan / Share Image (.png)', 'Share Image Report (.png)')),
                  subtitle: Text(
                    settings.tr(
                      'I-share ang ulat bilang larawan sa Messenger, Viber, o Email (limitado sa top 50 items).',
                      'Share the report card image directly to Messenger, Viber, or Email (limited to top 50 items).'
                    ),
                    style: const TextStyle(fontSize: 11),
                  ),
                  onTap: () => Navigator.pop(context, 'share_image'),
                ),
                const Divider(),
                ListTile(
                  leading: CircleAvatar(
                    backgroundColor: Colors.deepPurple.shade50,
                    child: const Icon(Icons.photo_library_rounded, color: Colors.deepPurple),
                  ),
                  title: Text(settings.tr('I-save sa Gallery / Save to Gallery', 'Save directly to Gallery')),
                  subtitle: Text(
                    settings.tr(
                      'I-save ang ulat na larawan diretso sa Gallery ng iyong phone (limitado sa top 50 items).',
                      'Save the report card image directly to your phone\'s photo gallery (limited to top 50 items).'
                    ),
                    style: const TextStyle(fontSize: 11),
                  ),
                  onTap: () => Navigator.pop(context, 'save_gallery'),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Future<bool> _shareImageReport(Uint8List pngBytes, String filename) async {
    try {
      final tempDir = await getTemporaryDirectory();
      final filePath = p.join(tempDir.path, filename);
      final file = File(filePath);
      await file.writeAsBytes(pngBytes);

      final xFile = XFile(filePath);
      await SharePlus.instance.share(
        ShareParams(
          files: [xFile],
          subject: 'Report Image - $filename',
        ),
      );
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<bool> _saveImageToGallery(Uint8List pngBytes, String filename) async {
    try {
      // Request access permission first
      final hasAccess = await Gal.hasAccess();
      if (!hasAccess) {
        final granted = await Gal.requestAccess();
        if (!granted) return false;
      }

      final tempDir = await getTemporaryDirectory();
      final filePath = p.join(tempDir.path, filename);
      final file = File(filePath);
      await file.writeAsBytes(pngBytes);

      await Gal.putImage(filePath);
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<void> _captureAndProcessReport(Widget reportWidget, String filenamePrefix, String action) async {
    final settings = Provider.of<SettingsProvider>(context, listen: false);
    
    // 1. Show loader
    setState(() {
      _isLoading = true;
      _captureWidget = reportWidget;
    });

    // 2. Wait for next frame so the widget is laid out and painted
    await Future.delayed(const Duration(milliseconds: 300));

    try {
      // 3. Capture the repaint boundary
      final boundary = _boundaryKey.currentContext?.findRenderObject() as RenderRepaintBoundary?;
      if (boundary == null) throw Exception('Boundary not found');

      final image = await boundary.toImage(pixelRatio: 3.0);
      final byteData = await image.toByteData(format: ui.ImageByteFormat.png);
      if (byteData == null) throw Exception('Failed to get byte data');
      
      final pngBytes = byteData.buffer.asUint8List();
      final dateStr = DateFormat('yyyyMMdd_HHmmss').format(DateTime.now());
      final filename = '${filenamePrefix}_$dateStr.png';

      if (action == 'share') {
        // Share the image file
        final success = await _shareImageReport(pngBytes, filename);
        if (mounted && !success) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(settings.tr('Pumalya ang pag-share ng larawan.', 'Failed to share image report.')),
              backgroundColor: Colors.red[800],
            ),
          );
        }
      } else if (action == 'save') {
        // Save to gallery
        final success = await _saveImageToGallery(pngBytes, filename);
        if (mounted) {
          if (success) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(settings.tr('Matagumpay na nai-save sa Gallery ang larawan!', 'Report image successfully saved to Gallery!')),
                backgroundColor: AppColors.secondary,
              ),
            );
          } else {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(settings.tr('Pumalya o tinanggihan ang pag-save sa Gallery.', 'Failed or denied saving to Gallery.')),
                backgroundColor: Colors.red[800],
              ),
            );
          }
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(settings.tr('Error sa pag-generate ng larawan.', 'Error generating image report.')),
            backgroundColor: Colors.red[800],
          ),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _captureWidget = null;
        });
      }
    }
  }

  Widget _buildInventoryReportWidget(List<Product> products, SettingsProvider settings) {
    final displayProducts = products.take(50).toList();
    final totalProducts = products.length;
    final totalStock = products.fold<double>(0.0, (double sum, Product item) => sum + item.currentStock);
    final totalBuyingValue = products.fold<double>(0.0, (double sum, Product item) => sum + (item.buyingPrice * item.currentStock));
    final totalSellingValue = products.fold<double>(0.0, (double sum, Product item) => sum + (item.sellingPrice * item.currentStock));
    final potentialProfit = totalSellingValue - totalBuyingValue;

    return Material(
      color: Colors.white,
      child: Container(
        width: 480,
        color: Colors.white,
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            // Header Accent Line
            Container(height: 6, color: AppColors.primary),
            const SizedBox(height: 16),
            
            // Store details & title
            Text(
              settings.storeName,
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 24, color: AppColors.primary),
              textAlign: TextAlign.center,
            ),
            Text(
              settings.tr('ULAT NG IMBENTARYO', 'INVENTORY REPORT'),
              style: const TextStyle(fontWeight: ui.FontWeight.w900, fontSize: 16, letterSpacing: 1.5, color: Colors.black87),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 4),
            Text(
              DateFormat('MMMM dd, yyyy - hh:mm a').format(DateTime.now()),
              style: TextStyle(fontSize: 11, color: Colors.grey[600]),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            
            // Statistics Grid
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.grey[50],
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.grey.shade200),
              ),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(settings.tr('Kabuuang Produkto:', 'Total Products:'), style: const TextStyle(fontSize: 12, color: Colors.black54)),
                      Text('$totalProducts', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(settings.tr('Kabuuang Stock Qty:', 'Total Stock Qty:'), style: const TextStyle(fontSize: 12, color: Colors.black54)),
                      Text(totalStock.toStringAsFixed(0), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(settings.tr('Kabuuang Puhunan:', 'Total Cost Value:'), style: const TextStyle(fontSize: 12, color: Colors.black54)),
                      Text(CurrencyFormatter.format(totalBuyingValue, settings.currencySymbol), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Colors.red)),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(settings.tr('Kabuuang Halaga ng Benta:', 'Total Retail Value:'), style: const TextStyle(fontSize: 12, color: Colors.black54)),
                      Text(CurrencyFormatter.format(totalSellingValue, settings.currencySymbol), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppColors.primary)),
                    ],
                  ),
                  const Divider(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(settings.tr('Inaasahang Tubo/Kita:', 'Potential Net Profit:'), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.black87)),
                      Text(CurrencyFormatter.format(potentialProfit, settings.currencySymbol), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.blue)),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            
            // Table Headers
            Row(
              children: [
                Expanded(flex: 3, child: Text(settings.tr('Produkto', 'Product'), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11))),
                Expanded(flex: 1, child: Text(settings.tr('Stock', 'Stock'), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11), textAlign: TextAlign.center)),
                Expanded(flex: 2, child: Text(settings.tr('Presyo', 'Price'), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11), textAlign: TextAlign.right)),
                Expanded(flex: 2, child: Text(settings.tr('Halaga', 'Value'), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11), textAlign: TextAlign.right)),
              ],
            ),
            const Divider(height: 10, thickness: 1),
            
            // Items List
            ...displayProducts.map((Product p) {
              final val = p.sellingPrice * p.currentStock;
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 4.0),
                child: Row(
                  children: [
                    Expanded(
                      flex: 3,
                      child: Text(
                        p.name,
                        style: const TextStyle(fontSize: 11, color: Colors.black87),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    Expanded(
                      flex: 1,
                      child: Text(
                        p.currentStock.toStringAsFixed(0),
                        style: const TextStyle(fontSize: 11),
                        textAlign: TextAlign.center,
                      ),
                    ),
                    Expanded(
                      flex: 2,
                      child: Text(
                        '${settings.currencySymbol}${p.sellingPrice.toStringAsFixed(1)}',
                        style: const TextStyle(fontSize: 11),
                        textAlign: TextAlign.right,
                      ),
                    ),
                    Expanded(
                      flex: 2,
                      child: Text(
                        '${settings.currencySymbol}${val.toStringAsFixed(1)}',
                        style: const TextStyle(fontSize: 11, fontWeight: ui.FontWeight.bold),
                        textAlign: TextAlign.right,
                      ),
                    ),
                  ],
                ),
              );
            }).toList(),
            
            const Divider(height: 20),
            
            // Footnotes
            if (products.length > 50)
              Padding(
                padding: const EdgeInsets.only(bottom: 8.0),
                child: Text(
                  settings.tr(
                    '* Ipinapakita lamang ang unang 50 na produkto. I-export bilang CSV para sa buong listahan.',
                    '* Showing only the first 50 products. Export as CSV for the full list.'
                  ),
                  style: const TextStyle(fontSize: 9, fontStyle: FontStyle.italic, color: Colors.grey),
                  textAlign: TextAlign.center,
                ),
              ),
            
            Text(
              settings.tr('Binuo gamit ang MVBA Inventory System', 'Generated via MVBA Inventory System'),
              style: const TextStyle(fontSize: 9, color: Colors.grey),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 4),
          ],
        ),
      ),
    );
  }

  Widget _buildSalesReportWidget(List<Sale> sales, String periodLabel, SettingsProvider settings) {
    final displaySales = sales.take(50).toList();
    
    double grandTotalSales = 0.0;
    double grandTotalCost = 0.0;
    double grandTotalProfit = 0.0;
    for (final s in sales) {
      grandTotalSales += s.totalPrice;
      grandTotalCost += s.totalCost;
      grandTotalProfit += s.profit;
    }

    return Material(
      color: Colors.white,
      child: Container(
        width: 480,
        color: Colors.white,
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisSize: MainAxisSize.min,
          children: [
            // Header Accent Line
            Container(height: 6, color: AppColors.primary),
            const SizedBox(height: 16),
            
            // Store details & title
            Text(
              settings.storeName,
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 24, color: AppColors.primary),
              textAlign: TextAlign.center,
            ),
            Text(
              settings.tr('ULAT NG BENTA AT KITA', 'SALES & PROFIT REPORT'),
              style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 16, letterSpacing: 1.5, color: Colors.black87),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 4),
            Text(
              '${settings.tr("Sakop na Panahon", "Period")}: $periodLabel',
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Colors.black54),
              textAlign: TextAlign.center,
            ),
            Text(
              DateFormat('MMMM dd, yyyy - hh:mm a').format(DateTime.now()),
              style: TextStyle(fontSize: 11, color: Colors.grey[600]),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            
            // Statistics Card
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.grey[50],
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.grey.shade200),
              ),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(settings.tr('Kabuuang Transaksyon:', 'Total Transactions:'), style: const TextStyle(fontSize: 12, color: Colors.black54)),
                      Text('${sales.length}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(settings.tr('Kabuuang Benta:', 'Gross Revenue:'), style: const TextStyle(fontSize: 12, color: Colors.black54)),
                      Text(CurrencyFormatter.format(grandTotalSales, settings.currencySymbol), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppColors.primary)),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(settings.tr('Kabuuang Puhunan:', 'Total Cost of Goods:'), style: const TextStyle(fontSize: 12, color: Colors.black54)),
                      Text(CurrencyFormatter.format(grandTotalCost, settings.currencySymbol), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Colors.red)),
                    ],
                  ),
                  const Divider(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(settings.tr('Netong Kita (Tubo):', 'Net Profit:'), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.black87)),
                      Text(CurrencyFormatter.format(grandTotalProfit, settings.currencySymbol), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.blue)),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            
            // Table Headers
            Row(
              children: [
                Expanded(flex: 3, child: Text(settings.tr('Produkto', 'Product'), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11))),
                Expanded(flex: 1, child: Text(settings.tr('Dami', 'Qty'), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11), textAlign: TextAlign.center)),
                Expanded(flex: 2, child: Text(settings.tr('Benta', 'Sales'), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11), textAlign: TextAlign.right)),
                Expanded(flex: 2, child: Text(settings.tr('Tubo', 'Profit'), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11), textAlign: TextAlign.right)),
              ],
            ),
            const Divider(height: 10, thickness: 1),
            
            // Items List
            ...displaySales.map((Sale s) {
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 4.0),
                child: Row(
                  children: [
                    Expanded(
                      flex: 3,
                      child: Text(
                        s.productName ?? 'Hindi kilala',
                        style: const TextStyle(fontSize: 11, color: Colors.black87),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    Expanded(
                      flex: 1,
                      child: Text(
                        '${s.quantity} ${s.productUnit ?? "pcs"}',
                        style: const TextStyle(fontSize: 11),
                        textAlign: TextAlign.center,
                      ),
                    ),
                    Expanded(
                      flex: 2,
                      child: Text(
                        '${settings.currencySymbol}${s.totalPrice.toStringAsFixed(1)}',
                        style: const TextStyle(fontSize: 11),
                        textAlign: TextAlign.right,
                      ),
                    ),
                    Expanded(
                      flex: 2,
                      child: Text(
                        '${settings.currencySymbol}${s.profit.toStringAsFixed(1)}',
                        style: const TextStyle(fontSize: 11, color: Colors.blue, fontWeight: ui.FontWeight.bold),
                        textAlign: TextAlign.right,
                      ),
                    ),
                  ],
                ),
              );
            }).toList(),
            
            const Divider(height: 20),
            
            // Footnotes
            if (sales.length > 50)
              Padding(
                padding: const EdgeInsets.only(bottom: 8.0),
                child: Text(
                  settings.tr(
                    '* Ipinapakita lamang ang huling 50 na transaksyon. I-export bilang CSV para sa buong listahan.',
                    '* Showing only the last 50 transactions. Export as CSV for the full list.'
                  ),
                  style: const TextStyle(fontSize: 9, fontStyle: FontStyle.italic, color: Colors.grey),
                  textAlign: TextAlign.center,
                ),
              ),
            
            Text(
              settings.tr('Binuo gamit ang MVBA Inventory System', 'Generated via MVBA Inventory System'),
              style: const TextStyle(fontSize: 9, color: Colors.grey),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 4),
          ],
        ),
      ),
    );
  }

  final List<String> _salesPeriods = [
    'Ngayong Araw',
    'Ngayong Buwan',
    'Ngayong Taon',
    'Lahat',
  ];

  // Map Tagalog selector to period labels
  String _getPeriodLabel(String period) {
    final settings = Provider.of<SettingsProvider>(context, listen: false);
    switch (period) {
      case 'Ngayong Araw':
        return settings.tr('Araw-araw (Daily)', 'Daily (Today)');
      case 'Ngayong Buwan':
        return settings.tr('Buwanan (Monthly)', 'Monthly (This Month)');
      case 'Ngayong Taon':
        return settings.tr('Taunan (Yearly)', 'Yearly (This Year)');
      case 'Lahat':
        return settings.tr('Lahat ng Benta (All Time)', 'All Sales (All Time)');
      default:
        return period;
    }
  }

  // Filter sales list based on selected time range
  List<Sale> _getFilteredSales(List<Sale> allSales, String period) {
    final now = DateTime.now();
    switch (period) {
      case 'Ngayong Araw':
        return allSales.where((s) {
          return s.saleDate.year == now.year &&
              s.saleDate.month == now.month &&
              s.saleDate.day == now.day;
        }).toList();
      case 'Ngayong Buwan':
        return allSales.where((s) {
          return s.saleDate.year == now.year &&
              s.saleDate.month == now.month;
        }).toList();
      case 'Ngayong Taon':
        return allSales.where((s) {
          return s.saleDate.year == now.year;
        }).toList();
      case 'Lahat':
      default:
        return allSales;
    }
  }

  // Handle Full Database Backup
  Future<void> _handleBackup() async {
    final settings = Provider.of<SettingsProvider>(context, listen: false);
    
    // Show confirmation warning that product images will not be saved
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: Text(settings.tr('I-backup ang Data?', 'Backup Data?')),
          content: Text(
            settings.tr(
              'Sigurado ka bang nais mong gumawa ng backup ng iyong data?\n\n'
              'Babala: Ang mga larawan (product images) ng mga produkto ay HINDI masasama sa backup na ito. Kailangan mong manu-manong ilagay muli ang mga larawan kapag ito ay inirere-store.',
              'Are you sure you want to back up your data?\n\n'
              'Warning: Product images will NOT be saved in this backup. You will need to manually re-add the images after restoring.'
            )
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: Text(settings.tr('I-cancel', 'Cancel')),
            ),
            ElevatedButton(
              onPressed: () => Navigator.pop(context, true),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.secondary,
                foregroundColor: Colors.white,
              ),
              child: Text(settings.tr('I-backup', 'Backup')),
            ),
          ],
        );
      },
    );

    if (confirm != true) return;

    int fileSize = -1;
    final success = await AppLoadingOverlay.runWithLoading(
      context: context,
      message: settings.tr('Gumagawa ng Database Backup File...', 'Creating Database Backup File...'),
      asyncTask: () async {
        final size = await BackupService.backupDatabase();
        fileSize = size;
        return size > 0;
      },
    );

    if (mounted) {
      final sizeKb = (fileSize / 1024).toStringAsFixed(2);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            success 
                ? settings.tr('Matagumpay na nai-backup ang database! Laki: $sizeKb KB', 'Database backup successful! Size: $sizeKb KB')
                : settings.tr('Pumalya ang pag-backup ng database.', 'Database backup failed.'),
          ),
          backgroundColor: success ? AppColors.secondary : Colors.red[800],
        ),
      );
    }
  }

  // Handle Full Database Restore
  Future<void> _handleRestore() async {
    final settings = Provider.of<SettingsProvider>(context, listen: false);
    // Show strict safety warning confirmation dialog
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: Text.rich(
            TextSpan(
              children: [
                const WidgetSpan(
                  alignment: PlaceholderAlignment.middle,
                  child: Icon(Icons.warning_amber_rounded, color: Colors.red),
                ),
                const WidgetSpan(child: SizedBox(width: 8)),
                TextSpan(text: settings.tr('Babala sa Pag-restore!', 'Restore Warning!')),
              ],
            ),
          ),
          content: Text(
            settings.tr(
              'Ang pag-restore ay buburahin at mapapalitan ang lahat ng kasalukuyang impormasyon (stocks at benta) sa iyong app gamit ang backup file.\n\n'
              'Sigurado ka bang gusto mong ituloy ito?',
              'Restoring will delete and replace all current data (stocks and sales) in your app with the backup file.\n\n'
              'Are you sure you want to proceed?'
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: Text(settings.tr('I-cancel', 'Cancel')),
            ),
            ElevatedButton(
              onPressed: () => Navigator.pop(context, true),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.red[800],
                foregroundColor: Colors.white,
              ),
              child: Text(settings.tr('Oo, I-restore', 'Yes, Restore')),
            ),
          ],
        );
      },
    );

    if (confirm != true) return;

    try {
      final result = await FilePicker.pickFiles(
        type: FileType.any,
      );

      if (result == null || result.files.single.path == null) {
        return;
      }

      final path = result.files.single.path!;
      final pickedFile = File(path);

      // Verify if the file is a SQLite database by reading header (allows Google Drive cached file checks)
      bool isSqlite = false;
      try {
        final fileStream = pickedFile.openRead(0, 16);
        final List<int> headerBytes = [];
        await for (final chunk in fileStream) {
          headerBytes.addAll(chunk);
        }
        if (headerBytes.length >= 15) {
          final headerStr = String.fromCharCodes(headerBytes.sublist(0, 15));
          if (headerStr == 'SQLite format 3') {
            isSqlite = true;
          }
        }
      } catch (_) {}

      // Reject if it is neither ending in .db nor internally a valid SQLite database
      if (!path.toLowerCase().endsWith('.db') && !isSqlite) {
        if (mounted) {
          showDialog(
            context: context,
            builder: (context) => AlertDialog(
              title: Text(settings.tr('Restore Failed', 'Restore Failed')),
              content: Text(settings.tr(
                'Hindi naibalik ang database. Maling file format, dapat ay .db.',
                'Restore Failed/invalid file not .db'
              )),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('OK'),
                ),
              ],
            ),
          );
        }
        return;
      }

      String? errorMessage;
      final success = await AppLoadingOverlay.runWithLoading(
        context: context,
        message: settings.tr('Nag-i-import at nag-re-restore ng database...', 'Importing and restoring database...'),
        asyncTask: () async {
          final err = await BackupService.restoreDatabase(pickedFile);
          errorMessage = err;
          final res = (err == null);
          if (res && mounted) {
            final provider = Provider.of<InventoryProvider>(context, listen: false);
            await provider.loadData();
          }
          return res;
        },
      );

      if (mounted) {
        showDialog(
          context: context,
          barrierDismissible: false,
          builder: (context) => AlertDialog(
            title: Text(success ? settings.tr('Matagumpay ang Restore!', 'Restore Successful!') : settings.tr('Pumalya ang Restore', 'Restore Failed')),
            content: Text(
              success 
                  ? settings.tr('Matagumpay na naibalik ang iyong mga impormasyon. I-restart ang application upang masigurong walang error sa database.', 'Your data has been successfully restored. Please restart the app to ensure database consistency.')
                  : settings.tr('Hindi naibalik ang database. Error: $errorMessage', 'Database was not restored. Error: $errorMessage'),
            ),
            actions: [
              TextButton(
                onPressed: () {
                  Navigator.pop(context);
                  if (success) {
                    Navigator.pop(context); // Go back to settings screen
                  }
                },
                child: const Text('OK'),
              ),
            ],
          ),
        );
      }
    } catch (_) {}
  }

  // Export Inventory Report to CSV
  Future<void> _exportInventory() async {
    final settings = Provider.of<SettingsProvider>(context, listen: false);
    final provider = Provider.of<InventoryProvider>(context, listen: false);
    final products = provider.products;

    if (products.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(settings.tr('Walang produkto sa iyong imbentaryo upang i-export.', 'No products in your inventory to export.')),
        ),
      );
      return;
    }

    final format = await _showFormatSelector();
    if (format == null) return;

    if (format == 'csv') {
      final success = await AppLoadingOverlay.runWithLoading(
        context: context,
        message: settings.tr('Ine-export ang ulat ng imbentaryo...', 'Exporting inventory report...'),
        asyncTask: () async {
          final csvContent = BackupService.exportInventoryToCSV(products);
          final dateStr = DateFormat('yyyyMMdd_HHmmss').format(DateTime.now());
          final filename = 'imbentaryo_$dateStr.csv';
          return await BackupService.shareCSVReport(csvContent, filename);
        },
      );

      if (mounted && !success) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(settings.tr('Pumalya ang pag-export ng ulat.', 'Failed to export inventory report.')),
            backgroundColor: Colors.red[800],
          ),
        );
      }
    } else {
      final reportWidget = _buildInventoryReportWidget(products, settings);
      final action = format == 'share_image' ? 'share' : 'save';
      await _captureAndProcessReport(reportWidget, 'ulat_imbentaryo', action);
    }
  }

  // Export Sales Report to CSV
  Future<void> _exportSales() async {
    final settings = Provider.of<SettingsProvider>(context, listen: false);
    final provider = Provider.of<InventoryProvider>(context, listen: false);
    final allSales = provider.sales;
    final filteredSales = _getFilteredSales(allSales, _selectedSalesPeriod);

    if (filteredSales.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(settings.tr('Walang transaksyon ng benta para sa panahong: ${_getPeriodLabel(_selectedSalesPeriod)}.', 'No sales transactions for the period: ${_getPeriodLabel(_selectedSalesPeriod)}.')),
        ),
      );
      return;
    }

    final format = await _showFormatSelector();
    if (format == null) return;

    if (format == 'csv') {
      final success = await AppLoadingOverlay.runWithLoading(
        context: context,
        message: settings.tr('Ine-export ang ulat ng benta...', 'Exporting sales report...'),
        asyncTask: () async {
          final csvContent = BackupService.exportSalesToCSV(filteredSales);
          final dateStr = DateFormat('yyyyMMdd_HHmmss').format(DateTime.now());
          final periodSlug = _selectedSalesPeriod.toLowerCase().replaceAll(' ', '_');
          final filename = 'ulat_benta_${periodSlug}_$dateStr.csv';
          return await BackupService.shareCSVReport(csvContent, filename);
        },
      );

      if (mounted && !success) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(settings.tr('Pumalya ang pag-export ng ulat ng benta.', 'Failed to export sales report.')),
            backgroundColor: Colors.red[800],
          ),
        );
      }
    } else {
      final periodLabel = _getPeriodLabel(_selectedSalesPeriod);
      final reportWidget = _buildSalesReportWidget(filteredSales, periodLabel, settings);
      final action = format == 'share_image' ? 'share' : 'save';
      await _captureAndProcessReport(reportWidget, 'ulat_benta', action);
    }
  }

  @override
  Widget build(BuildContext context) {
    final settings = Provider.of<SettingsProvider>(context);

    return Scaffold(
      appBar: AppBar(
        title: Text(
          settings.tr('Backup at Export ng Data', 'Data Backup & Export'),
          style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
        ),
        backgroundColor: AppColors.primary,
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      body: Stack(
        children: [
          SingleChildScrollView(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Section Info
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 4.0),
                  child: Text(
                    settings.tr(
                      'Piliin ang uri ng data na nais i-backup para sa kaligtasan, o i-export bilang CSV file na pwedeng buksan sa Microsoft Excel o Google Sheets.',
                      'Select the type of data you wish to backup for safety, or export as a CSV file compatible with Microsoft Excel or Google Sheets.'
                    ),
                    style: TextStyle(fontSize: 13, color: Colors.grey[600]),
                  ),
                ),
                const SizedBox(height: 12),

                // Card 1: Disaster Recovery Database Backup/Restore
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
                            const Icon(Icons.storage_rounded, color: AppColors.primary),
                            const SizedBox(width: 8),
                            Text(
                              settings.tr('Disaster Recovery (Buong Backup)', 'Disaster Recovery (Full Backup)'),
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(
                          settings.tr(
                            'Kopyahin at i-save ang buong database file (.db) ng iyong app sa Google Drive, email, o Messenger upang hindi mawala ang iyong records.',
                            'Copy and save the complete database file (.db) of your app to Google Drive, email, or Messenger so you never lose your records.'
                          ),
                          style: TextStyle(fontSize: 12, color: Colors.grey[600]),
                        ),
                        const SizedBox(height: 16),
                        Row(
                          children: [
                            Expanded(
                              child: ElevatedButton.icon(
                                onPressed: _isLoading ? null : _handleBackup,
                                icon: const Icon(Icons.cloud_upload_rounded),
                                label: Text(settings.tr('I-backup Data', 'Backup Data')),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: AppColors.primary,
                                  foregroundColor: Colors.white,
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: OutlinedButton.icon(
                                onPressed: _isLoading ? null : _handleRestore,
                                icon: const Icon(Icons.settings_backup_restore_rounded),
                                label: Text(settings.tr('I-restore Data', 'Restore Data')),
                                style: OutlinedButton.styleFrom(
                                  foregroundColor: Colors.red[800],
                                  side: BorderSide(color: Colors.red.shade200),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                Consumer<SettingsProvider>(
                  builder: (context, settings, child) {
                    String formattedLastBackup = settings.tr('Walang nakaraang backup', 'No previous backup');
                    if (settings.lastAutoBackupDate.isNotEmpty) {
                      final dt = DateTime.parse(settings.lastAutoBackupDate);
                      formattedLastBackup = DateFormat('MMM dd, yyyy - hh:mm a').format(dt);
                    }

                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
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
                                    const Icon(Icons.shield_outlined, color: AppColors.primary),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Text(
                                        settings.tr('Auto-Backup ng Database', 'Database Auto-Backup'),
                                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                                      ),
                                    ),
                                    Switch(
                                      value: settings.autoBackupEnabled,
                                      onChanged: (val) => settings.setAutoBackupEnabled(val),
                                      activeColor: AppColors.primary,
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  settings.tr(
                                    'Awtomatikong mag-save ng database backup file kapag binuksan ang app para masigurong laging ligtas ang iyong mga records.',
                                    'Automatically save a database backup file when the app opens to ensure your records are always secure.'
                                  ),
                                  style: TextStyle(fontSize: 12, color: Colors.grey[600]),
                                ),
                                if (settings.autoBackupEnabled) ...[
                                  const Divider(height: 24),
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        settings.tr('Dalas ng Auto-Backup (Frequency):', 'Auto-Backup Frequency:'),
                                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                                      ),
                                      DropdownButton<String>(
                                        value: settings.autoBackupFrequency,
                                        underline: Container(),
                                        items: [
                                          DropdownMenuItem(
                                            value: 'daily',
                                            child: Text(settings.tr('Araw-araw', 'Daily'), style: const TextStyle(fontSize: 13)),
                                          ),
                                          DropdownMenuItem(
                                            value: 'weekly',
                                            child: Text(settings.tr('Lingguhan', 'Weekly'), style: const TextStyle(fontSize: 13)),
                                          ),
                                        ],
                                        onChanged: (val) {
                                          if (val != null) {
                                            settings.setAutoBackupFrequency(val);
                                          }
                                        },
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    settings.tr('Huling Auto-Backup: $formattedLastBackup', 'Last Auto-Backup: $formattedLastBackup'),
                                    style: TextStyle(fontSize: 11, color: Colors.grey[600], fontStyle: FontStyle.italic),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(height: 16),

                        // Local Backups List Card
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
                                    const Icon(Icons.history_rounded, color: AppColors.primary),
                                    const SizedBox(width: 8),
                                    Text(
                                      settings.tr('Kasaysayan ng Local Backup', 'Local Backup History'),
                                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  settings.tr(
                                    'Listahan ng mga naka-save na auto-backup file sa local memory. Piliin ang isa upang i-restore.',
                                    'List of saved auto-backup files in local memory. Select one to restore.'
                                  ),
                                  style: TextStyle(fontSize: 12, color: Colors.grey[600]),
                                ),
                                const Divider(height: 20),
                                _localBackups.isEmpty
                                    ? Container(
                                        padding: const EdgeInsets.all(16),
                                        alignment: Alignment.center,
                                        child: Text(
                                          settings.tr('Walang nahanap na local backups.', 'No local backups found.'),
                                          style: TextStyle(fontSize: 13, color: Colors.grey[500]),
                                        ),
                                      )
                                    : ListView.builder(
                                        shrinkWrap: true,
                                        physics: const NeverScrollableScrollPhysics(),
                                        itemCount: _localBackups.length,
                                        itemBuilder: (context, index) {
                                          final file = _localBackups[index];
                                          final fName = p.basename(file.path);
                                          
                                          // Extract date if it matches the auto-backup name pattern
                                          String dateStr = 'Unknown Date';
                                          if (fName.startsWith('sarisari_inventory_autobackup_')) {
                                            final datePart = fName.replaceAll('sarisari_inventory_autobackup_', '').replaceAll('.db', '');
                                            if (datePart.length == 8) {
                                              try {
                                                final parsedDate = DateTime.parse(
                                                  '${datePart.substring(0, 4)}-${datePart.substring(4, 6)}-${datePart.substring(6, 8)}'
                                                );
                                                dateStr = DateFormat('MMMM dd, yyyy').format(parsedDate);
                                              } catch (_) {}
                                            }
                                          }

                                          return ListTile(
                                            dense: true,
                                            contentPadding: EdgeInsets.zero,
                                            leading: const Icon(Icons.settings_backup_restore_rounded, color: AppColors.primary),
                                            title: Text(dateStr, style: const TextStyle(fontWeight: FontWeight.bold)),
                                            subtitle: Text(fName, style: TextStyle(fontSize: 10, color: Colors.grey[600])),
                                            trailing: Row(
                                              mainAxisSize: MainAxisSize.min,
                                              children: [
                                                IconButton(
                                                  icon: const Icon(Icons.restore, color: Colors.green),
                                                  tooltip: settings.tr('I-restore', 'Restore'),
                                                  onPressed: () => _handleLocalRestore(file),
                                                ),
                                                IconButton(
                                                  icon: const Icon(Icons.delete_outline_rounded, color: Colors.red),
                                                  tooltip: settings.tr('Burahin', 'Delete'),
                                                  onPressed: () => _handleLocalDelete(file),
                                                ),
                                              ],
                                            ),
                                          );
                                        },
                                      ),
                              ],
                            ),
                          ),
                        ),
                        const SizedBox(height: 16),
                      ],
                    );
                  },
                ),

                // Card 2: Export Inventory Report (CSV)
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
                            const Icon(Icons.inventory_2_rounded, color: AppColors.primary),
                            const SizedBox(width: 8),
                            Text(
                              settings.tr('Ulat ng Imbentaryo (Inventory Report)', 'Inventory Report'),
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(
                          settings.tr(
                            'I-download o i-share ang lahat ng impormasyon ng mga produkto, presyo, at stock bilang Excel/CSV o bilang magandang Larawan.',
                            'Download or share all product details, prices, and stock counts as an Excel/CSV file or a beautiful Image.'
                          ),
                          style: TextStyle(fontSize: 12, color: Colors.grey[600]),
                        ),
                        const SizedBox(height: 16),
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton.icon(
                            onPressed: _isLoading ? null : _exportInventory,
                            icon: const Icon(Icons.download_rounded),
                            label: Text(settings.tr('I-export ang Imbentaryo', 'Export Inventory Report')),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.secondary,
                              foregroundColor: Colors.white,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                // Card 3: Export Sales Report (CSV)
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
                            const Icon(Icons.monetization_on_rounded, color: AppColors.primary),
                            const SizedBox(width: 8),
                            Text(
                              settings.tr('Ulat ng Benta (Sales & Profit Report)', 'Sales & Profit Report'),
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Text(
                          settings.tr(
                            'I-export ang mga records ng transaksyon, dami ng nabenta, kabuuang kita, at kabuuang tubo/kita na filtered ayon sa napiling petsa bilang Excel/CSV o Larawan.',
                            'Export transaction records, quantities sold, gross revenue, and net profit filtered by period as an Excel/CSV file or a beautiful Image.'
                          ),
                          style: TextStyle(fontSize: 12, color: Colors.grey[600]),
                        ),
                        const SizedBox(height: 16),
                        
                        // Select sales period dropdown
                        Text(
                          settings.tr('Piliin ang sakop na panahon (Period):', 'Select Period Range:'),
                          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                        ),
                        const SizedBox(height: 6),
                        DropdownButtonFormField<String>(
                          value: _selectedSalesPeriod,
                          isExpanded: true,
                          decoration: const InputDecoration(
                            border: OutlineInputBorder(),
                            contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                          ),
                          items: _salesPeriods.map((period) {
                            return DropdownMenuItem<String>(
                              value: period,
                              child: Text(_getPeriodLabel(period)),
                            );
                          }).toList(),
                          onChanged: (val) {
                            if (val != null) {
                              setState(() {
                                _selectedSalesPeriod = val;
                              });
                            }
                          },
                        ),
                        const SizedBox(height: 16),
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton.icon(
                            onPressed: _isLoading ? null : _exportSales,
                            icon: const Icon(Icons.download_rounded),
                            label: Text(settings.tr('I-export ang Ulat ng Benta', 'Export Sales Report')),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.secondary,
                              foregroundColor: Colors.white,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          
          // Loader overlay
          if (_isLoading)
            Container(
              color: Colors.black.withOpacity(0.3),
              child: const Center(
                child: CircularProgressIndicator(
                  valueColor: AlwaysStoppedAnimation<Color>(AppColors.primary),
                ),
              ),
            ),

          // Capture Widget off-screen
          if (_captureWidget != null)
            Positioned(
              left: -9999,
              top: -9999,
              child: RepaintBoundary(
                key: _boundaryKey,
                child: _captureWidget!,
              ),
            ),
        ],
      ),
    );
  }
}