import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../models/product.dart';
import '../models/stock_in.dart';
import '../providers/inventory_provider.dart';
import '../providers/settings_provider.dart';
import '../widgets/app_loading_overlay.dart';
import '../widgets/app_skeleton_loader.dart';
import '../widgets/app_empty_state.dart';
import '../widgets/app_drawer.dart';
import 'settings_screen.dart';
import '../utils/app_constants.dart';

class StockInScreen extends StatefulWidget {
  final Product? preSelectedProduct;
  final bool isTab;

  const StockInScreen({
    super.key,
    this.preSelectedProduct,
    this.isTab = false,
  });

  @override
  State<StockInScreen> createState() => _StockInScreenState();
}

class _StockInScreenState extends State<StockInScreen> {
  final _formKey = GlobalKey<FormState>();
  Product? _selectedProduct;
  final TextEditingController _quantityController = TextEditingController();
  final TextEditingController _supplierController = TextEditingController();
  DateTime _deliveryDate = DateTime.now();
  DateTime? _newExpiryDate;
  int _selectedHistoryYear = DateTime.now().year;
  int _selectedHistoryMonth = DateTime.now().month;
  final TextEditingController _historySearchController = TextEditingController();
  String _historySearchQuery = '';

  @override
  void initState() {
    super.initState();
    if (widget.preSelectedProduct != null) {
      _selectedProduct = widget.preSelectedProduct;
    }
  }

  @override
  void dispose() {
    _quantityController.dispose();
    _supplierController.dispose();
    _historySearchController.dispose();
    super.dispose();
  }

  Future<void> _selectDeliveryDate(BuildContext context) async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: _deliveryDate,
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

    if (picked != null && picked != _deliveryDate) {
      setState(() {
        _deliveryDate = picked;
      });
    }
  }

  void _submitRestock() async {
    final settings = Provider.of<SettingsProvider>(context, listen: false);
    if (!_formKey.currentState!.validate()) return;
    if (_selectedProduct == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(settings.tr('Pumili muna ng produkto na i-stock in!', 'Please select a product to stock in!')),
          backgroundColor: Colors.red,
        ),
      );
      return;
    }

    final stockIn = StockIn(
      productId: _selectedProduct!.id!,
      quantity: double.parse(_quantityController.text),
      supplierName: _supplierController.text.trim().isEmpty 
          ? settings.tr('Hindi Nakasaad (Unknown Supplier)', 'Unknown Supplier') 
          : _supplierController.text.trim(),
      deliveryDate: _deliveryDate,
    );

    await AppLoadingOverlay.runWithLoading(
      context: context,
      message: settings.tr('Nag-i-imback at nag-da-dagdag ng stock...', 'Updating stock inventory...'),
      asyncTask: () async {
        final provider = Provider.of<InventoryProvider>(context, listen: false);
        await provider.addStockIn(stockIn);
        
        // Update product's expiry date if it was changed during stock in
        if (_newExpiryDate != _selectedProduct!.expiryDate) {
          final updatedProduct = _selectedProduct!.copyWith(expiryDate: _newExpiryDate);
          await provider.updateProduct(updatedProduct);
        }
      },
    );

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(settings.tr(
            'Matagumpay na na-stock in ang ${stockIn.quantity} ${_selectedProduct!.unit} para sa ${_selectedProduct!.name}!',
            'Successfully stocked in ${stockIn.quantity} ${_selectedProduct!.unit} for ${_selectedProduct!.name}!',
          )),
          backgroundColor: AppColors.secondary,
        ),
      );

      _quantityController.clear();
      _supplierController.clear();
      setState(() {
        _deliveryDate = DateTime.now();
        if (widget.preSelectedProduct == null) {
          _selectedProduct = null;
          _newExpiryDate = null;
        }
      });
    }
  }

  void _showProductSearchModal(BuildContext context, List<Product> products, SettingsProvider settings) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return ProductSearchModal(
          products: products,
          settings: settings,
          onSelected: (product) {
            setState(() {
              _selectedProduct = product;
              _newExpiryDate = product.expiryDate;
            });
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final settings = Provider.of<SettingsProvider>(context);

    return Scaffold(
      drawer: const AppDrawer(),
      appBar: AppBar(
        title: Text(
          settings.tr('Stock In (Restock)', 'Stock In (Restock)'),
          style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
        ),
        backgroundColor: AppColors.primary,
        elevation: 0,
        leading: (!widget.isTab && Navigator.canPop(context)) 
            ? IconButton(
                icon: const Icon(Icons.arrow_back, color: Colors.white),
                onPressed: () => Navigator.pop(context),
              )
            : null,
        actions: [
          IconButton(
            icon: const Icon(Icons.settings, color: Colors.white),
            tooltip: settings.tr('Mga Setting', 'Settings'),
            onPressed: () => SettingsScreen.navigate(context),
          ),
        ],
      ),
      body: Consumer<InventoryProvider>(
        builder: (context, provider, child) {
          if (provider.isLoading) {
            return AppSkeletonLoader.list(itemCount: 5);
          }

          final productsList = provider.products;

          // Filter Stock In history based on specific Month, Year, and Search query
          final filteredStockIns = provider.stockIns.where((s) {
            final matchesYear = s.deliveryDate.year == _selectedHistoryYear;
            final matchesMonth = _selectedHistoryMonth == 0 || s.deliveryDate.month == _selectedHistoryMonth;
            if (!matchesYear || !matchesMonth) return false;

            if (_historySearchQuery.isEmpty) return true;
            final productName = (s.productName ?? '').toLowerCase();
            final supplierName = s.supplierName.toLowerCase();
            final query = _historySearchQuery.toLowerCase();
            return productName.contains(query) || supplierName.contains(query);
          }).toList();

          // If products list is empty, user must create a product first.
          if (productsList.isEmpty) {
            return AppEmptyState(
              icon: Icons.add_business_rounded,
              title: settings.tr('Walang produkto sa system', 'No products in system'),
              description: settings.tr(
                'Gumawa muna ng produkto sa "Produkto" tab bago mag-record ng delivery mula sa supplier.',
                'Create a product in the "Products" tab first before recording deliveries.',
              ),
            );
          }

          // Safe check and instance matching for selection
          if (_selectedProduct != null) {
            final index = productsList.indexWhere((p) => p.id == _selectedProduct!.id);
            if (index != -1) {
              _selectedProduct = productsList[index];
            } else {
              _selectedProduct = null;
            }
          }

          final isTablet = MediaQuery.of(context).size.width >= 768;

          Widget formWidget = Card(
            margin: const EdgeInsets.all(16),
            elevation: 3,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      settings.tr('I-record ang Bagong Delivery', 'Record New Delivery'),
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: AppColors.primary,
                      ),
                    ),
                    const SizedBox(height: 12),

                    // Product Selector Trigger Field (Searchable Modal Picker)
                    FormField<Product>(
                      initialValue: _selectedProduct,
                      validator: (value) => _selectedProduct == null 
                          ? settings.tr('Pumili ng produkto', 'Select a product') 
                          : null,
                      builder: (FormFieldState<Product> state) {
                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            InkWell(
                              onTap: () {
                                _showProductSearchModal(context, productsList, settings);
                              },
                              borderRadius: BorderRadius.circular(10),
                              child: InputDecorator(
                                decoration: InputDecoration(
                                  labelText: settings.tr('Pumili ng Produkto *', 'Select Product *'),
                                  border: const OutlineInputBorder(),
                                  prefixIcon: const Icon(Icons.shopping_bag_outlined, color: AppColors.secondary),
                                  errorText: state.hasError ? state.errorText : null,
                                  suffixIcon: const Icon(Icons.arrow_drop_down, color: Colors.grey),
                                ),
                                child: Text(
                                  _selectedProduct == null
                                      ? settings.tr('I-tap upang maghanap...', 'Tap to search...')
                                      : '${_selectedProduct!.name} (${_selectedProduct!.currentStock} ${_selectedProduct!.unit} ${settings.tr("kasalukuyan", "current")})',
                                  style: TextStyle(
                                    fontSize: 14,
                                    color: _selectedProduct == null ? Colors.grey[600] : Colors.black87,
                                    fontWeight: _selectedProduct == null ? FontWeight.normal : FontWeight.bold,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        );
                      },
                    ),
                    const SizedBox(height: 12),

                    Row(
                      children: [
                        // Quantity
                        Expanded(
                          child: TextFormField(
                            controller: _quantityController,
                            keyboardType: const TextInputType.numberWithOptions(decimal: true),
                            decoration: InputDecoration(
                              labelText: settings.tr('Dami (Quantity) *', 'Quantity *'),
                              border: const OutlineInputBorder(),
                              suffixText: _selectedProduct?.unit ?? '',
                              prefixIcon: const Icon(Icons.add_circle_outline, color: AppColors.secondary),
                            ),
                            validator: (value) {
                              if (value == null || value.isEmpty) {
                                return settings.tr('Ilagay ang dami', 'Enter quantity');
                              }
                              if (double.tryParse(value) == null) {
                                return settings.tr('Dapat ay numero', 'Must be a number');
                              }
                              if (double.parse(value) <= 0) {
                                return settings.tr('Dapat higit sa 0', 'Must be greater than 0');
                              }
                              return null;
                            },
                          ),
                        ),
                        const SizedBox(width: 12),

                        // Date Picker Button
                        Expanded(
                          child: InkWell(
                            onTap: () => _selectDeliveryDate(context),
                            borderRadius: BorderRadius.circular(8),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 15),
                              decoration: BoxDecoration(
                                border: Border.all(color: Colors.grey.shade400),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  const Icon(Icons.calendar_today, size: 18, color: AppColors.secondary),
                                  const SizedBox(width: 4),
                                  Expanded(
                                    child: Text(
                                      DateFormat('MM/dd/yyyy').format(_deliveryDate),
                                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),

                    // Supplier Name
                    TextFormField(
                      controller: _supplierController,
                      decoration: InputDecoration(
                        labelText: settings.tr('Supplier Name (Opsyonal)', 'Supplier Name (Optional)'),
                        hintText: settings.tr('Hal: Coca-Cola Distributor, Nestlé', 'e.g. Coca-Cola Distributor, Nestlé'),
                        border: const OutlineInputBorder(),
                        prefixIcon: const Icon(Icons.local_shipping_outlined, color: AppColors.secondary),
                      ),
                    ),
                    const SizedBox(height: 12),

                    // Expiry Date (if enabled in settings)
                    if (settings.showExpiryDate) ...[
                      Row(
                        children: [
                          Expanded(
                            child: InkWell(
                              onTap: () async {
                                final DateTime? picked = await showDatePicker(
                                  context: context,
                                  initialDate: _newExpiryDate ?? DateTime.now(),
                                  firstDate: DateTime.now().subtract(const Duration(days: 365)),
                                  lastDate: DateTime.now().add(const Duration(days: 3650)),
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
                                  setState(() => _newExpiryDate = picked);
                                }
                              },
                              borderRadius: BorderRadius.circular(8),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 15),
                                decoration: BoxDecoration(
                                  border: Border.all(color: Colors.grey.shade400),
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    const Icon(Icons.event_busy, size: 18, color: Colors.orange),
                                    const SizedBox(width: 4),
                                    Expanded(
                                      child: Text(
                                        _newExpiryDate == null 
                                          ? settings.tr('Walang Expiry', 'No Expiry Set')
                                          : '${settings.tr("Bagong Expiry:", "New Expiry:")} ${DateFormat('MM/dd/yyyy').format(_newExpiryDate!)}',
                                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                          if (_newExpiryDate != null)
                            IconButton(
                              icon: const Icon(Icons.clear, color: Colors.red),
                              onPressed: () => setState(() => _newExpiryDate = null),
                              tooltip: settings.tr('Alisin ang Expiry', 'Clear Expiry'),
                            ),
                        ],
                      ),
                      const SizedBox(height: 16),
                    ],

                    ElevatedButton.icon(
                      onPressed: _submitRestock,
                      icon: const Icon(Icons.check_circle_outline),
                      label: Text(
                        settings.tr('I-record ang Stock In', 'Record Stock In'),
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.secondary,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );

          final recentDeliveriesHeader = Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  settings.tr('Kasaysayan ng Stock In (Recent Deliveries)', 'Stock In History (Recent Deliveries)'),
                  style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: Colors.black87,
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    // Month Dropdown
                    Expanded(
                      flex: 3,
                      child: DropdownButtonFormField<int>(
                        value: _selectedHistoryMonth,
                        isExpanded: true,
                        decoration: InputDecoration(
                          labelText: settings.tr('Buwan', 'Month'),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                          border: const OutlineInputBorder(),
                        ),
                        items: [
                          DropdownMenuItem<int>(
                            value: 0, 
                            child: Text(
                              settings.tr('Lahat ng Buwan', 'All Months'),
                              style: const TextStyle(fontSize: 12),
                            ),
                          ),
                          ...List.generate(12, (index) {
                            final monthNum = index + 1;
                            final monthTagalog = [
                              'Enero', 'Pebrero', 'Marso', 'Abril', 'Mayo', 'Hunyo',
                              'Hulyo', 'Agosto', 'Setyembre', 'Oktubre', 'Nobyembre', 'Disyembre'
                            ][index];
                            final monthEnglish = [
                              'January', 'February', 'March', 'April', 'May', 'June',
                              'July', 'August', 'September', 'October', 'November', 'December'
                            ][index];
                            return DropdownMenuItem<int>(
                              value: monthNum,
                              child: Text(
                                settings.tr(monthTagalog, monthEnglish),
                                style: const TextStyle(fontSize: 12),
                              ),
                            );
                          }),
                        ],
                        onChanged: (val) {
                          if (val != null) {
                            setState(() {
                              _selectedHistoryMonth = val;
                            });
                          }
                        },
                      ),
                    ),
                    const SizedBox(width: 8),
                    // Year Dropdown
                    Expanded(
                      flex: 2,
                      child: DropdownButtonFormField<int>(
                        value: _selectedHistoryYear,
                        isExpanded: true,
                        decoration: InputDecoration(
                          labelText: settings.tr('Taon', 'Year'),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                          border: const OutlineInputBorder(),
                        ),
                        items: List.generate(5, (index) {
                          final yearNum = DateTime.now().year - index;
                          return DropdownMenuItem<int>(
                            value: yearNum,
                            child: Text(
                              '$yearNum',
                              style: const TextStyle(fontSize: 12),
                            ),
                          );
                        }),
                        onChanged: (val) {
                          if (val != null) {
                            setState(() {
                              _selectedHistoryYear = val;
                            });
                          }
                        },
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                // Search Bar
                TextField(
                  controller: _historySearchController,
                  decoration: InputDecoration(
                    hintText: settings.tr('Maghanap ng produkto o supplier...', 'Search product or supplier...'),
                    prefixIcon: const Icon(Icons.search, size: 20),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    border: const OutlineInputBorder(),
                    suffixIcon: _historySearchQuery.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.clear_rounded, color: Colors.grey, size: 20),
                            onPressed: () {
                              setState(() {
                                _historySearchQuery = '';
                                _historySearchController.clear();
                              });
                            },
                          )
                        : null,
                  ),
                  onChanged: (val) {
                    setState(() {
                      _historySearchQuery = val;
                    });
                  },
                ),
              ],
            ),
          );

          if (isTablet) {
            return Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                SizedBox(
                  width: 420,
                  child: SingleChildScrollView(
                    child: formWidget,
                  ),
                ),
                const VerticalDivider(width: 1, thickness: 1),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      recentDeliveriesHeader,
                      Expanded(
                        child: _buildRecentDeliveriesList(filteredStockIns, isShrinkWrap: false),
                      ),
                    ],
                  ),
                ),
              ],
            );
          }

          // Mobile responsive layout wrapped in SingleChildScrollView to prevent keyboard overflow
          return SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                formWidget,
                recentDeliveriesHeader,
                _buildRecentDeliveriesList(filteredStockIns, isShrinkWrap: true),
              ],
            ),
          );
        },
      ),
    );
  }

  // Helper method to build the recent deliveries list with shrink-wrap options
  Widget _buildRecentDeliveriesList(List<StockIn> stockIns, {required bool isShrinkWrap}) {
    final settings = Provider.of<SettingsProvider>(context, listen: false);

    if (stockIns.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 32.0),
        child: Center(
          child: Text(
            settings.tr('Walang naitalang delivery kamakailan.', 'No recent delivery records.'),
            style: TextStyle(color: Colors.grey[500]),
          ),
        ),
      );
    }

    return ListView.builder(
      shrinkWrap: isShrinkWrap,
      physics: isShrinkWrap ? const NeverScrollableScrollPhysics() : const BouncingScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      itemCount: stockIns.length,
      itemBuilder: (context, index) {
        final log = stockIns[index];
        final formattedDate = DateFormat('MMM dd, yyyy - hh:mm a').format(log.deliveryDate);

        return Card(
          elevation: 1,
          margin: const EdgeInsets.symmetric(vertical: 4),
          color: const Color(0xFFF9FBF9),
          child: ListTile(
            leading: Container(
              padding: const EdgeInsets.all(8),
              decoration: const BoxDecoration(
                color: AppColors.surfaceLight,
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.trending_up, color: AppColors.secondary),
            ),
            title: Text(
              log.productName ?? settings.tr('Hindi Kilalang Produkto', 'Unknown Product'),
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
            subtitle: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(settings.tr('Mula kay: ${log.supplierName}', 'From: ${log.supplierName}')),
                Text(
                  formattedDate,
                  style: TextStyle(fontSize: 11, color: Colors.grey[600]),
                ),
              ],
            ),
            trailing: Text(
              '+${log.quantity}',
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: AppColors.secondary,
              ),
            ),
          ),
        );
      },
    );
  }
}

class ProductSearchModal extends StatefulWidget {
  final List<Product> products;
  final SettingsProvider settings;
  final ValueChanged<Product> onSelected;

  const ProductSearchModal({
    super.key,
    required this.products,
    required this.settings,
    required this.onSelected,
  });

  @override
  State<ProductSearchModal> createState() => _ProductSearchModalState();
}

class _ProductSearchModalState extends State<ProductSearchModal> {
  String _searchQuery = '';
  final TextEditingController _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final filtered = widget.products.where((p) {
      final matchesName = p.name.toLowerCase().contains(_searchQuery.toLowerCase());
      final matchesBarcode = p.barcode != null && p.barcode!.contains(_searchQuery);
      return matchesName || matchesBarcode;
    }).toList();

    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: Container(
        height: MediaQuery.of(context).size.height * 0.7,
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            // Bottom sheet drag indicator handle
            Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.only(bottom: 12),
              decoration: BoxDecoration(
                color: Colors.grey[300],
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            Text(
              widget.settings.tr('Maghanap ng Produkto', 'Search Product'),
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _searchController,
              autofocus: true,
              decoration: InputDecoration(
                hintText: widget.settings.tr('I-type ang pangalan o i-scan...', 'Type name or scan barcode...'),
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _searchQuery.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear_rounded, color: Colors.grey, size: 20),
                        onPressed: () {
                          setState(() {
                            _searchQuery = '';
                            _searchController.clear();
                          });
                        },
                      )
                    : null,
                border: const OutlineInputBorder(),
              ),
              onChanged: (val) {
                setState(() {
                  _searchQuery = val;
                });
              },
            ),
            const SizedBox(height: 12),
            Expanded(
              child: filtered.isEmpty
                  ? Center(
                      child: Text(
                        widget.settings.tr('Walang nahanap na produkto.', 'No products found.'),
                        style: TextStyle(color: Colors.grey[500]),
                      ),
                    )
                  : ListView.separated(
                      itemCount: filtered.length,
                      separatorBuilder: (_, __) => const Divider(height: 1),
                      itemBuilder: (context, index) {
                        final prod = filtered[index];
                        return ListTile(
                          title: Text(prod.name, style: const TextStyle(fontWeight: FontWeight.bold)),
                          subtitle: Text(
                            '${widget.settings.tr("Stock", "Stock")}: ${prod.currentStock} ${prod.unit}',
                          ),
                          trailing: const Icon(Icons.add_business_rounded, color: AppColors.secondary),
                          onTap: () {
                            widget.onSelected(prod);
                            Navigator.pop(context);
                          },
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
