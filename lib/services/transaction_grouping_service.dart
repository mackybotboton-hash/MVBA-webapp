import '../models/sale.dart';
import 'package:intl/intl.dart';

/// Helper model for aggregated per-product sales summaries.
/// Extracted from sales_history_screen.dart for reuse and testability.
class AggregatedProductSale {
  final String productName;
  final String productUnit;
  final double totalQuantity;
  final double totalRevenue;
  final double totalProfit;

  AggregatedProductSale({
    required this.productName,
    required this.productUnit,
    required this.totalQuantity,
    required this.totalRevenue,
    required this.totalProfit,
  });
}

/// Centralized service for grouping individual sale records into transactions
/// and computing aggregated product-level summaries.
///
/// Extracted from sales_history_screen.dart to:
/// 1. Eliminate duplicated filter logic
/// 2. Make transaction grouping testable independently of the UI
/// 3. Provide a single source of truth for business rules
class TransactionGroupingService {
  TransactionGroupingService._();

  /// Groups a flat list of [Sale] records into logical transactions.
  ///
  /// Two sales are considered part of the same transaction if:
  /// - They have the exact same `saleDate`, OR
  /// - They are within 2 seconds of each other AND share the same payment info
  ///
  /// Returns a list of transaction groups, each group being a list of [Sale].
  /// Groups are sorted by most recent first.
  static List<List<Sale>> groupIntoTransactions(List<Sale> sales) {
    if (sales.isEmpty) return [];

    // Sort by date descending
    final sorted = List<Sale>.from(sales)
      ..sort((a, b) => b.saleDate.compareTo(a.saleDate));

    final List<List<Sale>> transactions = [];
    List<Sale> currentTx = [sorted.first];
    transactions.add(currentTx);

    for (int i = 1; i < sorted.length; i++) {
      final sale = sorted[i];
      final prevSale = currentTx.last;

      final sameExactDate = sale.saleDate == prevSale.saleDate;
      final withinTwoSeconds = (sale.saleDate.difference(prevSale.saleDate).abs().inSeconds <= 2);
      final samePayment = sale.amountPaid == prevSale.amountPaid && sale.changeGiven == prevSale.changeGiven;
      final isFromSameTransaction = sameExactDate || (withinTwoSeconds && samePayment && sale.amountPaid != null && sale.amountPaid! > 0);

      if (isFromSameTransaction) {
        currentTx.add(sale);
      } else {
        currentTx = [sale];
        transactions.add(currentTx);
      }
    }

    return transactions;
  }

  /// Groups a list of transactions by date string ("yyyy-MM-dd").
  ///
  /// Returns an ordered map where keys are date strings and values are
  /// the list of transaction groups for that date.
  static Map<String, List<List<Sale>>> groupTransactionsByDate(List<List<Sale>> transactions) {
    final Map<String, List<List<Sale>>> grouped = {};
    for (var tx in transactions) {
      if (tx.isEmpty) continue;
      final dateStr = DateFormat('yyyy-MM-dd').format(tx.first.saleDate);
      if (!grouped.containsKey(dateStr)) {
        grouped[dateStr] = [];
      }
      grouped[dateStr]!.add(tx);
    }
    return grouped;
  }

  /// Aggregates sales by product name, summing quantity, revenue, and profit.
  ///
  /// Returns a list sorted by total quantity sold (descending).
  static List<AggregatedProductSale> aggregateSales(List<Sale> sales) {
    final Map<String, AggregatedProductSale> aggregated = {};

    for (var sale in sales) {
      final key = sale.productName ?? 'Unknown Product';
      final unit = sale.productUnit ?? 'pcs';
      final existing = aggregated[key];

      if (existing == null) {
        aggregated[key] = AggregatedProductSale(
          productName: key,
          productUnit: unit,
          totalQuantity: sale.quantity,
          totalRevenue: sale.totalPrice,
          totalProfit: sale.profit,
        );
      } else {
        aggregated[key] = AggregatedProductSale(
          productName: key,
          productUnit: unit,
          totalQuantity: existing.totalQuantity + sale.quantity,
          totalRevenue: existing.totalRevenue + sale.totalPrice,
          totalProfit: existing.totalProfit + sale.profit,
        );
      }
    }

    final list = aggregated.values.toList();
    list.sort((a, b) => b.totalQuantity.compareTo(a.totalQuantity));
    return list;
  }

  /// Filters sales by search query and optional date.
  ///
  /// Centralizes the filter logic that was previously duplicated twice
  /// in sales_history_screen.dart (lines 638-647 and 801-810).
  static List<Sale> filterSales(List<Sale> sales, {required String searchQuery, DateTime? selectedDate}) {
    return sales.where((s) {
      final prodName = s.productName ?? '';
      final matchesSearch = prodName.toLowerCase().contains(searchQuery.toLowerCase());
      if (selectedDate == null) return matchesSearch;

      final isSameDay = s.saleDate.year == selectedDate.year &&
                        s.saleDate.month == selectedDate.month &&
                        s.saleDate.day == selectedDate.day;
      return matchesSearch && isSameDay;
    }).toList();
  }

  /// Formats a date string into a human-readable header with
  /// "Ngayong Araw" (today) and "Kahapon" (yesterday) labels.
  static String formatHeaderDate(String dateStr) {
    final date = DateTime.parse(dateStr);
    final today = DateTime.now();
    final yesterday = today.subtract(const Duration(days: 1));

    final todayStr = DateFormat('yyyy-MM-dd').format(today);
    final yesterdayStr = DateFormat('yyyy-MM-dd').format(yesterday);

    if (dateStr == todayStr) {
      return '${DateFormat('MMMM dd, yyyy').format(date)} (Ngayong Araw)';
    } else if (dateStr == yesterdayStr) {
      return '${DateFormat('MMMM dd, yyyy').format(date)} (Kahapon)';
    } else {
      return DateFormat('EEEE, MMMM dd, yyyy').format(date);
    }
  }
}
