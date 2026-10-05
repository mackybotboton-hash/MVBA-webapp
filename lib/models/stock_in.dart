class StockIn {
  final int? id;
  final int productId;
  final String? productName; // Helper field populated via SQL joins, not saved directly in stock_ins table
  final double quantity;
  final String supplierName;
  final DateTime deliveryDate;

  StockIn({
    this.id,
    required this.productId,
    this.productName,
    required this.quantity,
    required this.supplierName,
    required this.deliveryDate,
  });

  Map<String, dynamic> toMap() {
    return {
      if (id != null) 'id': id,
      'product_id': productId,
      'quantity': quantity,
      'supplier_name': supplierName,
      'delivery_date': deliveryDate.toIso8601String(),
    };
  }

  factory StockIn.fromMap(Map<String, dynamic> map) {
    return StockIn(
      id: map['id'] as int?,
      productId: map['product_id'] as int,
      productName: map['product_name'] as String?,
      quantity: (map['quantity'] as num).toDouble(),
      supplierName: map['supplier_name'] as String,
      deliveryDate: DateTime.parse(map['delivery_date'] as String),
    );
  }
}
