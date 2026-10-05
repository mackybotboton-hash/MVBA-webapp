class Expense {
  final int? id;
  final String description;
  final double amount;
  final String category;
  final DateTime expenseDate;

  Expense({
    this.id,
    required this.description,
    required this.amount,
    required this.category,
    required this.expenseDate,
  });

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'description': description,
      'amount': amount,
      'category': category,
      'expense_date': expenseDate.toIso8601String(),
    };
  }

  factory Expense.fromMap(Map<String, dynamic> map) {
    return Expense(
      id: map['id'] as int?,
      description: map['description'] as String,
      amount: (map['amount'] as num).toDouble(),
      category: map['category'] as String,
      expenseDate: DateTime.parse(map['expense_date'] as String),
    );
  }
}
