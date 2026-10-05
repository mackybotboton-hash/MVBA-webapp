import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:print_bluetooth_thermal/print_bluetooth_thermal.dart';
import 'package:permission_handler/permission_handler.dart';
import '../models/product.dart';
import '../models/sale.dart';
import '../providers/inventory_provider.dart';
import '../providers/settings_provider.dart';
import '../providers/navigation_provider.dart';
import '../services/printer_service.dart';
import '../services/feedback_service.dart';
import '../services/barcode_handler.dart';
import '../models/cart_item.dart';
import '../widgets/app_toast.dart';
import '../widgets/app_loading_overlay.dart';
import 'barcode_scanner_modal.dart';
import 'settings_screen.dart';
import 'checkout_dialog.dart';
import '../widgets/app_drawer.dart';
import '../utils/title_case_formatter.dart';
import '../utils/currency_formatter.dart';
import '../utils/app_constants.dart';


class SalesScreen extends StatefulWidget {
  const SalesScreen({super.key});

  @override
  State<SalesScreen> createState() => _SalesScreenState();
}

class _SalesScreenState extends State<SalesScreen> with WidgetsBindingObserver {
  /// Tracks the last known tab index so we can detect transitions TO the POS tab.
  int _lastKnownTabIndex = 3;

  // Local state for the shopping cart
  final Map<int, CartItem> _cart = {};
  final ScrollController _cartScrollController = ScrollController();
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';
  String _selectedCategory = 'All';

  final FocusNode _keyboardFocusNode = FocusNode();
  final FocusNode _searchFocusNode = FocusNode();
  final HardwareBarcodeHandler _barcodeHandler = HardwareBarcodeHandler(
    minBarcodeLength: 6,
    debounceMs: 150,
  );
  final TextEditingController _hiddenInputController = TextEditingController();
  bool _isDialogOpen = false;
  bool _isPhoneCartVisible = true;

  /// Whether this screen is the active POS tab
  bool get _isPosTabActive {
    if (!mounted) return false;
    final provider = Provider.of<NavigationProvider>(context, listen: false);
    return provider.currentTabIndex == 3;
  }

  /// System-level hardware key handler that intercepts ALL hardware keyboard
  /// events regardless of which widget currently has focus.
  ///
  /// IMPORTANT: When the POS tab is active and no dialog/search is focused,
  /// we return `true` for ALL key events (not just completed barcodes).
  /// Returning `false` would let partial barcode characters leak through
  /// Flutter's focus tree into TextFields on other IndexedStack tabs
  /// (e.g. Product search, Sales History search), corrupting both the
  /// barcode buffer and those text fields.
  bool _systemKeyHandler(KeyEvent event) {
    // 1. Only intercept when POS tab is active
    if (!_isPosTabActive) return false;

    // 1.5. Only intercept when this POS screen route is the active (top-most) route
    final route = ModalRoute.of(context);
    if (route == null || !route.isCurrent) return false;

    // 2. Don't intercept if a modal/dialog is open (TextFields in dialogs need keyboard input)
    if (_isDialogOpen) return false;

    // 3. Don't intercept if the search field is explicitly focused by user
    if (_searchFocusNode.hasFocus) return false;

    // 4. Delegate to robust barcode handler
    final code = _barcodeHandler.handleKeyEvent(event);
    if (code != null) {
      _addScannedProductToCart(code);
      _aggressiveReclaimFocus();
    }

    // 5. Consume ALL key-down events when POS is active to prevent character
    //    leakage into TextFields on other IndexedStack tabs. Non-KeyDown
    //    events (KeyUp, KeyRepeat) are also consumed to be safe.
    return true;
  }

  /// Proactively unfocuses text fields and reclaims focus for the POS
  /// screen's keyboard landing pad. This ensures the Android IME doesn't
  /// activate and steal hardware scanner keystrokes.
  ///
  /// NOTE: We intentionally do NOT check _isDialogOpen here. The caller
  /// is responsible for knowing when to reclaim focus. Checking the flag
  /// here created a deadlock where a stuck flag prevented focus reclaim.
  void _aggressiveReclaimFocus() {
    if (!mounted) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (_searchFocusNode.hasFocus) {
        _searchFocusNode.unfocus();
      }
      FocusManager.instance.primaryFocus?.unfocus();
      // Explicitly request focus on the keyboard landing pad so hardware
      // key events have a deterministic target.
      if (_keyboardFocusNode.canRequestFocus) {
        _keyboardFocusNode.requestFocus();
      }
    });
  }

  @override
  void initState() {
    super.initState();
    // Register the system-level key handler permanently.
    HardwareKeyboard.instance.addHandler(_systemKeyHandler);
    // Listen for app lifecycle events (e.g., resuming from background/sleep)
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final provider = Provider.of<NavigationProvider>(context);
    final currentTab = provider.currentTabIndex;
    if (currentTab == 3 && _lastKnownTabIndex != 3) {
      // Transitioning TO POS tab
      _aggressiveReclaimFocus();
    }
    // Always ensure barcode buffer is cleared when POS tab is active.
    // We do NOT reset _isDialogOpen here, because didChangeDependencies is
    // triggered by route changes (like opening dialogs), which would prematurely
    // clear the flag and lock numerical/keyboard input in dialogs.
    if (currentTab == 3) {
      _barcodeHandler.clear(); // Always clear stale buffer when POS is active
    }
    if (currentTab != 3 && _lastKnownTabIndex == 3) {
      // Transitioning AWAY from POS tab
      _barcodeHandler.clear();
      _searchFocusNode.unfocus();
      FocusManager.instance.primaryFocus?.unfocus();
    }
    _lastKnownTabIndex = currentTab;
  }

  @override
  void dispose() {
    HardwareKeyboard.instance.removeHandler(_systemKeyHandler);
    WidgetsBinding.instance.removeObserver(this);
    _keyboardFocusNode.dispose();
    _searchFocusNode.dispose();
    _searchController.dispose();
    _barcodeHandler.dispose();
    _cartScrollController.dispose();
    _hiddenInputController.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    super.didChangeAppLifecycleState(state);
    if (state == AppLifecycleState.resumed) {
      // Re-register handler safely on app resume from background or USB OTG re-enumeration
      HardwareKeyboard.instance.removeHandler(_systemKeyHandler);
      HardwareKeyboard.instance.addHandler(_systemKeyHandler);

      _barcodeHandler.clear();
      _isDialogOpen = false;
      _aggressiveReclaimFocus();
    }
  }

  Future<void> _scanToSell() async {
    setState(() {
      _isDialogOpen = true;
    });

    try {
      final String? code = await showModalBottomSheet<String>(
        context: context,
        isScrollControlled: true,
        backgroundColor: Colors.transparent,
        builder: (context) => const BarcodeScannerModal(
          continuous: false,
        ),
      );
      
      if (code != null && code.isNotEmpty && mounted) {
        _addScannedProductToCart(code);
      }
    } finally {
      if (mounted) {
        setState(() {
          _isDialogOpen = false;
        });
        _aggressiveReclaimFocus();
      }
    }
  }

  void _addScannedProductToCart(String barcode) {
    final provider = Provider.of<InventoryProvider>(context, listen: false);

    final matchedProduct = provider.products.firstWhere(
      (p) => p.barcode != null && p.barcode!.trim() == barcode.trim(),
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

    if (matchedProduct.id == -1) {
      AppToast.error(context, 'Produkto hindi nahanap (Barcode: $barcode)');
    } else {
      _addToCart(matchedProduct);
      final settings = Provider.of<SettingsProvider>(context, listen: false);
      FeedbackService.trigger(
        volume: settings.beepVolume.toInt(),
        vibrationStrength: settings.vibrationStrength.toInt(),
      );
      final currencySymbol = settings.currencySymbol;
      AppToast.success(
        context,
        'Idinagdag sa cart: ${matchedProduct.name} - ${CurrencyFormatter.format(matchedProduct.sellingPrice, currencySymbol)}',
      );
    }
  }



  void _showSuccessDialog(
    List<Map<String, dynamic>> items,
    double total,
    double amountPaid,
    double changeGiven, {
    required bool printSuccess,
    required bool printerConnected,
    String? creditCustomerName,
  }) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) {
        bool isPrinterConnected = printerConnected;
        bool isPrintSuccess = printSuccess;
        bool isPrinting = false;
        bool isBluetoothOn = printerConnected; // if printer is connected, BT is obviously on
        bool isCheckingBluetooth = false;
        bool isConnectingPrinter = false;
        List<BluetoothInfo> pairedDevices = [];
        bool hasLoadedDevices = false;
        String? connectError;

        // Auto-check Bluetooth and load devices on dialog open
        Future<void> refreshBluetoothState(StateSetter setDialogState) async {
          setDialogState(() {
            isCheckingBluetooth = true;
            connectError = null;
          });

          // Request BT permissions
          try {
            await Permission.bluetoothConnect.request();
            await Permission.bluetoothScan.request();
          } catch (_) {}

          final btEnabled = await PrinterService.isBluetoothEnabled();
          final connected = await PrinterService.isConnected();

          List<BluetoothInfo> devices = [];
          if (btEnabled && !connected) {
            devices = await PrinterService.getBluetoothDevices();
          }

          if (dialogContext.mounted) {
            setDialogState(() {
              isBluetoothOn = btEnabled;
              isPrinterConnected = connected;
              pairedDevices = devices;
              hasLoadedDevices = true;
              isCheckingBluetooth = false;
            });
          }
        }

        // Trigger initial Bluetooth state check
        bool hasInitialized = false;

        return StatefulBuilder(
          builder: (context, setDialogState) {
            // One-time auto-check when dialog opens
            if (!hasInitialized) {
              hasInitialized = true;
              WidgetsBinding.instance.addPostFrameCallback((_) {
                if (!isPrinterConnected) {
                  refreshBluetoothState(setDialogState);
                }
              });
            }

            final settings = Provider.of<SettingsProvider>(context);
            final currencySymbol = settings.currencySymbol;

            // Build the printer status section
            Widget printerSection;

            if (isPrintSuccess) {
              // CASE 1: Already printed successfully
              printerSection = _buildPrinterStatusRow(
                icon: Icons.check_circle_rounded,
                color: Colors.green[800]!,
                text: 'Nai-print na ang resibo.',
              );
            } else if (isPrinterConnected) {
              // CASE 2: Printer connected, ready to print
              printerSection = _buildPrinterStatusRow(
                icon: Icons.print_rounded,
                color: AppColors.primary,
                text: 'Konektado ang printer. Pindutin ang "I-print at OK" upang i-print.',
              );
            } else if (isCheckingBluetooth) {
              // CASE 3: Checking Bluetooth status...
              printerSection = const Row(
                children: [
                  SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)),
                  SizedBox(width: 8),
                  Text('Tinitingnan ang Bluetooth...', style: TextStyle(fontSize: 12, color: Colors.grey)),
                ],
              );
            } else if (!isBluetoothOn) {
              // CASE 4: Bluetooth is OFF — show enable button
              printerSection = Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _buildPrinterStatusRow(
                    icon: Icons.bluetooth_disabled_rounded,
                    color: Colors.red[700]!,
                    text: 'Naka-OFF ang Bluetooth. I-ON para makapag-print.',
                  ),
                  const SizedBox(height: 8),
                  SizedBox(
                    height: 36,
                    child: ElevatedButton.icon(
                      onPressed: () async {
                        setDialogState(() => isCheckingBluetooth = true);
                        final enabled = await PrinterService.enableBluetooth();
                        if (enabled && context.mounted) {
                          // BT was enabled, now load devices
                          await refreshBluetoothState(setDialogState);
                        } else if (context.mounted) {
                          setDialogState(() => isCheckingBluetooth = false);
                        }
                      },
                      icon: const Icon(Icons.bluetooth_rounded, size: 16),
                      label: const Text('I-ON ang Bluetooth', style: TextStyle(fontSize: 12)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.blue[700],
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                    ),
                  ),
                ],
              );
            } else if (pairedDevices.isEmpty && hasLoadedDevices) {
              // CASE 5: BT is on but no paired devices found
              printerSection = Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _buildPrinterStatusRow(
                    icon: Icons.search_off_rounded,
                    color: Colors.orange[800]!,
                    text: 'Walang nakitang naka-pair na printer. I-pair muna sa Bluetooth settings.',
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: SizedBox(
                          height: 32,
                          child: OutlinedButton.icon(
                            onPressed: () => PrinterService.openBluetoothSettings(),
                            icon: const Icon(Icons.settings_bluetooth_rounded, size: 14),
                            label: const Text('BT Settings', style: TextStyle(fontSize: 11)),
                            style: OutlinedButton.styleFrom(
                              side: BorderSide(color: Colors.blue[700]!),
                              foregroundColor: Colors.blue[700],
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: SizedBox(
                          height: 32,
                          child: OutlinedButton.icon(
                            onPressed: () => refreshBluetoothState(setDialogState),
                            icon: const Icon(Icons.refresh_rounded, size: 14),
                            label: const Text('I-refresh', style: TextStyle(fontSize: 11)),
                            style: OutlinedButton.styleFrom(
                              side: BorderSide(color: Colors.green[700]!),
                              foregroundColor: Colors.green[700],
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              );
            } else {
              // CASE 6: BT on, paired devices available — show device list
              printerSection = Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  _buildPrinterStatusRow(
                    icon: Icons.bluetooth_searching_rounded,
                    color: Colors.blue[700]!,
                    text: 'Pumili ng printer para i-connect:',
                  ),
                  const SizedBox(height: 6),
                  if (connectError != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 6),
                      child: Text(
                        connectError!,
                        style: TextStyle(fontSize: 11, color: Colors.red[700], fontWeight: FontWeight.w500),
                      ),
                    ),
                  ConstrainedBox(
                    constraints: const BoxConstraints(maxHeight: 120),
                    child: ListView.builder(
                      shrinkWrap: true,
                      itemCount: pairedDevices.length,
                      itemBuilder: (ctx, index) {
                        final device = pairedDevices[index];
                        return Card(
                          margin: const EdgeInsets.symmetric(vertical: 2),
                          elevation: 0,
                          color: AppColors.searchFill,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8),
                            side: BorderSide(color: Colors.green.shade200),
                          ),
                          child: ListTile(
                            dense: true,
                            contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 0),
                            leading: Icon(Icons.print_rounded, size: 20, color: Colors.green[800]),
                            title: Text(
                              device.name,
                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                            ),
                            subtitle: Text(
                              device.macAdress,
                              style: TextStyle(fontSize: 10, color: Colors.grey[600]),
                            ),
                            trailing: isConnectingPrinter
                                ? const SizedBox(
                                    width: 16, height: 16,
                                    child: CircularProgressIndicator(strokeWidth: 2),
                                  )
                                : Icon(Icons.link_rounded, size: 18, color: Colors.green[800]),
                            onTap: isConnectingPrinter
                                ? null
                                : () async {
                                    setDialogState(() {
                                      isConnectingPrinter = true;
                                      connectError = null;
                                    });

                                    final success = await PrinterService.connect(device.macAdress);

                                    if (success && context.mounted) {
                                      // Save printer selection
                                      await settings.setSelectedPrinter(device.name, device.macAdress);
                                      setDialogState(() {
                                        isPrinterConnected = true;
                                        isConnectingPrinter = false;
                                      });
                                    } else if (context.mounted) {
                                      setDialogState(() {
                                        isConnectingPrinter = false;
                                        connectError = 'Hindi makakonekta sa ${device.name}. Pakibuksan ang printer.';
                                      });
                                    }
                                  },
                          ),
                        );
                      },
                    ),
                  ),
                  const SizedBox(height: 4),
                  SizedBox(
                    height: 28,
                    child: TextButton.icon(
                      onPressed: () => refreshBluetoothState(setDialogState),
                      icon: const Icon(Icons.refresh_rounded, size: 14),
                      label: const Text('I-refresh ang listahan', style: TextStyle(fontSize: 11)),
                    ),
                  ),
                ],
              );
            }

            return AlertDialog(
              title: const Text.rich(
                TextSpan(
                  children: [
                    WidgetSpan(
                      alignment: PlaceholderAlignment.middle,
                      child: Icon(Icons.check_circle_outline_rounded, color: Colors.green),
                    ),
                    WidgetSpan(child: SizedBox(width: 8)),
                    TextSpan(text: 'Matagumpay ang Benta!'),
                  ],
                ),
              ),
              content: SizedBox(
                width: double.maxFinite,
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Kabuuang Halaga: ${CurrencyFormatter.format(total, currencySymbol)}', style: const TextStyle(fontSize: 14)),
                      const SizedBox(height: 4),
                      if (creditCustomerName != null) ...[
                        Text(
                          settings.tr('Paraan: Utang (Credit Charge)', 'Type: Credit Charge (Utang)'),
                          style: const TextStyle(fontSize: 14),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${settings.tr("Pangalan: ", "Name: ")}$creditCustomerName',
                          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.red),
                        ),
                      ] else ...[
                        Text('Bayad ng Customer: ${CurrencyFormatter.format(amountPaid, currencySymbol)}', style: const TextStyle(fontSize: 14)),
                        const SizedBox(height: 4),
                        Text(
                          changeGiven == 0.0 
                              ? 'Sukli: Eksaktong Bayad!' 
                              : 'Sukli: ${CurrencyFormatter.format(changeGiven, currencySymbol)}',
                          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppColors.secondary),
                        ),
                      ],
                      const Divider(height: 24),
                      printerSection,
                    ],
                  ),
                ),
              ),
              actions: [
                ElevatedButton(
                  onPressed: isPrinting ? null : () async {
                    if (isPrinterConnected && !isPrintSuccess) {
                      setDialogState(() {
                        isPrinting = true;
                      });

                      final success = await PrinterService.printReceipt(
                        storeName: settings.storeName,
                        ownerName: settings.ownerName,
                        items: items,
                        total: total,
                        amountPaid: amountPaid,
                        changeGiven: changeGiven,
                        currencySymbol: settings.currencySymbol,
                        creditCustomerName: creditCustomerName,
                      );

                      if (context.mounted) {
                        setDialogState(() {
                          isPrintSuccess = success;
                          isPrinting = false;
                        });

                        if (!success) {
                          return; // Don't close dialog if print failed — let user retry
                        }
                      }
                    }

                    if (context.mounted) {
                      AppToast.success(context, 'Matagumpay ang benta!');
                      Navigator.pop(dialogContext);
                    }
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                  ),
                  child: isPrinting
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : Text(isPrinterConnected && !isPrintSuccess ? 'I-print at OK' : 'OK'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  /// Helper widget for printer status row in the success dialog
  Widget _buildPrinterStatusRow({
    required IconData icon,
    required Color color,
    required String text,
  }) {
    return Row(
      children: [
        Icon(icon, color: color, size: 18),
        const SizedBox(width: 6),
        Expanded(
          child: Text(
            text,
            style: TextStyle(fontSize: 12, color: color, fontWeight: FontWeight.w500),
          ),
        ),
      ],
    );
  }

  void _scrollToBottom() {
    if (_cartScrollController.hasClients) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_cartScrollController.hasClients) {
          _cartScrollController.animateTo(
            _cartScrollController.position.maxScrollExtent,
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeOut,
          );
        }
      });
    }
  }

  void _addToCart(Product product, {double quantity = 1.0}) {
    if (product.isInventory && product.currentStock <= 0) {
      AppToast.error(context, 'Walang stock ang produktong ito!');
      return;
    }

    bool added = false;
    setState(() {
      if (_cart.containsKey(product.id)) {
        final existingItem = _cart[product.id]!;
        if (!product.isInventory || existingItem.quantity + quantity <= product.currentStock) {
          existingItem.quantity += quantity;
          added = true;
        } else {
          AppToast.warning(
            context,
            'Sapat lang ang stock para sa ${product.currentStock} ${product.unit}!',
          );
        }
      } else {
        _cart[product.id!] = CartItem(product: product, quantity: quantity);
        added = true;
      }
    });

    if (added) {
      _scrollToBottom();
    }
  }

  void _decrementCartItem(int productId) {
    setState(() {
      if (_cart.containsKey(productId)) {
        final item = _cart[productId]!;
        if (item.quantity > 1) {
          item.quantity -= 1;
        } else {
          _cart.remove(productId);
        }
      }
    });
  }

  void _removeCartItem(int productId) {
    setState(() {
      _cart.remove(productId);
    });
  }

  Future<void> _editCartItemQuantity(BuildContext context, CartItem item) async {
    final qtyController = TextEditingController(
      text: item.quantity % 1 == 0 ? item.quantity.toInt().toString() : item.quantity.toString(),
    );
    final qtyFocusNode = FocusNode();
    final settings = Provider.of<SettingsProvider>(context, listen: false);
    setState(() {
      _isDialogOpen = true;
    });

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (qtyFocusNode.canRequestFocus) {
        qtyFocusNode.requestFocus();
      }
    });

    try {
      await showDialog(
        context: context,
        builder: (context) {
          return AlertDialog(
            title: Text(settings.tr('Palitan ang Dami (${item.product.unit})', 'Change Quantity (${item.product.unit})')),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('${settings.tr("Produkto: ", "Product: ")}${item.product.name}'),
                if (item.product.isInventory)
                  Text('${settings.tr("Available Stock: ", "Available Stock: ")}${item.product.currentStock} ${item.product.unit}')
                else
                  Text(settings.tr('Stock: Hindi sinusubaybayan (Non-Inventory)', 'Stock: Not tracked (Non-Inventory)')),
                const SizedBox(height: 12),
                TextField(
                  controller: qtyController,
                  focusNode: qtyFocusNode,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: InputDecoration(
                    labelText: settings.tr('Dami (Quantity)', 'Quantity'),
                    border: const OutlineInputBorder(),
                  ),
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: Text(settings.tr('I-cancel', 'Cancel')),
              ),
              ElevatedButton(
                onPressed: () {
                  final double? newQty = double.tryParse(qtyController.text);
                  if (newQty == null || newQty <= 0) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text(settings.tr('Maling dami!', 'Invalid quantity!')), backgroundColor: Colors.red),
                    );
                    return;
                  }

                  if (item.product.isInventory && newQty > item.product.currentStock) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(settings.tr(
                          'Babala: ${item.product.currentStock} ${item.product.unit} lang ang stock!',
                          'Warning: Only ${item.product.currentStock} ${item.product.unit} in stock!',
                        )),
                        backgroundColor: Colors.orange,
                      ),
                    );
                    return;
                  }

                  setState(() {
                    item.quantity = newQty;
                  });
                  Navigator.pop(context);
                },
                style: ElevatedButton.styleFrom(backgroundColor: AppColors.secondary, foregroundColor: Colors.white),
                child: Text(settings.tr('I-save', 'Save')),
              ),
            ],
          );
        },
      );
    } finally {
      qtyFocusNode.unfocus();
      WidgetsBinding.instance.addPostFrameCallback((_) {
        qtyFocusNode.dispose();
      });
      if (mounted) {
        setState(() {
          _isDialogOpen = false;
        });
        _aggressiveReclaimFocus();
      }
    }
  }

  Future<void> _editCartItemPrice(BuildContext context, CartItem item) async {
    final settings = Provider.of<SettingsProvider>(context, listen: false);
    final controller = TextEditingController(text: item.activePrice.toStringAsFixed(2));
    final priceFocusNode = FocusNode();
    final formKey = GlobalKey<FormState>();

    final double buyingPrice = item.product.buyingPrice;
    final double originalPrice = item.product.sellingPrice;
    final currencySymbol = settings.currencySymbol;

    setState(() {
      _isDialogOpen = true;
    });

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (priceFocusNode.canRequestFocus) {
        priceFocusNode.requestFocus();
        controller.selection = TextSelection(
          baseOffset: 0,
          extentOffset: controller.text.length,
        );
      }
    });

    try {
      final result = await showDialog<double>(
        context: context,
        builder: (context) {
          return AlertDialog(
            title: Text(settings.tr('Baguhin ang Presyo (Discount)', 'Modify Price (Discount)')),
            content: Form(
              key: formKey,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    '${item.product.name}\n'
                    '${settings.tr("Original na Presyo", "Original Price")}: ${CurrencyFormatter.format(originalPrice, currencySymbol)}\n'
                    '${settings.tr("Puhunan (Cost)", "Cost Price")}: ${CurrencyFormatter.format(buyingPrice, currencySymbol)}',
                    style: TextStyle(fontSize: 12, color: Colors.grey[700], height: 1.5),
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: controller,
                    focusNode: priceFocusNode,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: InputDecoration(
                      labelText: settings.tr('Bagong Presyo', 'New Price'),
                      prefixText: currencySymbol,
                      border: const OutlineInputBorder(),
                    ),
                    validator: (value) {
                      if (value == null || value.trim().isEmpty) {
                        return settings.tr('Ilagay ang bagong presyo', 'Enter new price');
                      }
                      final parsed = double.tryParse(value);
                      if (parsed == null || parsed < 0) {
                        return settings.tr('Ilagay ang tamang halaga', 'Enter a valid amount');
                      }
                      return null;
                    },
                  ),
                ],
              ),
            ),
            actions: [
              TextButton(
                onPressed: () {
                  // Reset to original price
                  Navigator.pop(context, originalPrice);
                },
                child: Text(settings.tr('I-reset', 'Reset')),
              ),
              TextButton(
                onPressed: () => Navigator.pop(context, null),
                child: Text(settings.tr('I-cancel', 'Cancel')),
              ),
              ElevatedButton(
                onPressed: () {
                  if (formKey.currentState!.validate()) {
                    final parsed = double.tryParse(controller.text);
                    Navigator.pop(context, parsed);
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

      if (result != null) {
        setState(() {
          if (result == originalPrice) {
            item.customPrice = null;
          } else {
            item.customPrice = result;
          }
        });
      }
    } finally {
      priceFocusNode.unfocus();
      WidgetsBinding.instance.addPostFrameCallback((_) {
        priceFocusNode.dispose();
      });
      if (mounted) {
        setState(() {
          _isDialogOpen = false;
        });
        _aggressiveReclaimFocus();
      }
    }
  }

  Future<void> _editProductStockDialog(BuildContext context, Product product) async {
    final stockController = TextEditingController(
      text: product.currentStock % 1 == 0 ? product.currentStock.toInt().toString() : product.currentStock.toString(),
    );
    final stockFocusNode = FocusNode();

    setState(() {
      _isDialogOpen = true;
    });

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (stockFocusNode.canRequestFocus) {
        stockFocusNode.requestFocus();
        stockController.selection = TextSelection(
          baseOffset: 0,
          extentOffset: stockController.text.length,
        );
      }
    });

    try {
      await showDialog(
        context: context,
        builder: (dialogContext) {
          return AlertDialog(
            title: Text.rich(
              TextSpan(
                children: [
                  const WidgetSpan(
                    alignment: PlaceholderAlignment.middle,
                    child: Icon(Icons.edit_note_rounded, color: AppColors.primary),
                  ),
                  const WidgetSpan(child: SizedBox(width: 8)),
                  TextSpan(text: 'I-edit ang Stock: ${product.name}'),
                ],
              ),
            ),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Kasalukuyang Stock: ${product.currentStock} ${product.unit}',
                  style: TextStyle(fontSize: 13, color: Colors.grey[700], fontWeight: FontWeight.w500),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: stockController,
                  focusNode: stockFocusNode,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: InputDecoration(
                    labelText: 'Bagong Dami ng Stock (${product.unit})',
                    hintText: 'Ilagay ang bagong stock...',
                    border: const OutlineInputBorder(),
                    prefixIcon: const Icon(Icons.inventory_rounded),
                  ),
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialogContext),
                child: const Text('I-cancel'),
              ),
              ElevatedButton(
                onPressed: () async {
                  final double? newStock = double.tryParse(stockController.text.replaceAll(',', '.'));
                  if (newStock == null || newStock < 0) {
                    AppToast.error(dialogContext, 'Maling dami ng stock!');
                    return;
                  }

                  final updatedProduct = product.copyWith(currentStock: newStock);
                  final provider = Provider.of<InventoryProvider>(context, listen: false);

                  await AppLoadingOverlay.runWithLoading(
                    context: context,
                    message: 'Ina-update ang stock ng ${product.name}...',
                    asyncTask: () async {
                      await provider.updateProduct(updatedProduct);
                    },
                  );

                  if (dialogContext.mounted) {
                    Navigator.pop(dialogContext);
                  }

                  if (context.mounted) {
                    AppToast.success(
                      context,
                      'Na-update ang stock ng ${product.name} sa $newStock ${product.unit}!',
                    );
                  }
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                ),
                child: const Text('I-save Stock'),
              ),
            ],
          );
        },
      );
    } finally {
      stockFocusNode.unfocus();
      WidgetsBinding.instance.addPostFrameCallback((_) {
        stockFocusNode.dispose();
      });
      if (mounted) {
        setState(() {
          _isDialogOpen = false;
        });
        _aggressiveReclaimFocus();
      }
    }
  }

  Future<void> _showAddNonInventoryDialog(BuildContext context) async {
    final nameController = TextEditingController();
    final buyingPriceController = TextEditingController();
    final sellingPriceController = TextEditingController();
    double quantity = 1.0;

    final formKey = GlobalKey<FormState>();
    final settings = Provider.of<SettingsProvider>(context, listen: false);

    setState(() {
      _isDialogOpen = true;
    });

    try {
      await showDialog(
        context: context,
        barrierDismissible: false,
        builder: (dialogContext) {
          return StatefulBuilder(
            builder: (context, setDialogState) {
              return AlertDialog(
                title: Text.rich(
                  TextSpan(
                    children: [
                      const WidgetSpan(
                        alignment: PlaceholderAlignment.middle,
                        child: Icon(Icons.add_box_rounded, color: AppColors.primary),
                      ),
                      const WidgetSpan(child: SizedBox(width: 8)),
                      TextSpan(
                        text: settings.tr(
                          'Non-Inventory na Produkto',
                          'Non-Inventory Product',
                        ),
                      ),
                    ],
                  ),
                ),
                content: Form(
                  key: formKey,
                  child: SingleChildScrollView(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // Product Name
                        TextFormField(
                          controller: nameController,
                          textCapitalization: TextCapitalization.words,
                          inputFormatters: [TitleCaseTextInputFormatter()],
                          autofocus: true,
                          decoration: InputDecoration(
                            labelText: settings.tr('Pangalan ng Produkto *', 'Product Name *'),
                            border: const OutlineInputBorder(),
                            prefixIcon: const Icon(Icons.shopping_bag_outlined),
                          ),
                          validator: (value) {
                            if (value == null || value.trim().isEmpty) {
                              return settings.tr(
                                'Ilagay ang pangalan ng produkto',
                                'Enter product name',
                              );
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 12),

                        // Buying Price
                        TextFormField(
                          controller: buyingPriceController,
                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                          decoration: InputDecoration(
                            labelText: settings.tr('Puhunan (Buying Price) *', 'Buying Price *'),
                            border: const OutlineInputBorder(),
                            prefixText: settings.currencySymbol,
                            prefixIcon: const Icon(Icons.input_rounded),
                          ),
                          validator: (value) {
                            if (value == null || value.isEmpty) {
                              return settings.tr('Ilagay ang puhunan', 'Enter buying price');
                            }
                            final val = double.tryParse(value);
                            if (val == null || val < 0) {
                              return settings.tr('Maling presyo', 'Invalid price');
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 12),

                        // Selling Price
                        TextFormField(
                          controller: sellingPriceController,
                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                          decoration: InputDecoration(
                            labelText: settings.tr('Presyo (Selling Price) *', 'Selling Price *'),
                            border: const OutlineInputBorder(),
                            prefixText: settings.currencySymbol,
                            prefixIcon: const Icon(Icons.sell_rounded),
                          ),
                          validator: (value) {
                            if (value == null || value.isEmpty) {
                              return settings.tr('Ilagay ang presyo', 'Enter selling price');
                            }
                            final val = double.tryParse(value);
                            if (val == null || val < 0) {
                              return settings.tr('Maling presyo', 'Invalid price');
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: 16),

                        // Quantity Counter
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              settings.tr('Dami (Quantity):', 'Quantity:'),
                              style: const TextStyle(fontWeight: FontWeight.bold),
                            ),
                            Row(
                              children: [
                                IconButton(
                                  icon: const Icon(Icons.remove_circle_outline, color: Colors.red),
                                  onPressed: quantity > 1
                                      ? () {
                                          setDialogState(() {
                                            quantity -= 1;
                                          });
                                        }
                                      : null,
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                  decoration: BoxDecoration(
                                    border: Border.all(color: Colors.grey.shade400),
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: Text(
                                    quantity % 1 == 0
                                        ? quantity.toInt().toString()
                                        : quantity.toString(),
                                    style: const TextStyle(fontWeight: FontWeight.bold),
                                  ),
                                ),
                                IconButton(
                                  icon: const Icon(Icons.add_circle_outline, color: Colors.green),
                                  onPressed: () {
                                    setDialogState(() {
                                      quantity += 1;
                                    });
                                  },
                                ),
                              ],
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.pop(dialogContext),
                    child: Text(settings.tr('I-cancel', 'Cancel')),
                  ),
                  ElevatedButton(
                    onPressed: () async {
                      if (!formKey.currentState!.validate()) return;

                      final name = nameController.text.trim();
                      final buyingPrice = double.parse(buyingPriceController.text);
                      final sellingPrice = double.parse(sellingPriceController.text);

                      final tempProduct = Product(
                        name: name,
                        category: 'Others',
                        unit: 'pcs',
                        buyingPrice: buyingPrice,
                        sellingPrice: sellingPrice,
                        currentStock: quantity,
                        minStockThreshold: 0,
                        isInventory: false,
                      );

                      final provider = Provider.of<InventoryProvider>(context, listen: false);

                      Product? createdProduct;
                      await AppLoadingOverlay.runWithLoading(
                        context: context,
                        message: settings.tr('Inihahanda ang produkto...', 'Preparing product...'),
                        asyncTask: () async {
                          createdProduct = await provider.addProduct(tempProduct);
                        },
                      );

                      if (createdProduct != null && dialogContext.mounted) {
                        _addToCart(createdProduct!, quantity: quantity);
                        Navigator.pop(dialogContext);

                        AppToast.success(
                          context,
                          settings.tr(
                            'Naidagdag ang "$name" sa cart!',
                            'Added "$name" to cart!',
                          ),
                        );
                      }
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                    ),
                    child: Text(settings.tr('Tapos na', 'Confirm')),
                  ),
                ],
              );
            },
          );
        },
      );
    } finally {
      if (mounted) {
        setState(() {
          _isDialogOpen = false;
        });
        _barcodeHandler.clear();
        _aggressiveReclaimFocus();
      }
    }
  }

  double get _cartTotal {
    double total = 0.0;
    _cart.forEach((key, item) {
      total += item.totalPrice;
    });
    return total;
  }

  Future<void> _checkoutCart() async {
    if (_cart.isEmpty) return;

    final provider = Provider.of<InventoryProvider>(context, listen: false);
    final settings = Provider.of<SettingsProvider>(context, listen: false);
    final currencySymbol = settings.currencySymbol;
    final double totalVal = _cartTotal;

    setState(() {
      _isDialogOpen = true;
    });

    try {
      final result = await showDialog<Map<String, dynamic>>(
        context: context,
        barrierDismissible: false,
        builder: (context) {
          return CheckoutDialog(
            cart: _cart,
            total: totalVal,
            currencySymbol: currencySymbol,
          );
        },
      );

      if (result != null && mounted) {
        final String checkoutType = result['type'] ?? 'cash';
        final int? customerId = result['customerId'];
        final String? customerName = result['customerName'];
        final double finalPaid = (result['paid'] ?? 0.0) as double;
        final double finalChange = (result['change'] ?? 0.0) as double;
        final DateTime checkoutTime = DateTime.now();

        final printItems = _cart.values.map((item) {
          return {
            'name': item.product.name,
            'qty': item.quantity % 1 == 0 ? item.quantity.toInt() : item.quantity,
            'price': item.activePrice,
            'subtotal': item.totalPrice,
          };
        }).toList();

        final salesList = _cart.values.map((item) {
          return Sale(
            productId: item.product.id!,
            quantity: item.quantity,
            sellingPrice: item.activePrice,
            buyingPrice: item.product.buyingPrice,
            saleDate: checkoutTime,
            amountPaid: checkoutType == 'credit' ? 0.0 : finalPaid,
            changeGiven: checkoutType == 'credit' ? 0.0 : finalChange,
          );
        }).toList();

        try {
          // 1. Save checkout to SQLite (updates stocks & creates credit transactions)
          await provider.checkout(salesList, customerId: customerId);

          // 2. Clear cart IMMEDIATELY
          setState(() {
            _cart.clear();
            _isPhoneCartVisible = false;
          });

          // 3. Check printer connection status without auto-printing
          bool isPrinterConnected = false;
          try {
            isPrinterConnected = await PrinterService.isConnected();
          } catch (_) {}

          // 4. Display Success Receipt Dialog (Toast & Print happen on OK click)
          if (mounted) {
            _showSuccessDialog(
              printItems,
              totalVal,
              finalPaid,
              finalChange,
              printSuccess: false,
              printerConnected: isPrinterConnected,
              creditCustomerName: customerName,
            );
          }
        } catch (e) {
          if (mounted) {
            AppToast.error(
              context,
              'Pumalya ang benta: ${e.toString().replaceAll('StateError: ', '').replaceAll('Exception: ', '')}',
            );
          }
        }
      }
    } finally {
      if (mounted) {
        setState(() {
          _isDialogOpen = false;
        });
        _aggressiveReclaimFocus();
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<InventoryProvider>(context);
    final settings = Provider.of<SettingsProvider>(context);
    final currencySymbol = settings.currencySymbol;
    final List<String> categories = ['All', ...settings.productCategories];

    // Safety: If _isDialogOpen is stuck true but no dialog/modal is actually
    // visible on top of this route, reset it. This catches edge cases where
    // a dialog was dismissed without properly clearing the flag (e.g., system
    // back gesture, tab switch while modal was open).
    if (_isDialogOpen && ModalRoute.of(context)?.isCurrent == true) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && _isDialogOpen && ModalRoute.of(context)?.isCurrent == true) {
          setState(() {
            _isDialogOpen = false;
          });
        }
      });
    }

    // Focus reclaim is now handled proactively in didChangeDependencies()
    // and _aggressiveReclaimFocus(), so we no longer need to do it here.
    // This avoids scheduling focus changes during every build.

    // Apply search and category filter on products
    final posProducts = provider.products.where((p) {
      final matchesSearch = p.name.toLowerCase().contains(_searchQuery.toLowerCase()) || 
                            (p.barcode != null && p.barcode!.toLowerCase().contains(_searchQuery.toLowerCase()));
      final matchesCategory = _selectedCategory == 'All' || p.category == _selectedCategory;
      return matchesSearch && matchesCategory;
    }).toList();

    final width = MediaQuery.of(context).size.width;
    final isTablet = width >= 768;

    Widget productSearchPane = Column(
      children: [
        // 1. TOP SECTION: Product Search & Quick Add
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 4),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _searchController,
                  focusNode: _searchFocusNode,
                  onChanged: (val) {
                    setState(() {
                      _searchQuery = val;
                    });
                  },
                  decoration: InputDecoration(
                    hintText: settings.tr('Hanapin ang binebenta...', 'Search item to sell...'),
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
            ],
          ),
        ),

        // Horizontal Category filter chips (smaller height)
        SizedBox(
          height: 38,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            itemCount: categories.length,
            itemBuilder: (context, index) {
              final cat = categories[index];
              final isSelected = _selectedCategory == cat;
              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4),
                child: ChoiceChip(
                  label: Text(
                    cat == 'All' ? settings.tr('Lahat', 'All') : cat,
                    style: TextStyle(fontSize: 11, color: isSelected ? Colors.white : AppColors.secondary),
                  ),
                  selected: isSelected,
                  onSelected: (selected) {
                    if (selected) {
                      setState(() {
                        _selectedCategory = cat;
                      });
                    }
                  },
                  selectedColor: const Color(0xFF2E7E32),
                  backgroundColor: AppColors.surfaceLight,
                  showCheckmark: false,
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                ),
              );
            },
          ),
        ),
        const SizedBox(height: 4),

        // List of Search Results
        Expanded(
          child: posProducts.isEmpty
              ? Center(
                  child: Text(
                    _searchQuery.isEmpty 
                        ? settings.tr('Walang produkto.', 'No products available.')
                        : settings.tr('Walang nahanap na "$_searchQuery"', 'No product found for "$_searchQuery"'),
                    style: TextStyle(color: Colors.grey[500]),
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  itemCount: posProducts.length,
                  itemBuilder: (context, index) {
                    final prod = posProducts[index];
                    final isLow = prod.isLowStock;
                    final inCartQty = _cart[prod.id]?.quantity ?? 0;

                    return Card(
                      elevation: 0.5,
                      margin: const EdgeInsets.symmetric(vertical: 4),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                        side: BorderSide(color: Colors.grey.shade200),
                      ),
                      child: ListTile(
                        dense: true,
                        leading: prod.imagePath != null && File(prod.imagePath!).existsSync()
                            ? ClipRRect(
                                borderRadius: BorderRadius.circular(6),
                                child: Image.file(
                                  File(prod.imagePath!),
                                  fit: BoxFit.cover,
                                  width: 36,
                                  height: 36,
                                ),
                              )
                            : Container(
                                width: 36,
                                height: 36,
                                decoration: BoxDecoration(
                                  color: Colors.grey[100],
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: const Icon(Icons.shopping_bag_outlined, color: Colors.grey),
                              ),
                        title: Text(
                          prod.name,
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                        ),
                        subtitle: Text(
                          settings.tr(
                            'Presyo: ${CurrencyFormatter.format(prod.sellingPrice, currencySymbol)} | Stock: ${prod.currentStock} ${prod.unit}',
                            'Price: ${CurrencyFormatter.format(prod.sellingPrice, currencySymbol)} | Stock: ${prod.currentStock} ${prod.unit}',
                          ),
                          style: TextStyle(
                            color: isLow ? Colors.red.shade700 : Colors.grey[700],
                          ),
                        ),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (inCartQty > 0) ...[
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  color: AppColors.surfaceLight,
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(color: const Color(0xFFA5D6A7)),
                                ),
                                child: Text(
                                  'x${inCartQty % 1 == 0 ? inCartQty.toInt() : inCartQty}',
                                  style: const TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                    color: AppColors.primary,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 4),
                            ],
                            IconButton(
                              constraints: const BoxConstraints(),
                              padding: const EdgeInsets.all(4),
                              icon: const Icon(Icons.edit_note_rounded, size: 22, color: AppColors.primary),
                              tooltip: settings.tr('I-edit ang Stock', 'Edit Stock'),
                              onPressed: () => _editProductStockDialog(context, prod),
                            ),
                            const SizedBox(width: 4),
                            ElevatedButton(
                              onPressed: () => _addToCart(prod),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: isLow ? Colors.amber.shade800 : AppColors.primary,
                                foregroundColor: Colors.white,
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 0),
                                minimumSize: const Size(60, 32),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                                elevation: 0.5,
                              ),
                              child: Text(settings.tr('Add', 'Add'), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
        ),
      ],
    );

    Widget activeShoppingCartContainer = Container(
      color: Colors.grey[50],
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Shopping cart title header
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            color: AppColors.surfaceLight,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    const Icon(Icons.shopping_cart_rounded, color: AppColors.primary),
                    const SizedBox(width: 8),
                    Text(
                      '${settings.tr("Cart ng Mamimili", "Customer Cart")} (${_cart.length})',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: AppColors.primary),
                    ),
                  ],
                ),
                if (_cart.isNotEmpty)
                  TextButton.icon(
                    style: TextButton.styleFrom(
                      foregroundColor: Colors.red[800],
                      padding: EdgeInsets.zero,
                      minimumSize: const Size(50, 30),
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                    icon: const Icon(Icons.delete_sweep_rounded, size: 18),
                    label: Text(settings.tr('I-clear All', 'Clear All'), style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                    onPressed: () {
                      setState(() {
                        _cart.clear();
                      });
                    },
                  ),
              ],
            ),
          ),

          // Items inside the cart
          Expanded(
            child: Stack(
              children: [
                _cart.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.shopping_cart_outlined, size: 48, color: Colors.grey[400]),
                            const SizedBox(height: 8),
                            Text(
                              settings.tr('Walang laman ang cart.', 'Cart is empty.'),
                              style: TextStyle(color: Colors.grey[500], fontSize: 13),
                            ),
                          ],
                        ),
                      )
                    : ListView.builder(
                        controller: _cartScrollController,
                        padding: const EdgeInsets.all(8),
                        itemCount: _cart.values.length,
                        itemBuilder: (context, index) {
                          final item = _cart.values.elementAt(index);
                          return Card(
                            margin: const EdgeInsets.symmetric(vertical: 4, horizontal: 2),
                            child: Padding(
                              padding: const EdgeInsets.all(8.0),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  // Line 1: Item Name and Unit Price
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Expanded(
                                        child: Text(
                                          item.product.name,
                                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                      ),
                                      InkWell(
                                        onTap: () => _editCartItemPrice(context, item),
                                        borderRadius: BorderRadius.circular(4),
                                        child: Padding(
                                          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                                          child: Row(
                                            mainAxisSize: MainAxisSize.min,
                                            children: [
                                              if (item.customPrice != null)
                                                const Icon(Icons.sell_outlined, size: 12, color: Colors.blue),
                                              if (item.customPrice != null)
                                                const SizedBox(width: 2),
                                              Text(
                                                CurrencyFormatter.format(item.totalPrice, currencySymbol),
                                                style: TextStyle(
                                                  fontWeight: FontWeight.bold,
                                                  fontSize: 13,
                                                  color: item.customPrice != null ? Colors.blue : AppColors.primary,
                                                  decoration: item.customPrice != null ? TextDecoration.underline : null,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 4),
                                  // Line 2: Details and Quantity Controls
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Expanded(
                                        child: InkWell(
                                          onTap: () => _editCartItemPrice(context, item),
                                          borderRadius: BorderRadius.circular(4),
                                          child: Padding(
                                            padding: const EdgeInsets.symmetric(vertical: 2),
                                            child: Row(
                                              mainAxisSize: MainAxisSize.min,
                                              children: [
                                                Flexible(
                                                  child: Text(
                                                    '@ ${CurrencyFormatter.format(item.activePrice, currencySymbol)} / ${item.product.unit}',
                                                    style: TextStyle(
                                                      fontSize: 11,
                                                      color: item.customPrice != null ? Colors.blue : Colors.grey[600],
                                                      fontWeight: item.customPrice != null ? FontWeight.bold : FontWeight.normal,
                                                    ),
                                                    overflow: TextOverflow.ellipsis,
                                                  ),
                                                ),
                                                if (item.customPrice != null) ...[
                                                  const SizedBox(width: 4),
                                                  Text(
                                                    '(${settings.tr("Orig", "Orig")}: ${CurrencyFormatter.format(item.product.sellingPrice, currencySymbol)})',
                                                    style: TextStyle(
                                                      fontSize: 9,
                                                      color: Colors.grey[400],
                                                      decoration: TextDecoration.lineThrough,
                                                    ),
                                                  ),
                                                ],
                                              ],
                                            ),
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 4),
                                      FittedBox(
                                        fit: BoxFit.scaleDown,
                                        child: Row(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            IconButton(
                                              constraints: const BoxConstraints(),
                                              padding: const EdgeInsets.all(4),
                                              icon: const Icon(Icons.remove_circle_outline, size: 18, color: Colors.red),
                                              onPressed: () => _decrementCartItem(item.product.id!),
                                            ),
                                            const SizedBox(width: 2),
                                            InkWell(
                                              onTap: () => _editCartItemQuantity(context, item),
                                              child: Container(
                                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                                                decoration: BoxDecoration(
                                                  border: Border.all(color: Colors.grey.shade300),
                                                  borderRadius: BorderRadius.circular(4),
                                                ),
                                                child: Text(
                                                  item.quantity % 1 == 0 ? item.quantity.toInt().toString() : item.quantity.toString(),
                                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11),
                                                ),
                                              ),
                                            ),
                                            const SizedBox(width: 2),
                                            IconButton(
                                              constraints: const BoxConstraints(),
                                              padding: const EdgeInsets.all(4),
                                              icon: const Icon(Icons.add_circle_outline, size: 18, color: Colors.green),
                                              onPressed: () => _addToCart(item.product),
                                            ),
                                            const SizedBox(width: 2),
                                            if (item.product.isInventory) ...[
                                              IconButton(
                                                constraints: const BoxConstraints(),
                                                padding: const EdgeInsets.all(4),
                                                icon: const Icon(Icons.edit_note_rounded, size: 18, color: AppColors.primary),
                                                tooltip: 'I-edit ang Stock',
                                                onPressed: () => _editProductStockDialog(context, item.product),
                                              ),
                                              const SizedBox(width: 2),
                                            ],
                                            IconButton(
                                              constraints: const BoxConstraints(),
                                              padding: const EdgeInsets.all(4),
                                              icon: Icon(Icons.delete_outline_rounded, size: 18, color: Colors.grey[600]),
                                              onPressed: () => _removeCartItem(item.product.id!),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                // Floating Camera Scanner Button
                Positioned(
                  bottom: 16,
                  right: 16,
                  child: FloatingActionButton(
                    heroTag: 'camera_scan_fab',
                    onPressed: _scanToSell,
                    backgroundColor: AppColors.primary,
                    elevation: 4,
                    child: const Icon(Icons.camera_alt_outlined, color: Colors.white),
                  ),
                ),
              ],
            ),
          ),

          // Cart Checkout Panel
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              boxShadow: [
                BoxShadow(
                  color: Colors.grey.withAlpha(51),
                  spreadRadius: 2,
                  blurRadius: 5,
                  offset: const Offset(0, -2),
                )
              ],
            ),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      settings.tr('Kabuuang Halaga (Total):', 'Total Amount:'),
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                    ),
                    Text(
                      CurrencyFormatter.format(_cartTotal, currencySymbol),
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 20,
                        color: AppColors.primary,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _cart.isEmpty ? null : _checkoutCart,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      disabledBackgroundColor: Colors.grey[300],
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.payment_rounded),
                        const SizedBox(width: 8),
                        Text(
                          '${settings.tr('I-benta na!', 'Checkout!')} (${CurrencyFormatter.format(_cartTotal, currencySymbol)})',
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );

    return Scaffold(
      drawer: const AppDrawer(),
      appBar: AppBar(
        title: Text(
          settings.tr('Mag-benta (POS Cart)', 'POS / Cashier Cart'),
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
          IconButton(
            icon: const Icon(Icons.add_box_rounded, color: Colors.white),
            tooltip: settings.tr('Magdagdag ng Custom Item', 'Add Custom Item'),
            onPressed: () => _showAddNonInventoryDialog(context),
          ),
        ],
      ),
      body: Stack(
        children: [
          // Hidden text field acting as a focus anchor to maintain an active IME input connection.
          // This keeps the Android OS from displaying the floating physical keyboard assistant helper toolbar
          // when scanning, while keyboardType: TextInputType.none prevents the soft keyboard from showing up.
          Positioned(
            left: -100,
            top: -100,
            width: 1,
            height: 1,
            child: Opacity(
              opacity: 0,
              child: Material(
                type: MaterialType.transparency,
                child: TextField(
                  key: const ValueKey('pos_barcode_focus_anchor'),
                  focusNode: _keyboardFocusNode,
                  controller: _hiddenInputController,
                  keyboardType: TextInputType.none,
                  showCursor: false,
                  enableInteractiveSelection: false,
                  autofocus: true,
                  decoration: const InputDecoration(
                    border: InputBorder.none,
                    contentPadding: EdgeInsets.zero,
                  ),
                ),
              ),
            ),
          ),
          Positioned.fill(
            child: isTablet
                ? Row(
                    children: [
                      Expanded(
                        flex: 5,
                        child: productSearchPane,
                      ),
                      const VerticalDivider(width: 1, thickness: 1),
                      Expanded(
                        flex: 4,
                        child: activeShoppingCartContainer,
                      ),
                    ],
                  )
                : _isPhoneCartVisible
                    ? Column(
                        children: [
                          Container(
                            color: Colors.white,
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                            child: SizedBox(
                              width: double.infinity,
                              child: OutlinedButton.icon(
                                icon: const Icon(Icons.search, color: AppColors.primary),
                                label: Text(settings.tr('Mag-search ng Produkto', 'Search Products')),
                                style: OutlinedButton.styleFrom(
                                  padding: const EdgeInsets.symmetric(vertical: 12),
                                  side: const BorderSide(color: AppColors.primary),
                                  foregroundColor: AppColors.primary,
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                ),
                                onPressed: () {
                                  setState(() {
                                    _isPhoneCartVisible = false;
                                  });
                                },
                              ),
                            ),
                          ),
                          const Divider(height: 1, thickness: 1.5, color: AppColors.surfaceBorder),
                          Expanded(
                            child: activeShoppingCartContainer,
                          ),
                        ],
                      )
                    : productSearchPane,
          ),
        ],
      ),
      floatingActionButton: (!isTablet && !_isPhoneCartVisible)
          ? FloatingActionButton.extended(
              onPressed: () {
                setState(() {
                  _isPhoneCartVisible = true;
                });
              },
              backgroundColor: AppColors.primary,
              icon: const Icon(Icons.shopping_cart_checkout_rounded, color: Colors.white),
              label: Text(
                '${settings.tr("Cart", "Cart")} - ${_cart.length}',
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
              ),
            )
          : null,
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
    );
  }
}
