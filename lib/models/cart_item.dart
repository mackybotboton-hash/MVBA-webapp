import 'product.dart';

/// Represents a single item in the shopping cart during a POS session.
/// Extracted from the private `_CartItem` class in sales_screen.dart
/// to enable reuse in the checkout dialog and any future cart-related logic.
class CartItem {
  final Product product;
  double quantity;
  double? customPrice;

  CartItem({required this.product, required this.quantity, this.customPrice});

  double get activePrice {
    if (customPrice != null) return customPrice!;
    
    if (product.wholesalePrice != null && 
        product.wholesaleMinQty != null &&
        product.wholesalePrice! > 0 &&
        product.wholesaleMinQty! > 0 &&
        quantity >= product.wholesaleMinQty!) {
      return product.wholesalePrice!;
    }
    
    return product.sellingPrice;
  }

  double get totalPrice => quantity * activePrice;
}
