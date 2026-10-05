import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:print_bluetooth_thermal/print_bluetooth_thermal.dart';
import '../models/sale.dart';
import '../providers/inventory_provider.dart';
import '../providers/settings_provider.dart';
import '../services/printer_service.dart';
import '../services/transaction_grouping_service.dart';
import '../utils/currency_formatter.dart';
import '../widgets/app_loading_overlay.dart';
import '../widgets/app_skeleton_loader.dart';
import '../widgets/app_empty_state.dart';
import '../widgets/app_toast.dart';
import '../widgets/app_drawer.dart';
import 'settings_screen.dart';
import '../utils/app_constants.dart';

class SalesHistoryScreen extends StatefulWidget {
  const SalesHistoryScreen({super.key});

  @override
  State<SalesHistoryScreen> createState() => _SalesHistoryScreenState();
}

class _SalesHistoryScreenState extends State<SalesHistoryScreen> {
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';
  DateTime? _selectedDate;
  bool _showAggregatedView = false;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  String _formatCurrency(double amount, String currencySymbol) {
    return CurrencyFormatter.format(amount, currencySymbol);
  }

  // Format header date (e.g. "June 18, 2026 (Today)")
  String _formatHeaderDate(String dateStr) {
    final date = DateTime.parse(dateStr);
    final today = DateTime.now();
    final yesterday = today.subtract(const Duration(days: 1));

    final todayStr = DateFormat('yyyy-MM-dd').format(today);
    final yesterdayStr = DateFormat('yyyy-MM-dd').format(yesterday);

    if (dateStr == todayStr) {
      return '${DateFormat('MMMM dd, yyyy').format(date)} (Ngayong Araw)';
    } else if (dateStr == yesterdayStr) {
      return '${DateFormat('MMMM dd, yyyy').format(date)} (Kahapon)';
    } else {
      return DateFormat('EEEE, MMMM dd, yyyy').format(date);
    }
  }

  // Calendar Date Picker
  Future<void> _selectFilterDate(BuildContext context) async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate ?? DateTime.now(),
      firstDate: DateTime.now().subtract(const Duration(days: 365)),
      lastDate: DateTime.now().add(const Duration(days: 365)),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(
              primary: AppColors.primary,
              onPrimary: Colors.white,
              onSurface: Colors.black87,
            ),
          ),
          child: child!,
        );
      },
    );

    if (picked != null) {
      setState(() {
        _selectedDate = picked;
      });
    }
  }

  // Dialog to void a single sale item
  void _voidSalePrompt(BuildContext parentContext, Sale sale, VoidCallback onSuccess) {
    showDialog(
      context: parentContext,
      builder: (dialogContext) {
        final settings = Provider.of<SettingsProvider>(parentContext, listen: false);
        return AlertDialog(
          title: const Text.rich(
            TextSpan(
              children: [
                WidgetSpan(
                  alignment: PlaceholderAlignment.middle,
                  child: Icon(Icons.undo_rounded, color: Colors.red),
                ),
                WidgetSpan(child: SizedBox(width: 8)),
                TextSpan(text: 'Bawiin ang Item? (Void)'),
              ],
            ),
          ),
          content: Text(
            'Gusto mo bang bawiin ang produktong ito mula sa benta?\n\n'
            '• Produkto: ${sale.productName ?? 'Unknown'}\n'
            '• Dami: ${sale.quantity} ${sale.productUnit ?? 'pcs'}\n'
            '• Halaga: ${_formatCurrency(sale.totalPrice, settings.currencySymbol)}\n\n'
            'Babala: Ang daming ito ay ibabalik sa iyong stock imbentaryo at ang record ng benta na ito ay mabubura.'
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: const Text('I-cancel'),
            ),
            ElevatedButton(
              onPressed: () async {
                Navigator.pop(dialogContext); // Dismiss confirmation dialog first
                
                await AppLoadingOverlay.runWithLoading(
                  context: parentContext,
                  message: 'Binabawi ang benta at ibinabalik sa stock...',
                  asyncTask: () async {
                    final provider = Provider.of<InventoryProvider>(parentContext, listen: false);
                    await provider.voidSale(sale.id!);
                  },
                );

                if (parentContext.mounted) {
                  onSuccess();
                  AppToast.success(parentContext, 'Matagumpay na nabawi ang benta para sa ${sale.productName}!');
                }
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.red[800],
                foregroundColor: Colors.white,
              ),
              child: const Text('Void / Bawiin'),
            ),
          ],
        );
      },
    );
  }

  // Dialog to void the entire transaction
  void _voidTransactionPrompt(BuildContext parentContext, List<Sale> txSales, VoidCallback onSuccess) {
    showDialog(
      context: parentContext,
      builder: (dialogContext) {
        final settings = Provider.of<SettingsProvider>(parentContext, listen: false);
        final totalTxAmount = txSales.fold<double>(0, (sum, item) => sum + item.totalPrice);

        return AlertDialog(
          title: const Text.rich(
            TextSpan(
              children: [
                WidgetSpan(
                  alignment: PlaceholderAlignment.middle,
                  child: Icon(Icons.undo_rounded, color: Colors.red),
                ),
                WidgetSpan(child: SizedBox(width: 8)),
                TextSpan(text: 'Void Buong Transaksyon?'),
              ],
            ),
          ),
          content: Text(
            'Gusto mo bang bawiin ang buong transaksyon na ito?\n\n'
            '• Bilang ng Produkto: ${txSales.length} items\n'
            '• Kabuuang Halaga: ${_formatCurrency(totalTxAmount, settings.currencySymbol)}\n\n'
            'Babala: Lahat ng items na ito ay ibabalik sa iyong stock imbentaryo at ang record ng transaksyon na ito ay ganap na mabubura.'
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: const Text('I-cancel'),
            ),
            ElevatedButton(
              onPressed: () async {
                Navigator.pop(dialogContext); // Dismiss confirmation dialog first

                await AppLoadingOverlay.runWithLoading(
                  context: parentContext,
                  message: 'Binabawi ang buong transaksyon at ibinabalik sa stock...',
                  asyncTask: () async {
                    final provider = Provider.of<InventoryProvider>(parentContext, listen: false);
                    for (var sale in txSales) {
                      if (sale.id != null) {
                        await provider.voidSale(sale.id!);
                      }
                    }
                  },
                );

                if (parentContext.mounted) {
                  onSuccess();
                  AppToast.success(parentContext, 'Matagumpay na nabawi ang buong transaksyon!');
                }
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.red[800],
                foregroundColor: Colors.white,
              ),
              child: const Text('Oo, Void Lahat'),
            ),
          ],
        );
      },
    );
  }

  // Quick Bluetooth printer connection modal dialog
  Future<bool> _showPrinterConnectDialog(BuildContext context) async {
    bool isScanning = true;
    bool isConnecting = false;
    String? connectingMac;
    String errorMsg = '';
    List<BluetoothInfo> devices = [];

    try {
      await Permission.bluetoothConnect.request();
      await Permission.bluetoothScan.request();
      await Permission.location.request();
    } catch (_) {}

    devices = await PrinterService.getBluetoothDevices();
    isScanning = false;

    final bool? connected = await showDialog<bool>(
      context: context,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              title: Row(
                children: [
                  const Icon(Icons.print_rounded, color: AppColors.primary),
                  const SizedBox(width: 8),
                  const Expanded(
                    child: Text(
                      'Ikonekta ang Printer',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                    ),
                  ),
                  if (isScanning)
                    const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
                    )
                  else
                    IconButton(
                      icon: const Icon(Icons.refresh_rounded),
                      tooltip: 'Rescan Bluetooth',
                      onPressed: () async {
                        setDialogState(() => isScanning = true);
                        final list = await PrinterService.getBluetoothDevices();
                        if (context.mounted) {
                          setDialogState(() {
                            devices = list;
                            isScanning = false;
                          });
                        }
                      },
                    ),
                ],
              ),
              content: SizedBox(
                width: double.maxFinite,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Pumili ng Bluetooth printer sa ibaba:',
                      style: TextStyle(fontSize: 12, color: Colors.grey),
                    ),
                    const SizedBox(height: 10),
                    if (errorMsg.isNotEmpty) ...[
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: Colors.red[50],
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: Colors.red.shade200),
                        ),
                        child: Text(
                          errorMsg,
                          style: TextStyle(fontSize: 11, color: Colors.red[800]),
                        ),
                      ),
                      const SizedBox(height: 10),
                    ],
                    if (isScanning)
                      const Padding(
                        padding: EdgeInsets.all(20),
                        child: Center(child: Text('Naghahanap ng Bluetooth printer...')),
                      )
                    else if (devices.isEmpty)
                      const Padding(
                        padding: EdgeInsets.all(20),
                        child: Center(
                          child: Text(
                            'Walang nahanap na Bluetooth printer.\nPakisigurong nakabukas ang printer at paired sa Bluetooth.',
                            textAlign: TextAlign.center,
                            style: TextStyle(fontSize: 12, color: Colors.grey),
                          ),
                        ),
                      )
                    else
                      Flexible(
                        child: ListView.separated(
                          shrinkWrap: true,
                          itemCount: devices.length,
                          separatorBuilder: (_, __) => const Divider(height: 1),
                          itemBuilder: (context, index) {
                            final dev = devices[index];
                            final name = dev.name;
                            final mac = dev.macAdress;
                            final isThisConnecting = isConnecting && connectingMac == mac;

                            return ListTile(
                              contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                              leading: const Icon(Icons.bluetooth_connected_rounded, color: AppColors.primary),
                              title: Text(name, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                              subtitle: Text(mac, style: const TextStyle(fontSize: 10, color: Colors.grey)),
                              trailing: isThisConnecting
                                  ? const SizedBox(
                                      width: 18,
                                      height: 18,
                                      child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
                                    )
                                  : ElevatedButton(
                                      onPressed: isConnecting
                                          ? null
                                          : () async {
                                              setDialogState(() {
                                                isConnecting = true;
                                                connectingMac = mac;
                                                errorMsg = '';
                                              });

                                              final success = await PrinterService.connect(mac);
                                              final settings = Provider.of<SettingsProvider>(context, listen: false);

                                              if (success) {
                                                await settings.setSelectedPrinter(name, mac);
                                                if (dialogContext.mounted) {
                                                  Navigator.pop(dialogContext, true);
                                                }
                                              } else {
                                                if (context.mounted) {
                                                  setDialogState(() {
                                                    isConnecting = false;
                                                    connectingMac = null;
                                                    errorMsg = 'Hindi makakonekta sa $name. Pakicheck ang printer.';
                                                  });
                                                }
                                              }
                                            },
                                      style: ElevatedButton.styleFrom(
                                        backgroundColor: AppColors.primary,
                                        foregroundColor: Colors.white,
                                        minimumSize: const Size(60, 30),
                                        padding: const EdgeInsets.symmetric(horizontal: 10),
                                      ),
                                      child: const Text('Konekta', style: TextStyle(fontSize: 11)),
                                    ),
                            );
                          },
                        ),
                      ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () async {
                    Navigator.pop(dialogContext, false);
                    await Navigator.push(
                      context,
                      MaterialPageRoute(builder: (_) => const SettingsScreen()),
                    );
                  },
                  child: const Text('Pumunta sa Settings'),
                ),
                TextButton(
                  onPressed: () => Navigator.pop(dialogContext, false),
                  child: const Text('Isara'),
                ),
              ],
            );
          },
        );
      },
    );

    return connected ?? false;
  }

  // Detailed Modal Receipt Screen
  void _showTransactionDetailsModal(BuildContext context, List<Sale> txSales, SettingsProvider settings) {
    final currencySymbol = settings.currencySymbol;
    final txTotal = txSales.fold<double>(0.0, (sum, sale) => sum + sale.totalPrice);
    final txProfit = txSales.fold<double>(0.0, (sum, sale) => sum + sale.profit);
    final saleTime = DateFormat('hh:mm a').format(txSales.first.saleDate);
    final saleDateFormatted = DateFormat('MMMM dd, yyyy').format(txSales.first.saleDate);

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Container(
              height: MediaQuery.of(context).size.height * 0.85,
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
              ),
              child: Column(
                children: [
                  // Bottom sheet handle
                  Container(
                    margin: const EdgeInsets.only(top: 10, bottom: 10),
                    width: 40,
                    height: 5,
                    decoration: BoxDecoration(
                      color: Colors.grey[300],
                      borderRadius: BorderRadius.circular(5),
                    ),
                  ),

                  // Header
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Resibo at Detalye',
                          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.primary),
                        ),
                        IconButton(
                          icon: const Icon(Icons.close_rounded),
                          onPressed: () => Navigator.pop(context),
                        )
                      ],
                    ),
                  ),

                  // Receipt tape body
                  Expanded(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        children: [
                          Container(
                            decoration: BoxDecoration(
                              color: const Color(0xFFFFFDF6), // Creamy receipt paper color
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: const Color(0xFFF5EAC5)),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withAlpha(10),
                                  blurRadius: 8,
                                  offset: const Offset(0, 4),
                                )
                              ]
                            ),
                            padding: const EdgeInsets.all(16.0),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                // Store Banner
                                Text(
                                  settings.storeName,
                                  textAlign: TextAlign.center,
                                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                                ),
                                if (settings.ownerName.isNotEmpty)
                                  Text(
                                    'Proprietor: ${settings.ownerName}',
                                    textAlign: TextAlign.center,
                                    style: TextStyle(fontSize: 11, color: Colors.grey[600]),
                                  ),
                                const SizedBox(height: 8),
                                Text(
                                  '$saleDateFormatted - $saleTime',
                                  textAlign: TextAlign.center,
                                  style: TextStyle(fontSize: 12, color: Colors.grey[600]),
                                ),
                                const Divider(height: 24, thickness: 1, color: Colors.grey),

                                // Transaction items list
                                const Text(
                                  'Mga Binili:',
                                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.grey),
                                ),
                                const SizedBox(height: 8),
                                ...txSales.map((sale) {
                                  return Padding(
                                    padding: const EdgeInsets.symmetric(vertical: 4.0),
                                    child: Row(
                                      children: [
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                sale.productName ?? 'Unknown Product',
                                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                                              ),
                                              Text(
                                                '${sale.quantity % 1 == 0 ? sale.quantity.toInt() : sale.quantity} ${sale.productUnit ?? 'pcs'} @ ${_formatCurrency(sale.sellingPrice, currencySymbol)}',
                                                style: TextStyle(fontSize: 11, color: Colors.grey[600]),
                                              ),
                                            ],
                                          ),
                                        ),
                                        Text(
                                          _formatCurrency(sale.totalPrice, currencySymbol),
                                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                                        ),
                                        const SizedBox(width: 8),
                                        IconButton(
                                          icon: const Icon(Icons.remove_circle_outline, color: Colors.red, size: 18),
                                          tooltip: 'Void itong item',
                                          onPressed: () {
                                            _voidSalePrompt(context, sale, () {
                                              // Close bottom sheet modal automatically
                                              if (sheetContext.mounted && Navigator.canPop(sheetContext)) {
                                                Navigator.pop(sheetContext);
                                              }
                                            });
                                          },
                                          padding: EdgeInsets.zero,
                                          constraints: const BoxConstraints(),
                                        )
                                      ],
                                    ),
                                  );
                                }),

                                const Divider(height: 24, thickness: 1, color: Colors.grey),

                                // Payment totals
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    const Text('Kabuoan (Total):', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                                    Text(_formatCurrency(txTotal, currencySymbol), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: AppColors.primary)),
                                  ],
                                ),
                                const SizedBox(height: 4),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text('Cash na Bayad:', style: TextStyle(fontSize: 12, color: Colors.grey[800])),
                                    Text(_formatCurrency(txSales.first.amountPaid ?? txTotal, currencySymbol), style: TextStyle(fontSize: 12, color: Colors.grey[800])),
                                  ],
                                ),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text('Sukli:', style: TextStyle(fontSize: 12, color: Colors.grey[800])),
                                    Text(_formatCurrency(txSales.first.changeGiven ?? 0.0, currencySymbol), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                                  ],
                                ),
                                const Divider(height: 20, thickness: 1),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    const Text('Kwentang Tubo (Profit):', style: TextStyle(fontSize: 10, color: Colors.grey)),
                                    Text(_formatCurrency(txProfit, currencySymbol), style: const TextStyle(fontSize: 10, color: Colors.grey, fontWeight: FontWeight.bold)),
                                  ],
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 24),

                          // Reprint Button
                          SizedBox(
                            width: double.infinity,
                            child: ElevatedButton.icon(
                              onPressed: () async {
                                bool isPrinterConnected = await PrinterService.isConnected();
                                if (!isPrinterConnected) {
                                  if (context.mounted) {
                                    final newlyConnected = await _showPrinterConnectDialog(context);
                                    if (!newlyConnected) return;
                                    isPrinterConnected = true;
                                  }
                                }

                                final printItems = txSales.map((item) {
                                  return {
                                    'name': item.productName ?? 'Unknown',
                                    'qty': item.quantity % 1 == 0 ? item.quantity.toInt() : item.quantity,
                                    'price': item.sellingPrice,
                                    'subtotal': item.totalPrice,
                                  };
                                }).toList();

                                final success = await PrinterService.printReceipt(
                                  storeName: settings.storeName,
                                  ownerName: settings.ownerName,
                                  items: printItems,
                                  total: txTotal,
                                  amountPaid: txSales.first.amountPaid ?? txTotal,
                                  changeGiven: txSales.first.changeGiven ?? 0.0,
                                  currencySymbol: settings.currencySymbol,
                                );

                                if (context.mounted) {
                                  if (success) {
                                    AppToast.success(context, 'Nai-print ang resibo!');
                                  } else {
                                    AppToast.error(context, 'Pumalya ang pag-print. Paki-check ang printer.');
                                  }
                                }
                              },
                              icon: const Icon(Icons.print_rounded),
                              label: const Text('I-print Muli ang Resibo', style: TextStyle(fontWeight: FontWeight.bold)),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppColors.primary,
                                foregroundColor: Colors.white,
                                padding: const EdgeInsets.symmetric(vertical: 14),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                              ),
                            ),
                          ),
                          const SizedBox(height: 12),

                          // Void Entire Transaction Button
                          SizedBox(
                            width: double.infinity,
                            child: OutlinedButton.icon(
                              onPressed: () {
                                _voidTransactionPrompt(context, txSales, () {
                                  // Success - Close bottom sheet automatically
                                  if (sheetContext.mounted && Navigator.canPop(sheetContext)) {
                                    Navigator.pop(sheetContext);
                                  }
                                });
                              },
                              icon: const Icon(Icons.delete_forever_rounded, color: Colors.red),
                              label: const Text('Bawiin ang Buong Transaksyon (Void)', style: TextStyle(color: Colors.red, fontWeight: FontWeight.bold)),
                              style: OutlinedButton.styleFrom(
                                side: const BorderSide(color: Colors.red),
                                padding: const EdgeInsets.symmetric(vertical: 14),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  )
                ],
              ),
            );
            },
          );
        },
      );
    }

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.of(context).size.width;
    final isTablet = width >= 768;
    final settings = Provider.of<SettingsProvider>(context);
    final currencySymbol = settings.currencySymbol;

    Widget bodyContent = Column(
      children: [
        // 1. Filter section (Search bar & Calendar)
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _searchController,
                  onChanged: (val) {
                    setState(() {
                      _searchQuery = val;
                    });
                  },
                  decoration: InputDecoration(
                    hintText: settings.tr('Hanapin ang benta sa pangalan...', 'Search sales by product name...'),
                    prefixIcon: const Icon(Icons.search, color: AppColors.secondary),
                    suffixIcon: _searchQuery.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.clear_rounded, color: Colors.grey, size: 20),
                            onPressed: () {
                              _searchController.clear();
                              setState(() {
                                _searchQuery = '';
                              });
                            },
                          )
                        : null,
                    filled: true,
                    fillColor: AppColors.searchFill,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: BorderSide.none,
                    ),
                    contentPadding: const EdgeInsets.symmetric(vertical: 0),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              SizedBox(
                height: 48,
                child: ElevatedButton.icon(
                  onPressed: () => _selectFilterDate(context),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _selectedDate != null ? AppColors.primary : AppColors.surfaceLight,
                    foregroundColor: _selectedDate != null ? Colors.white : AppColors.primary,
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(10),
                      side: BorderSide(color: Colors.grey.shade300),
                    ),
                  ),
                  icon: const Icon(Icons.calendar_today_rounded, size: 16),
                  label: Text(_selectedDate != null ? DateFormat('MM/dd').format(_selectedDate!) : settings.tr('Petsa', 'Date')),
                ),
              ),
            ],
          ),
        ),

        // Active Date Filter chip display
        if (_selectedDate != null)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 4.0),
            child: Row(
              children: [
                InputChip(
                  label: Text('${settings.tr("Petsa", "Date")}: ${DateFormat('MMMM dd, yyyy').format(_selectedDate!)}'),
                  onDeleted: () {
                    setState(() {
                      _selectedDate = null;
                    });
                  },
                  deleteIconColor: Colors.red[800],
                  backgroundColor: AppColors.surfaceLight,
                  labelStyle: const TextStyle(color: AppColors.primary, fontSize: 12, fontWeight: FontWeight.bold),
                ),
              ],
            ),
          ),

        // 2. Statistics Summary Panel
        Consumer<InventoryProvider>(
          builder: (context, provider, child) {
            // Apply search & date filter
            final filteredSales = provider.sales.where((s) {
              final prodName = s.productName ?? '';
              final matchesSearch = prodName.toLowerCase().contains(_searchQuery.toLowerCase());
              if (_selectedDate == null) return matchesSearch;

              final isSameDay = s.saleDate.year == _selectedDate!.year &&
                                s.saleDate.month == _selectedDate!.month &&
                                s.saleDate.day == _selectedDate!.day;
              return matchesSearch && isSameDay;
            }).toList();

            // Group filtered sales into transactions to show actual count of purchases
            final transactions = TransactionGroupingService.groupIntoTransactions(filteredSales);

            double totalPeriodRevenue = 0.0;
            double totalPeriodProfit = 0.0;

            for (var s in filteredSales) {
              totalPeriodRevenue += s.totalPrice;
              totalPeriodProfit += s.profit;
            }

            return Container(
              margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.surfaceLight,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.surfaceBorder),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  Expanded(
                    child: Column(
                      children: [
                        Text(settings.tr('Kabuuang Benta', 'Total Sales'), style: const TextStyle(fontSize: 11, color: Colors.grey), textAlign: TextAlign.center),
                        FittedBox(
                          fit: BoxFit.scaleDown,
                          child: Text(
                            _formatCurrency(totalPeriodRevenue, currencySymbol),
                            style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.primary, fontSize: 15),
                          ),
                        ),
                      ],
                    ),
                  ),
                  Container(width: 1, height: 25, color: AppColors.surfaceBorder),
                  Expanded(
                    child: Column(
                      children: [
                        Text(settings.tr('Kabuuang Tubo', 'Total Profit'), style: const TextStyle(fontSize: 11, color: Colors.grey), textAlign: TextAlign.center),
                        FittedBox(
                          fit: BoxFit.scaleDown,
                          child: Text(
                            _formatCurrency(totalPeriodProfit, currencySymbol),
                            style: TextStyle(fontWeight: FontWeight.bold, color: Colors.green[900], fontSize: 15),
                          ),
                        ),
                      ],
                    ),
                  ),
                  Container(width: 1, height: 25, color: AppColors.surfaceBorder),
                  Expanded(
                    child: Column(
                      children: [
                        Text(settings.tr('Transaksyon', 'Transactions'), style: const TextStyle(fontSize: 11, color: Colors.grey), textAlign: TextAlign.center),
                        FittedBox(
                          fit: BoxFit.scaleDown,
                          child: Text(
                            '${transactions.length}',
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            );
          },
        ),

        // Custom Sliding Tab Toggle Selector (Mga Resibo vs Mga Produkto)
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
          child: Container(
            height: 40,
            decoration: BoxDecoration(
              color: Colors.grey[100],
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: Colors.grey[300]!),
            ),
            child: Row(
              children: [
                Expanded(
                  child: InkWell(
                    onTap: () {
                      setState(() {
                        _showAggregatedView = false;
                      });
                    },
                    borderRadius: BorderRadius.circular(10),
                    child: Container(
                      decoration: BoxDecoration(
                        color: !_showAggregatedView ? AppColors.primary : Colors.transparent,
                        borderRadius: BorderRadius.circular(9),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        settings.tr('Mga Resibo (Receipts)', 'Receipts View'),
                        style: TextStyle(
                          color: !_showAggregatedView ? Colors.white : Colors.grey[700],
                          fontWeight: FontWeight.bold,
                          fontSize: 11,
                        ),
                      ),
                    ),
                  ),
                ),
                Expanded(
                  child: InkWell(
                    onTap: () {
                      setState(() {
                        _showAggregatedView = true;
                      });
                    },
                    borderRadius: BorderRadius.circular(10),
                    child: Container(
                      decoration: BoxDecoration(
                        color: _showAggregatedView ? AppColors.primary : Colors.transparent,
                        borderRadius: BorderRadius.circular(9),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        settings.tr('Benta sa Produkto (Items)', 'Itemized View'),
                        style: TextStyle(
                          color: _showAggregatedView ? Colors.white : Colors.grey[700],
                          fontWeight: FontWeight.bold,
                          fontSize: 11,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),

        // 3. Transactions List grouped by date
        Expanded(
          child: Consumer<InventoryProvider>(
            builder: (context, provider, child) {
              if (provider.isLoading) {
                return AppSkeletonLoader.list(itemCount: 6);
              }

              // Filter sales items
              final filteredSales = provider.sales.where((s) {
                final prodName = s.productName ?? '';
                final matchesSearch = prodName.toLowerCase().contains(_searchQuery.toLowerCase());
                if (_selectedDate == null) return matchesSearch;

                final isSameDay = s.saleDate.year == _selectedDate!.year &&
                                s.saleDate.month == _selectedDate!.month &&
                                s.saleDate.day == _selectedDate!.day;
                return matchesSearch && isSameDay;
              }).toList();

              if (filteredSales.isEmpty) {
                return AppEmptyState(
                  icon: Icons.history_toggle_off_rounded,
                  title: _searchQuery.isEmpty
                      ? 'Walang kasaysayan ng benta'
                      : 'Walang nahanap na benta',
                  description: _searchQuery.isEmpty
                      ? 'Lumabas ang mga benta at resibo rito kapag nag-benta ka sa POS Counter.'
                      : 'Walang benta na tumutugma sa "$_searchQuery".',
                );
              }

              if (_showAggregatedView) {
                final aggregatedSales = TransactionGroupingService.aggregateSales(filteredSales);
                return ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  itemCount: aggregatedSales.length,
                  itemBuilder: (context, index) {
                    final item = aggregatedSales[index];
                    return Card(
                      elevation: 0.5,
                      margin: const EdgeInsets.symmetric(vertical: 4),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        child: Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: AppColors.surfaceLight,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: const Icon(
                                Icons.shopping_bag_rounded,
                                color: AppColors.primary,
                                size: 20,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    item.productName,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 13,
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    'Kabuoan: ${item.totalQuantity % 1 == 0 ? item.totalQuantity.toInt() : item.totalQuantity} ${item.productUnit}',
                                    style: TextStyle(fontSize: 11, color: Colors.grey[600]),
                                  ),
                                ],
                              ),
                            ),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text(
                                  _formatCurrency(item.totalRevenue, currencySymbol),
                                  style: const TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 13,
                                    color: AppColors.primary,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  'Tubo: ${_formatCurrency(item.totalProfit, currencySymbol)}',
                                  style: TextStyle(
                                    fontSize: 11,
                                    color: Colors.green[800],
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                );
              }

              // Group items into transactions
              final transactions = TransactionGroupingService.groupIntoTransactions(filteredSales);

              // Group transactions by date
              final groupedTransactions = TransactionGroupingService.groupTransactionsByDate(transactions);

              return ListView.builder(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                itemCount: groupedTransactions.keys.length,
                itemBuilder: (context, dateIndex) {
                  final dateKey = groupedTransactions.keys.elementAt(dateIndex);
                  final dayTxList = groupedTransactions[dateKey]!;

                  // Sum sales totals for this entire day
                  double dayTotal = 0.0;
                  for (var tx in dayTxList) {
                    dayTotal += tx.fold<double>(0.0, (sum, sale) => sum + sale.totalPrice);
                  }

                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Date header banner
                      Padding(
                        padding: const EdgeInsets.only(top: 14, bottom: 6, left: 4),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              _formatHeaderDate(dateKey),
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 14,
                                color: AppColors.primary,
                              ),
                            ),
                            Text(
                              'Kabuoan: ${_formatCurrency(dayTotal, currencySymbol)}',
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                fontSize: 12,
                                color: Colors.grey[800],
                              ),
                            ),
                          ],
                        ),
                      ),

                      // List of transactions for this day
                      ...dayTxList.map((tx) {
                        final formattedTime = DateFormat('hh:mm a').format(tx.first.saleDate);
                        final txTotal = tx.fold<double>(0.0, (sum, sale) => sum + sale.totalPrice);
                        final itemsCount = tx.length;

                        return Card(
                          elevation: 0.5,
                          margin: const EdgeInsets.symmetric(vertical: 4),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          child: ListTile(
                            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                            leading: Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: AppColors.surfaceLight,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: const Icon(Icons.receipt_long_rounded, color: AppColors.primary, size: 22),
                            ),
                            title: Row(
                              children: [
                                Text(
                                  formattedTime,
                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                                ),
                                const SizedBox(width: 8),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: Colors.grey[100],
                                    borderRadius: BorderRadius.circular(12),
                                    border: Border.all(color: Colors.grey.shade300),
                                  ),
                                  child: Text(
                                    '$itemsCount ${itemsCount == 1 ? 'item' : 'items'}',
                                    style: TextStyle(fontSize: 10, color: Colors.grey[700], fontWeight: FontWeight.bold),
                                  ),
                                )
                              ],
                            ),
                            subtitle: Text(
                              tx.map((s) => s.productName ?? 'Unknown').join(', '),
                              style: TextStyle(fontSize: 11, color: Colors.grey[600]),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            trailing: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  _formatCurrency(txTotal, currencySymbol),
                                  style: const TextStyle(
                                    fontWeight: FontWeight.bold,
                                    fontSize: 14,
                                    color: AppColors.primary,
                                  ),
                                ),
                                const SizedBox(width: 4),
                                Icon(Icons.chevron_right_rounded, color: Colors.grey[400]),
                              ],
                            ),
                            onTap: () => _showTransactionDetailsModal(context, tx, settings),
                          ),
                        );
                      }),
                    ],
                  );
                },
              );
            },
          ),
        ),
      ],
    );

    if (isTablet) {
      bodyContent = Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 800),
          child: bodyContent,
        ),
      );
    }

    return Scaffold(
      drawer: const AppDrawer(),
      appBar: AppBar(
        title: Text(
          settings.tr('Kasaysayan ng Benta', 'Sales History'),
          style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
        ),
        backgroundColor: AppColors.primary,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.settings, color: Colors.white),
            tooltip: settings.tr('Mga Setting', 'Settings'),
            onPressed: () => SettingsScreen.navigate(context),
          ),
        ],
      ),
      body: bodyContent,
    );
  }
}
