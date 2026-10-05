class Sale {
  final int? id;
  final int productId;
  final String? productName; // Helper field populated via SQL join
  final String? productUnit; // Helper field populated via SQL join
  final double quantity;
  final double sellingPrice; // Captured at the time of sale
  final double buyingPrice;  // Captured at the time of sale (for profit calculation)
  final DateTime saleDate;
  final double? amountPaid;  // Amount paid by the customer
  final double? changeGiven; // Change returned to the customer

  Sale({
    this.id,
    required this.productId,
    this.productName,
    this.productUnit,
    required this.quantity,
    required this.sellingPrice,
    required this.buyingPrice,
    required this.saleDate,
    this.amountPaid,
    this.changeGiven,
  });

  // Calculate total price of this sale
  double get totalPrice => quantity * sellingPrice;

  // Calculate total buying cost of this sale
  double get totalCost => quantity * buyingPrice;

  // Calculate profit from this sale
  double get profit => totalPrice - totalCost;

  Map<String, dynamic> toMap() {
    return {
      if (id != null) 'id': id,
      'product_id': productId,
      'quantity': quantity,
      'selling_price': sellingPrice,
      'buying_price': buyingPrice,
      'sale_date': saleDate.toIso8601String(),
      if (amountPaid != null) 'amount_paid': amountPaid,
      if (changeGiven != null) 'change_given': changeGiven,
    };
  }

  factory Sale.fromMap(Map<String, dynamic> map) {
    return Sale(
      id: map['id'] as int?,
      productId: map['product_id'] as int,
      productName: map['product_name'] as String?,
      productUnit: map['product_unit'] as String?,
      quantity: (map['quantity'] as num).toDouble(),
      sellingPrice: (map['selling_price'] as num).toDouble(),
      buyingPrice: (map['buying_price'] as num).toDouble(),
      saleDate: DateTime.parse(map['sale_date'] as String),
      amountPaid: map['amount_paid'] != null ? (map['amount_paid'] as num).toDouble() : null,
      changeGiven: map['change_given'] != null ? (map['change_given'] as num).toDouble() : null,
    );
  }
}
