import 'package:flutter/foundation.dart';
import '../models/product.dart';

/// UI-level filter state for the Product List screen.
/// Extracted from InventoryProvider so that typing in a search box or toggling
/// a filter chip does NOT trigger a full data reload or rebuild every Consumer
/// that listens to inventory data.
class ProductFilterProvider with ChangeNotifier {
  String _searchQuery = '';
  String _selectedCategory = 'All';
  bool _showOnlyLowStock = false;
  bool _showOnlyNearExpiration = false;

  // Getters
  String get searchQuery => _searchQuery;
  String get selectedCategory => _selectedCategory;
  bool get showOnlyLowStock => _showOnlyLowStock;
  bool get showOnlyNearExpiration => _showOnlyNearExpiration;

  // Setters
  void setSearchQuery(String query) {
    _searchQuery = query;
    notifyListeners();
  }

  void setSelectedCategory(String category) {
    _selectedCategory = category;
    notifyListeners();
  }

  void setShowOnlyLowStock(bool value) {
    _showOnlyLowStock = value;
    notifyListeners();
  }

  void setShowOnlyNearExpiration(bool value) {
    _showOnlyNearExpiration = value;
    notifyListeners();
  }

  /// Apply all active filters against the given product list.
  /// This method takes a list (typically from InventoryProvider.products)
  /// and returns the filtered subset.
  List<Product> applyFilters(List<Product> products) {
    return products.where((product) {
      final query = _searchQuery.toLowerCase();
      final matchesSearch = product.name.toLowerCase().contains(query) ||
          (product.barcode != null && product.barcode!.toLowerCase().contains(query));
      final matchesCategory = _selectedCategory == 'All' || product.category == _selectedCategory;
      final matchesLowStock = !_showOnlyLowStock || product.isLowStock;

      final matchesExpiration = !_showOnlyNearExpiration ||
          (product.expiryDate != null && (product.isExpired || product.isExpiringSoon));

      final matchesInventory = product.isInventory;

      return matchesSearch && matchesCategory && matchesLowStock && matchesExpiration && matchesInventory;
    }).toList();
  }
}
