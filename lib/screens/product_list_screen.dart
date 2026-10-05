import 'dart:io';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../providers/inventory_provider.dart';
import '../providers/settings_provider.dart';
import '../providers/product_filter_provider.dart';
import '../utils/app_constants.dart';
import '../utils/currency_formatter.dart';
import '../models/product.dart';
import '../widgets/app_skeleton_loader.dart';
import '../widgets/app_empty_state.dart';
import 'add_edit_product_screen.dart';
import 'stock_in_screen.dart';
import 'settings_screen.dart';
import 'pin_lock_screen.dart';
import '../widgets/app_drawer.dart';

class ProductListScreen extends StatefulWidget {
  const ProductListScreen({super.key});

  @override
  State<ProductListScreen> createState() => _ProductListScreenState();
}

class _ProductListScreenState extends State<ProductListScreen> {
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        final query = Provider.of<ProductFilterProvider>(context, listen: false).searchQuery;
        if (query.isNotEmpty) {
          _searchController.text = query;
        }
      }
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _navigateToAddEdit(BuildContext context, Product? product) {
    final settings = Provider.of<SettingsProvider>(context, listen: false);
    
    void goToScreen() {
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (context) => AddEditProductScreen(product: product),
        ),
      );
    }

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
            MaterialPageRoute(
              builder: (context) => AddEditProductScreen(product: product),
            ),
          );
        }
      });
    } else {
      goToScreen();
    }
  }

  // Helper to format currency
  String _formatCurrency(double amount, String currencySymbol) {
    return CurrencyFormatter.format(amount, currencySymbol);
  }


  @override
  Widget build(BuildContext context) {
    final settings = Provider.of<SettingsProvider>(context);
    final List<String> categories = ['All', ...settings.productCategories];

    return Scaffold(
      drawer: const AppDrawer(),
      appBar: AppBar(
        title: Text(
          settings.tr('Mga Produkto (Inventory)', 'Products (Inventory)'),
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
      body: Column(
        children: [
          // Search Bar
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: Consumer<ProductFilterProvider>(
              builder: (context, filterProvider, child) {
                return TextField(
                  controller: _searchController,
                  onChanged: (value) {
                    filterProvider.setSearchQuery(value);
                  },
                  decoration: InputDecoration(
                    hintText: settings.tr('Maghanap ng produkto...', 'Search product...'),
                    prefixIcon: const Icon(Icons.search, color: AppColors.secondary),
                    suffixIcon: filterProvider.searchQuery.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.clear_rounded, color: Colors.grey, size: 20),
                            onPressed: () {
                              _searchController.clear();
                              filterProvider.setSearchQuery('');
                            },
                          )
                        : null,
                    filled: true,
                    fillColor: AppColors.searchFill,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide.none,
                    ),
                    contentPadding: const EdgeInsets.symmetric(vertical: 0),
                  ),
                );
              },
            ),
          ),

          // Horizontal Category Filters
          SizedBox(
            height: 48,
            child: Consumer<ProductFilterProvider>(
              builder: (context, filterProvider, child) {
                return ListView.builder(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  itemCount: categories.length,
                  itemBuilder: (context, index) {
                    final cat = categories[index];
                    final isSelected = filterProvider.selectedCategory == cat;
                    return Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 4),
                      child: ChoiceChip(
                        label: Text(cat == 'All' ? settings.tr('Lahat', 'All') : cat),
                        selected: isSelected,
                        onSelected: (selected) {
                          if (selected) {
                            filterProvider.setSelectedCategory(cat);
                          }
                        },
                        selectedColor: AppColors.secondary,
                        backgroundColor: AppColors.surfaceLight,
                        labelStyle: TextStyle(
                          color: isSelected ? Colors.white : AppColors.secondary,
                          fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(20),
                          side: BorderSide(
                            color: isSelected ? Colors.transparent : AppColors.surfaceBorder,
                          ),
                        ),
                        showCheckmark: false,
                      ),
                    );
                  },
                );
              },
            ),
          ),

          // Status Filter Chips
          Consumer2<ProductFilterProvider, SettingsProvider>(
            builder: (context, filterProvider, settings, child) {
              if (!settings.showExpiryDate && filterProvider.showOnlyNearExpiration) {
                WidgetsBinding.instance.addPostFrameCallback((_) {
                  filterProvider.setShowOnlyNearExpiration(false);
                });
              }
              return Padding(
                padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
                child: Row(
                  children: [
                    FilterChip(
                      avatar: Icon(
                        Icons.warning_amber_rounded,
                        color: filterProvider.showOnlyLowStock ? Colors.white : Colors.red.shade800,
                        size: 16,
                      ),
                      label: Text(settings.tr('Paubos na Stock', 'Low Stock')),
                      selected: filterProvider.showOnlyLowStock,
                      onSelected: (selected) {
                        filterProvider.setShowOnlyLowStock(selected);
                      },
                      selectedColor: Colors.red.shade600,
                      backgroundColor: Colors.red.shade50,
                      checkmarkColor: Colors.white,
                      labelStyle: TextStyle(
                        color: filterProvider.showOnlyLowStock ? Colors.white : Colors.red.shade900,
                        fontWeight: FontWeight.bold,
                        fontSize: 12,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(20),
                        side: BorderSide(
                          color: filterProvider.showOnlyLowStock ? Colors.transparent : Colors.red.shade200,
                        ),
                      ),
                      showCheckmark: false,
                    ),
                    if (settings.showExpiryDate) ...[
                      const SizedBox(width: 8),
                      FilterChip(
                        avatar: Icon(
                          Icons.event_busy_rounded,
                          color: filterProvider.showOnlyNearExpiration ? Colors.white : Colors.orange.shade800,
                          size: 16,
                        ),
                        label: Text(settings.tr('Malapit na Ma-expire', 'Near Expiration')),
                        selected: filterProvider.showOnlyNearExpiration,
                        onSelected: (selected) {
                          filterProvider.setShowOnlyNearExpiration(selected);
                        },
                        selectedColor: Colors.orange.shade700,
                        backgroundColor: Colors.orange.shade50,
                        checkmarkColor: Colors.white,
                        labelStyle: TextStyle(
                          color: filterProvider.showOnlyNearExpiration ? Colors.white : Colors.orange.shade900,
                          fontWeight: FontWeight.bold,
                          fontSize: 12,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(20),
                          side: BorderSide(
                            color: filterProvider.showOnlyNearExpiration ? Colors.transparent : Colors.orange.shade200,
                          ),
                        ),
                        showCheckmark: false,
                      ),
                    ],
                  ],
                ),
              );
            },
          ),

          // Products List
          Expanded(
            child: Consumer2<InventoryProvider, ProductFilterProvider>(
              builder: (context, provider, filterProvider, child) {
                if (provider.isLoading) {
                  return AppSkeletonLoader.list(itemCount: 6);
                }

                final productList = filterProvider.applyFilters(provider.products);

                if (productList.isEmpty) {
                  return AppEmptyState(
                    icon: Icons.inventory_2_outlined,
                    title: filterProvider.searchQuery.isEmpty
                        ? settings.tr('Walang produkto sa listahan', 'No products in list')
                        : settings.tr('Walang nahanap na produkto', 'No products found'),
                    description: filterProvider.searchQuery.isEmpty
                        ? settings.tr('Magdagdag ng iyong mga paninda upang simulan ang pag-track ng stock at benta.', 'Add your products to start tracking inventory and sales.')
                        : settings.tr('Walang nahanap na produktong tumutugma sa "${filterProvider.searchQuery}".', 'No product found matching "${filterProvider.searchQuery}".'),
                    actionLabel: filterProvider.searchQuery.isEmpty ? settings.tr('Magdagdag ng Produkto', 'Add Product') : null,
                    onAction: filterProvider.searchQuery.isEmpty ? () => _navigateToAddEdit(context, null) : null,
                  );
                }

                final isTablet = MediaQuery.of(context).size.width >= 768;

                Widget buildProductCard(Product product) {
                  final isLow = product.isLowStock;
                  final settings = Provider.of<SettingsProvider>(context, listen: false);
                  final showExpiry = settings.showExpiryDate;
                  final isExpired = showExpiry && product.isExpired;
                  final isExpiringSoon = showExpiry && product.isExpiringSoon;

                  // Define styling based on status priority: Expired > Expiring Soon > Low Stock > Normal
                  Color cardBgColor = Colors.white;
                  Color borderColor = Colors.grey.shade200;
                  IconData statusIcon = Icons.shopping_bag_outlined;
                  Color statusIconColor = AppColors.secondary;
                  Color statusIconBgColor = AppColors.surfaceLight;

                  if (isExpired) {
                    cardBgColor = const Color(0xFFFFEBEE); // Soft red
                    borderColor = Colors.red.shade300;     // Stronger red border
                    statusIcon = Icons.event_busy_rounded;
                    statusIconColor = Colors.red.shade900;
                    statusIconBgColor = Colors.red.shade100;
                  } else if (isExpiringSoon) {
                    cardBgColor = const Color(0xFFFFF3E0); // Soft orange
                    borderColor = Colors.orange.shade300;  // Orange border
                    statusIcon = Icons.event_note_rounded;
                    statusIconColor = Colors.orange.shade900;
                    statusIconBgColor = Colors.orange.shade100;
                  } else if (isLow) {
                    cardBgColor = const Color(0xFFFFEBEE); // Soft red
                    borderColor = Colors.red.shade200;     // Red border
                    statusIcon = Icons.warning_amber_rounded;
                    statusIconColor = Colors.red.shade800;
                    statusIconBgColor = Colors.red.shade100;
                  }

                  return Card(
                    elevation: 1,
                    margin: isTablet ? EdgeInsets.zero : const EdgeInsets.symmetric(vertical: 6),
                    color: cardBgColor,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                      side: BorderSide(
                        color: borderColor,
                        width: isExpired ? 1.5 : 1,
                      ),
                    ),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(12),
                      onTap: () => _showProductActions(context, product),
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.center,
                          children: [
                            // Left Icon Indicator or Product Image
                            Container(
                              width: 48,
                              height: 48,
                              decoration: BoxDecoration(
                                color: statusIconBgColor,
                                borderRadius: BorderRadius.circular(10),
                              ),
                              child: product.imagePath != null && File(product.imagePath!).existsSync()
                                  ? ClipRRect(
                                      borderRadius: BorderRadius.circular(10),
                                      child: Image.file(
                                        File(product.imagePath!),
                                        fit: BoxFit.cover,
                                        width: 48,
                                        height: 48,
                                      ),
                                    )
                                  : Icon(
                                      statusIcon,
                                      color: statusIconColor,
                                    ),
                            ),
                            const SizedBox(width: 12),

                            // Product Info
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    product.name,
                                    style: TextStyle(
                                      fontSize: 16,
                                      fontWeight: FontWeight.bold,
                                      color: isExpired 
                                          ? Colors.red.shade900 
                                          : (isExpiringSoon 
                                              ? Colors.orange.shade900 
                                              : (isLow ? Colors.red.shade900 : Colors.black87)),
                                    ),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                  const SizedBox(height: 4),
                                  Wrap(
                                    spacing: 6,
                                    runSpacing: 4,
                                    crossAxisAlignment: WrapCrossAlignment.center,
                                    children: [
                                      Container(
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 6,
                                          vertical: 2,
                                        ),
                                        decoration: BoxDecoration(
                                          color: Colors.grey[200],
                                          borderRadius: BorderRadius.circular(4),
                                        ),
                                        child: Text(
                                          product.category,
                                          style: TextStyle(
                                            fontSize: 11,
                                            color: Colors.grey[800],
                                          ),
                                        ),
                                      ),
                                      Text(
                                        'Unit: ${product.unit}',
                                        style: TextStyle(
                                          fontSize: 12,
                                          color: Colors.grey[600],
                                        ),
                                      ),
                                      if (product.barcode != null && product.barcode!.isNotEmpty) ...[
                                        Container(
                                          padding: const EdgeInsets.symmetric(
                                            horizontal: 6,
                                            vertical: 2,
                                          ),
                                          decoration: BoxDecoration(
                                            color: AppColors.surfaceLight,
                                            borderRadius: BorderRadius.circular(4),
                                            border: Border.all(color: const Color(0xFFA5D6A7)),
                                          ),
                                          child: Row(
                                            mainAxisSize: MainAxisSize.min,
                                            children: [
                                              const Icon(Icons.qr_code_scanner_outlined, size: 12, color: AppColors.primary),
                                              const SizedBox(width: 4),
                                              Text(
                                                product.barcode!,
                                                style: const TextStyle(
                                                  fontSize: 10,
                                                  fontWeight: FontWeight.bold,
                                                  color: AppColors.primary,
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ],
                                      if (showExpiry && product.expiryDate != null) ...[
                                        Container(
                                          padding: const EdgeInsets.symmetric(
                                            horizontal: 6,
                                            vertical: 2,
                                          ),
                                          decoration: BoxDecoration(
                                            color: isExpired
                                                ? Colors.red.shade100
                                                : (isExpiringSoon
                                                    ? Colors.orange.shade100
                                                    : Colors.grey.shade100),
                                            borderRadius: BorderRadius.circular(4),
                                            border: Border.all(
                                              color: isExpired
                                                  ? Colors.red.shade300
                                                  : (isExpiringSoon
                                                      ? Colors.orange.shade300
                                                      : Colors.grey.shade300),
                                            ),
                                          ),
                                          child: Row(
                                            mainAxisSize: MainAxisSize.min,
                                            children: [
                                              Icon(
                                                isExpired
                                                    ? Icons.event_busy_rounded
                                                    : (isExpiringSoon
                                                        ? Icons.event_note_rounded
                                                        : Icons.event_available_rounded),
                                                size: 12,
                                                color: isExpired
                                                    ? Colors.red.shade900
                                                    : (isExpiringSoon
                                                        ? Colors.orange.shade900
                                                        : Colors.grey.shade700),
                                              ),
                                              const SizedBox(width: 4),
                                              Text(
                                                isExpired
                                                    ? 'Expired: ${DateFormat('MM/dd/yyyy').format(product.expiryDate!)}'
                                                    : (isExpiringSoon
                                                        ? 'Expiring: ${DateFormat('MM/dd/yyyy').format(product.expiryDate!)}'
                                                        : 'Expires: ${DateFormat('MM/dd/yyyy').format(product.expiryDate!)}'),
                                                style: TextStyle(
                                                  fontSize: 10,
                                                  fontWeight: FontWeight.bold,
                                                  color: isExpired
                                                      ? Colors.red.shade900
                                                      : (isExpiringSoon
                                                          ? Colors.orange.shade900
                                                          : Colors.grey.shade700),
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ],
                                    ],
                                  ),
                                  const SizedBox(height: 6),
                                  Wrap(
                                    spacing: 12,
                                    runSpacing: 4,
                                    crossAxisAlignment: WrapCrossAlignment.center,
                                    children: [
                                      Text(
                                        'Benta: ${_formatCurrency(product.sellingPrice, settings.currencySymbol)}',
                                        style: const TextStyle(
                                          fontSize: 13,
                                          fontWeight: FontWeight.w600,
                                          color: AppColors.primary,
                                        ),
                                      ),
                                      Text(
                                        'Puhunan: ${_formatCurrency(product.buyingPrice, settings.currencySymbol)}',
                                        style: TextStyle(
                                          fontSize: 12,
                                          color: Colors.grey[600],
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),

                            // Stock quantity right aligned
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text(
                                  '${product.currentStock % 1 == 0 ? product.currentStock.toInt() : product.currentStock} ${product.unit}',
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                    color: isExpired
                                        ? Colors.red.shade900
                                        : (isExpiringSoon
                                            ? Colors.orange.shade900
                                            : (isLow ? Colors.red.shade800 : Colors.black87)),
                                  ),
                                ),
                                const SizedBox(height: 4),
                                if (isExpired)
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 6,
                                      vertical: 2,
                                    ),
                                    decoration: BoxDecoration(
                                      color: Colors.red.shade800,
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                    child: const Text(
                                      'Expired',
                                      style: TextStyle(
                                        color: Colors.white,
                                        fontSize: 10,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  )
                                else if (isExpiringSoon)
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 6,
                                      vertical: 2,
                                    ),
                                    decoration: BoxDecoration(
                                      color: Colors.orange.shade800,
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                    child: const Text(
                                      'Malapit na',
                                      style: TextStyle(
                                        color: Colors.white,
                                        fontSize: 10,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  )
                                else if (isLow)
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 6,
                                      vertical: 2,
                                    ),
                                    decoration: BoxDecoration(
                                      color: Colors.red.shade800,
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                    child: const Text(
                                      'Low Stock',
                                      style: TextStyle(
                                        color: Colors.white,
                                        fontSize: 10,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  )
                                else
                                  Text(
                                    'Stock ok',
                                    style: TextStyle(
                                      fontSize: 11,
                                      color: Colors.green[800],
                                    ),
                                  ),
                              ],
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                }

                if (isTablet) {
                  return GridView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                      maxCrossAxisExtent: 450,
                      mainAxisExtent: 130,
                      crossAxisSpacing: 12,
                      mainAxisSpacing: 12,
                    ),
                    itemCount: productList.length,
                    itemBuilder: (context, index) {
                      return buildProductCard(productList[index]);
                    },
                  );
                }

                return ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  itemCount: productList.length,
                  itemBuilder: (context, index) {
                    return buildProductCard(productList[index]);
                  },
                );
              },
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _navigateToAddEdit(context, null),
        backgroundColor: AppColors.secondary,
        foregroundColor: Colors.white,
        tooltip: settings.tr('Magdagdag ng Produkto', 'Add Product'),
        child: const Icon(Icons.add),
      ),
    );
  }

  // Bottom action sheet for product options
  void _showProductActions(BuildContext context, Product product) {
    final settings = Provider.of<SettingsProvider>(context, listen: false);

    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (context) {
        return SafeArea(
          child: Wrap(
            children: [
              // Header
              ListTile(
                title: Text(
                  product.name,
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
                ),
                subtitle: Text(
                  settings.tr(
                    'Kategorya: ${product.category} | Stock: ${product.currentStock} ${product.unit}',
                    'Category: ${product.category} | Stock: ${product.currentStock} ${product.unit}',
                  ),
                ),
                trailing: IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.pop(context),
                ),
              ),
              const Divider(),

              // Edit Product Option
              ListTile(
                leading: const Icon(Icons.edit_rounded, color: Colors.blue),
                title: Text(settings.tr('I-edit ang Produkto', 'Edit Product Details')),
                onTap: () {
                  Navigator.pop(context); // Close bottom sheet
                  _navigateToAddEdit(context, product);
                },
              ),

              // Stock In Option
              ListTile(
                leading: const Icon(Icons.add_business_rounded, color: AppColors.secondary),
                title: Text(settings.tr('Mag-Stock In (Restock)', 'Stock In (Restock)')),
                onTap: () {
                  Navigator.pop(context); // Close bottom sheet
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (context) => StockInScreen(preSelectedProduct: product),
                    ),
                  );
                },
              ),

              // Unpack / Tingi Splitter option
              ListTile(
                leading: const Icon(Icons.call_split_rounded, color: Colors.orange),
                title: Text(settings.tr('I-unpack para sa Tingi (Split Stock)', 'Unpack Bulk to Retail (Split Stock)')),
                onTap: () {
                  Navigator.pop(context); // Close bottom sheet
                  _showUnpackDialog(context, product);
                },
              ),

              // Delete Option
              ListTile(
                leading: const Icon(Icons.delete_forever_rounded, color: Colors.red),
                title: Text(settings.tr('Burahin ang Produkto', 'Delete Product')),
                onTap: () {
                  Navigator.pop(context); // Close bottom sheet
                  _showDeleteConfirmation(context, product);
                },
              ),

              const SizedBox(height: 12),
            ],
          ),
        );
      },
    );
  }

  // Delete Confirmation Dialog
  void _showDeleteConfirmation(BuildContext context, Product product) {
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text.rich(
            TextSpan(
              children: [
                WidgetSpan(
                  alignment: PlaceholderAlignment.middle,
                  child: Icon(Icons.warning_amber_rounded, color: Colors.red),
                ),
                WidgetSpan(child: SizedBox(width: 8)),
                TextSpan(text: 'Burahin ang Produkto?'),
              ],
            ),
          ),
          content: Text(
            'Sigurado ka bang gusto mong burahin ang "${product.name}"?\n\n'
            'Babala: Kasama nitong mabubura ang lahat ng kasaysayan ng restock (Stock In) at benta (Sales) para sa produktong ito.'
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('I-cancel'),
            ),
            ElevatedButton(
              onPressed: () async {
                final provider = Provider.of<InventoryProvider>(context, listen: false);
                await provider.deleteProduct(product.id!);
                
                if (context.mounted) {
                  Navigator.pop(context); // Close dialog
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Matagumpay na nabura ang "${product.name}"!'),
                      backgroundColor: Colors.red[800],
                    ),
                  );
                }
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.red[800],
                foregroundColor: Colors.white,
              ),
              child: const Text('Oo, Burahin'),
            ),
          ],
        );
      },
    );
  }

  // Split / Unpack Dialog
  void _showUnpackDialog(BuildContext context, Product parentProduct) {
    final provider = Provider.of<InventoryProvider>(context, listen: false);
    
    // Find potential child products (items that are pieces 'pcs' or single pack items)
    final childCandidates = provider.products.where((p) => p.id != parentProduct.id).toList();

    if (childCandidates.isEmpty) {
      showDialog(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('Walang Child Product'),
          content: const Text(
            'Kailangan mong magkaroon ng isa pang produkto na magsisilbing tingi (hal. "Coke Single pcs") bago mag-unpack ng bulk stock (hal. "Coke Case").'
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('OK'),
            ),
          ],
        ),
      );
      return;
    }

    Product? selectedChild;
    final parentQtyController = TextEditingController(text: '1');
    final childMultiplierController = TextEditingController();

    showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            // Calculate real-time estimated yield if possible
            double parentQty = double.tryParse(parentQtyController.text) ?? 0;
            double childMultiplier = double.tryParse(childMultiplierController.text) ?? 0;
            double totalYield = parentQty * childMultiplier;

            return AlertDialog(
              title: const Text.rich(
                TextSpan(
                  children: [
                    WidgetSpan(
                      alignment: PlaceholderAlignment.middle,
                      child: Icon(Icons.call_split_rounded, color: Colors.orange),
                    ),
                    WidgetSpan(child: SizedBox(width: 8)),
                    TextSpan(text: 'I-unpack para sa Tingi'),
                  ],
                ),
              ),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'I-unpack ang bulk product papunta sa mas maliit na tingi item.',
                      style: TextStyle(fontSize: 12, color: Colors.grey[600]),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'Mula sa: ${parentProduct.name}',
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                    Text('Kasalukuyang Stock: ${parentProduct.currentStock} ${parentProduct.unit}'),
                    const SizedBox(height: 12),

                    // Quantity to deduct from parent
                    TextField(
                      controller: parentQtyController,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      decoration: InputDecoration(
                        labelText: 'Ilang ${parentProduct.unit} ang ibabawas?',
                        border: const OutlineInputBorder(),
                        helperText: 'Dabawasan ang ${parentProduct.name} ng daming ito.',
                      ),
                      onChanged: (_) => setDialogState(() {}),
                    ),
                    const SizedBox(height: 16),

                    // Destination product (child) selection
                    const Text('Ilipat sa aling Tingi Product:', style: TextStyle(fontWeight: FontWeight.w600)),
                    const SizedBox(height: 6),
                    DropdownButtonFormField<Product>(
                      initialValue: selectedChild,
                      isExpanded: true,
                      decoration: const InputDecoration(
                        border: OutlineInputBorder(),
                        contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                      ),
                      items: childCandidates.map((p) {
                        return DropdownMenuItem<Product>(
                          value: p,
                          child: Text('${p.name} (${p.currentStock} ${p.unit})'),
                        );
                      }).toList(),
                      onChanged: (val) {
                        setDialogState(() {
                          selectedChild = val;
                        });
                      },
                      hint: const Text('Pumili ng Tingi Product'),
                    ),
                    const SizedBox(height: 16),

                    // Multiplier
                    TextField(
                      controller: childMultiplierController,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      decoration: InputDecoration(
                        labelText: 'Ilang piraso (multiplier) kada unit?',
                        hintText: 'Hal: 12 o 24',
                        border: const OutlineInputBorder(),
                        helperText: selectedChild == null 
                            ? 'Ilang piraso ang magagawa kada bulk unit?'
                            : 'Ilang ${selectedChild!.unit} ang katumbas ng 1 ${parentProduct.unit}?',
                      ),
                      onChanged: (_) => setDialogState(() {}),
                    ),
                    const SizedBox(height: 12),

                    if (selectedChild != null && totalYield > 0)
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: Colors.orange.shade50,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: Colors.orange.shade200),
                        ),
                        child: Text(
                          'Kinalabasan:\n'
                          '• Bawas kay ${parentProduct.name}: $parentQty ${parentProduct.unit}\n'
                          '• Dagdag kay ${selectedChild!.name}: $totalYield ${selectedChild!.unit}',
                          style: TextStyle(fontWeight: FontWeight.w600, color: Colors.orange.shade900, fontSize: 13),
                        ),
                      ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('I-cancel'),
                ),
                ElevatedButton(
                  onPressed: (selectedChild == null || parentQty <= 0 || childMultiplier <= 0)
                      ? null
                      : () async {
                          if (parentQty > parentProduct.currentStock) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text('Hindi sapat ang stock ng bulk product!'),
                                backgroundColor: Colors.red,
                              ),
                            );
                            return;
                          }

                          // Run the database transaction via Provider
                          await provider.unpackProduct(
                            parentProductId: parentProduct.id!,
                            parentQuantity: parentQty,
                            childProductId: selectedChild!.id!,
                            childQuantityAdded: totalYield,
                          );

                          if (context.mounted) {
                            Navigator.pop(context);
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text(
                                  'Tagumpay na na-unpack ang ${parentProduct.name} papunta sa ${selectedChild!.name}!'
                                ),
                                backgroundColor: Colors.green,
                              ),
                            );
                          }
                        },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.orange,
                    foregroundColor: Colors.white,
                  ),
                  child: const Text('I-unpack / I-split'),
                ),
              ],
            );
          },
        );
      },
    );
  }
}
