class CreditTransaction {
  final int? id;
  final int customerId;
  final String type; // 'credit' or 'payment'
  final double amount;
  final String? description;
  final int? saleId;
  final DateTime transactionDate;
  final String? customerName; // Joined from customers table

  CreditTransaction({
    this.id,
    required this.customerId,
    required this.type,
    required this.amount,
    this.description,
    this.saleId,
    required this.transactionDate,
    this.customerName,
  });

  bool get isCredit => type == 'credit';
  bool get isPayment => type == 'payment';

  Map<String, dynamic> toMap() {
    return {
      if (id != null) 'id': id,
      'customer_id': customerId,
      'type': type,
      'amount': amount,
      'description': description,
      'sale_id': saleId,
      'transaction_date': transactionDate.toIso8601String(),
    };
  }

  factory CreditTransaction.fromMap(Map<String, dynamic> map) {
    return CreditTransaction(
      id: map['id'] as int?,
      customerId: map['customer_id'] as int,
      type: map['type'] as String,
      amount: (map['amount'] as num).toDouble(),
      description: map['description'] as String?,
      saleId: map['sale_id'] as int?,
      transactionDate: DateTime.parse(map['transaction_date'] as String),
      customerName: map['customer_name'] as String?,
    );
  }
}
