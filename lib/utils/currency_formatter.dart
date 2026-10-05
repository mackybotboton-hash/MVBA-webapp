import 'package:intl/intl.dart';

/// Shared currency formatting utility.
/// Replaces duplicate `_formatCurrency` methods in dashboard_screen.dart,
/// sales_history_screen.dart, and inline patterns in sales_screen.dart.
class CurrencyFormatter {
  CurrencyFormatter._();

  /// Formats [amount] with the given [symbol] to 2 decimal places and comma separators.
  /// Example: format(150.5, '₱') → '₱150.50'
  /// Example: format(125163.0, '₱') → '₱125,163.00'
  static String format(double amount, String symbol) {
    final formatter = NumberFormat('#,##0.00', 'en_US');
    return '$symbol${formatter.format(amount)}';
  }
}
