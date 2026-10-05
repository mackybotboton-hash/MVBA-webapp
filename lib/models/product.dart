class Product {
  final int? id;
  final String name;
  final String category; // Beverages, Canned Goods, Snacks, Condiments, Personal Care, Others
  final String unit; // pcs, pack, box, kg, dozen
  final double buyingPrice;
  final double sellingPrice;
  final double currentStock;
  final double minStockThreshold;
  final DateTime? expiryDate;
  final String? barcode;
  final String? imagePath;
  final bool isInventory; // NEW FIELD: true for inventory items, false for custom/non-inventory items
  final double? wholesalePrice;
  final double? wholesaleMinQty;

  Product({
    this.id,
    required this.name,
    required this.category,
    required this.unit,
    required this.buyingPrice,
    required this.sellingPrice,
    required this.currentStock,
    required this.minStockThreshold,
    this.expiryDate,
    this.barcode,
    this.imagePath,
    this.isInventory = true,
    this.wholesalePrice,
    this.wholesaleMinQty,
  });

  // Calculate profit per item (Selling Price - Buying Price)
  double get profitPerItem => sellingPrice - buyingPrice;

  // Calculate total inventory value (Current Stock * Buying Price)
  double get totalValue => currentStock * buyingPrice;

  // Check if stock is below threshold
  bool get isLowStock => currentStock < minStockThreshold;

  // Check if product is already expired (date is today or in the past)
  bool get isExpired {
    if (expiryDate == null) return false;
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final exp = DateTime(expiryDate!.year, expiryDate!.month, expiryDate!.day);
    return exp.isBefore(today) || exp.isAtSameMomentAs(today);
  }

  // Check if product is expiring soon (within 30 days) and not yet expired
  bool get isExpiringSoon {
    if (expiryDate == null) return false;
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final exp = DateTime(expiryDate!.year, expiryDate!.month, expiryDate!.day);
    if (exp.isBefore(today)) return false; // Already expired
    final diffDays = exp.difference(today).inDays;
    return diffDays <= 30;
  }

  // Convert Product to a Map for database storage
  Map<String, dynamic> toMap() {
    return {
      if (id != null) 'id': id,
      'name': name,
      'category': category,
      'unit': unit,
      'buying_price': buyingPrice,
      'selling_price': sellingPrice,
      'current_stock': currentStock,
      'min_stock_threshold': minStockThreshold,
      'expiry_date': expiryDate?.toIso8601String(),
      'barcode': barcode,
      'image_path': imagePath,
      'is_inventory': isInventory ? 1 : 0,
      'wholesale_price': wholesalePrice,
      'wholesale_min_qty': wholesaleMinQty,
    };
  }

  // Create Product from a Map retrieved from the database
  factory Product.fromMap(Map<String, dynamic> map) {
    return Product(
      id: map['id'] as int?,
      name: map['name'] as String,
      category: map['category'] as String,
      unit: map['unit'] as String,
      buyingPrice: (map['buying_price'] as num).toDouble(),
      sellingPrice: (map['selling_price'] as num).toDouble(),
      currentStock: (map['current_stock'] as num).toDouble(),
      minStockThreshold: (map['min_stock_threshold'] as num).toDouble(),
      expiryDate: map['expiry_date'] != null 
          ? DateTime.parse(map['expiry_date'] as String) 
          : null,
      barcode: map['barcode'] as String?,
      imagePath: map['image_path'] as String?,
      isInventory: map['is_inventory'] == null ? true : (map['is_inventory'] as int) == 1,
      wholesalePrice: map['wholesale_price'] != null ? (map['wholesale_price'] as num).toDouble() : null,
      wholesaleMinQty: map['wholesale_min_qty'] != null ? (map['wholesale_min_qty'] as num).toDouble() : null,
    );
  }

  // Create a copy of the product with modified fields
  Product copyWith({
    int? id,
    String? name,
    String? category,
    String? unit,
    double? buyingPrice,
    double? sellingPrice,
    double? currentStock,
    double? minStockThreshold,
    DateTime? expiryDate,
    String? barcode,
    String? imagePath,
    bool? isInventory,
    double? wholesalePrice,
    double? wholesaleMinQty,
  }) {
    return Product(
      id: id ?? this.id,
      name: name ?? this.name,
      category: category ?? this.category,
      unit: unit ?? this.unit,
      buyingPrice: buyingPrice ?? this.buyingPrice,
      sellingPrice: sellingPrice ?? this.sellingPrice,
      currentStock: currentStock ?? this.currentStock,
      minStockThreshold: minStockThreshold ?? this.minStockThreshold,
      expiryDate: expiryDate ?? this.expiryDate,
      barcode: barcode ?? this.barcode,
      imagePath: imagePath ?? this.imagePath,
      isInventory: isInventory ?? this.isInventory,
      wholesalePrice: wholesalePrice ?? this.wholesalePrice,
      wholesaleMinQty: wholesaleMinQty ?? this.wholesaleMinQty,
    );
  }
}

