import 'package:flutter/foundation.dart';
import 'package:intl/intl.dart';
import '../models/product.dart';
import '../models/stock_in.dart';
import '../models/sale.dart';
import '../models/customer.dart';
import '../models/credit_transaction.dart';
import '../models/expense.dart';
import '../services/database_helper.dart';

class InventoryProvider with ChangeNotifier {
  final DatabaseHelper _dbHelper = DatabaseHelper.instance;

  List<Product> _products = [];
  List<StockIn> _stockIns = [];
  List<Sale> _sales = [];
  List<Customer> _customers = [];
  List<Expense> _expenses = [];
  Map<int, double> _customerBalances = {};
  bool _isLoading = false;

  // Getters
  List<Product> get products => _products.where((p) => p.isInventory).toList();
  List<StockIn> get stockIns => _stockIns;
  List<Sale> get sales => _sales;
  List<Customer> get customers => _customers;
  List<Expense> get expenses => _expenses;
  Map<int, double> get customerBalances => _customerBalances;
  bool get isLoading => _isLoading;

  /// Outstanding balance for a specific customer.
  double getBalance(int customerId) => _customerBalances[customerId] ?? 0.0;

  /// Total outstanding credit across all customers.
  double get totalOutstandingCredit {
    double total = 0.0;
    _customerBalances.forEach((_, balance) {
      if (balance > 0) total += balance;
    });
    return total;
  }

  /// Number of customers with outstanding credit.
  int get customersWithCreditCount {
    return _customerBalances.values.where((b) => b > 0).length;
  }

  // ==============================================
  // TARGETED DATA LOADING (Phase 3 optimization)
  // ==============================================
  // Instead of reloading ALL tables on every write operation,
  // each mutation now reloads only the affected table(s).

  /// Full initial load — called once at startup.
  Future<void> loadData() async {
    _isLoading = true;
    notifyListeners();

    try {
      final results = await Future.wait([
        _dbHelper.getProducts(),
        _dbHelper.getStockIns(),
        _dbHelper.getSales(),
        _dbHelper.getCustomers(),
        _dbHelper.getAllCustomerBalances(),
        _dbHelper.getAllExpenses(),
      ]);

      _products = results[0] as List<Product>;
      _stockIns = results[1] as List<StockIn>;
      _sales = results[2] as List<Sale>;
      _customers = results[3] as List<Customer>;
      _customerBalances = results[4] as Map<int, double>;
      _expenses = results[5] as List<Expense>;
    } catch (e) {
      if (kDebugMode) {
        print("Error loading data from database: $e");
      }
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  /// Reload only the products table.
  Future<void> _reloadProducts() async {
    try {
      _products = await _dbHelper.getProducts();
    } catch (e) {
      if (kDebugMode) {
        print("Error reloading products: $e");
      }
    }
    notifyListeners();
  }

  /// Reload only the sales table.
  Future<void> _reloadSales() async {
    try {
      _sales = await _dbHelper.getSales();
    } catch (e) {
      if (kDebugMode) {
        print("Error reloading sales: $e");
      }
    }
    notifyListeners();
  }

  /// Reload only the stock-ins table.
  Future<void> _reloadStockIns() async {
    try {
      _stockIns = await _dbHelper.getStockIns();
    } catch (e) {
      if (kDebugMode) {
        print("Error reloading stock-ins: $e");
      }
    }
    notifyListeners();
  }

  /// Reload only the expenses table.
  Future<void> _reloadExpenses() async {
    try {
      _expenses = await _dbHelper.getAllExpenses();
    } catch (e) {
      if (kDebugMode) {
        print("Error reloading expenses: $e");
      }
    }
    notifyListeners();
  }

  // ==========================================
  // PRODUCT OPERATIONS
  // ==========================================

  Future<Product> addProduct(Product product) async {
    final id = await _dbHelper.insertProduct(product);
    final createdProduct = product.copyWith(id: id);
    await _reloadProducts();
    return createdProduct;
  }

  Future<void> updateProduct(Product product) async {
    await _dbHelper.updateProduct(product);
    await _reloadProducts();
  }

  Future<void> deleteProduct(int id) async {
    await _dbHelper.deleteProduct(id);
    await loadData(); // Cascading delete may affect sales/stock_ins
  }

  // ==========================================
  // STOCK IN OPERATIONS
  // ==========================================

  Future<void> addStockIn(StockIn stockIn) async {
    await _dbHelper.insertStockIn(stockIn);
    await Future.wait([
      _reloadProducts(),
      _reloadStockIns(),
    ]);
  }

  // ==========================================
  // EXPENSE OPERATIONS
  // ==========================================

  Future<void> addExpense(Expense expense) async {
    await _dbHelper.insertExpense(expense);
    await _reloadExpenses();
  }

  Future<void> deleteExpense(int id) async {
    await _dbHelper.deleteExpense(id);
    await _reloadExpenses();
  }

  // ==========================================
  // SALES OPERATIONS
  // ==========================================

  Future<void> checkout(List<Sale> cartSales, {int? customerId}) async {
    await _dbHelper.checkoutCart(cartSales, customerId: customerId);
    if (customerId != null) {
      await Future.wait([
        _reloadProducts(),
        _reloadSales(),
        _reloadCustomers(),
      ]);
    } else {
      await Future.wait([
        _reloadProducts(),
        _reloadSales(),
      ]);
    }
  }

  Future<void> voidSale(int saleId) async {
    await _dbHelper.voidSale(saleId);
    await _reloadProducts();
    await _reloadSales();
  }

  // ==========================================
  // UNPACKING / TINGI OPERATIONS
  // ==========================================

  Future<void> unpackProduct({
    required int parentProductId,
    required double parentQuantity,
    required int childProductId,
    required double childQuantityAdded,
  }) async {
    await _dbHelper.unpackProduct(
      parentProductId: parentProductId,
      parentQuantity: parentQuantity,
      childProductId: childProductId,
      childQuantityAdded: childQuantityAdded,
    );
    await _reloadProducts();
    await _reloadStockIns();
  }

  // ==========================================
  // DASHBOARD & SUMMARY GETTERS
  // ==========================================

  int get totalProductsCount => _products.where((p) => p.isInventory).length;

  double get totalInventoryValue {
    double total = 0.0;
    for (var p in _products) {
      if (p.isInventory) {
        total += p.totalValue;
      }
    }
    return total;
  }

  int get lowStockProductsCount {
    return _products.where((p) => p.isInventory && p.isLowStock).length;
  }

  List<Product> get lowStockProducts {
    return _products.where((p) => p.isInventory && p.isLowStock).toList();
  }

  // Today's total sales summary
  double get todaySalesTotal {
    double total = 0.0;
    final todayStr = DateFormat('yyyy-MM-dd').format(DateTime.now());
    for (var sale in _sales) {
      final saleDayStr = DateFormat('yyyy-MM-dd').format(sale.saleDate);
      if (saleDayStr == todayStr) {
        total += sale.totalPrice;
      }
    }
    return total;
  }

  // Today's total profit summary
  double get todayProfitTotal {
    double total = 0.0;
    final todayStr = DateFormat('yyyy-MM-dd').format(DateTime.now());
    for (var sale in _sales) {
      final saleDayStr = DateFormat('yyyy-MM-dd').format(sale.saleDate);
      if (saleDayStr == todayStr) {
        total += sale.profit;
      }
    }
    return total;
  }

  // Today's total expenses summary
  double get todayExpensesTotal {
    double total = 0.0;
    final todayStr = DateFormat('yyyy-MM-dd').format(DateTime.now());
    for (var expense in _expenses) {
      final expDayStr = DateFormat('yyyy-MM-dd').format(expense.expenseDate);
      if (expDayStr == todayStr) {
        total += expense.amount;
      }
    }
    return total;
  }

  // Current month's total expenses summary
  double get monthExpensesTotal {
    double total = 0.0;
    final currentMonthStr = DateFormat('yyyy-MM').format(DateTime.now());
    for (var expense in _expenses) {
      final expMonthStr = DateFormat('yyyy-MM').format(expense.expenseDate);
      if (expMonthStr == currentMonthStr) {
        total += expense.amount;
      }
    }
    return total;
  }

  // Today's net profit (Gross profit minus expenses)
  double get netProfitToday => todayProfitTotal - todayExpensesTotal;

  // Today's total item sold count
  double get todayItemsSold {
    double total = 0.0;
    final todayStr = DateFormat('yyyy-MM-dd').format(DateTime.now());
    for (var sale in _sales) {
      final saleDayStr = DateFormat('yyyy-MM-dd').format(sale.saleDate);
      if (saleDayStr == todayStr) {
        total += sale.quantity;
      }
    }
    return total;
  }

  // Get sales data for the last 7 days (for chart)
  List<SalesChartData> get salesHistoryLast7Days {
    final List<SalesChartData> chartData = [];
    final today = DateTime.now();

    for (int i = 6; i >= 0; i--) {
      final date = today.subtract(Duration(days: i));
      final dateStr = DateFormat('yyyy-MM-dd').format(date);
      final dayLabel = DateFormat('E').format(date); // e.g. "Mon", "Tue"

      double dailySales = 0.0;
      for (var sale in _sales) {
        final saleDayStr = DateFormat('yyyy-MM-dd').format(sale.saleDate);
        if (saleDayStr == dateStr) {
          dailySales += sale.totalPrice;
        }
      }

      chartData.add(SalesChartData(dayLabel, dailySales));
    }

    return chartData;
  }

  // ==========================================
  // CUSTOMER (UTANG) OPERATIONS
  // ==========================================

  Future<void> _reloadCustomers() async {
    try {
      _customers = await _dbHelper.getCustomers();
      _customerBalances = await _dbHelper.getAllCustomerBalances();
    } catch (e) {
      if (kDebugMode) {
        print("Error reloading customers: $e");
      }
    }
    notifyListeners();
  }

  Future<int> addCustomer(Customer customer) async {
    final id = await _dbHelper.insertCustomer(customer);
    await _reloadCustomers();
    return id;
  }

  Future<void> updateCustomer(Customer customer) async {
    await _dbHelper.updateCustomer(customer);
    await _reloadCustomers();
  }

  Future<void> deleteCustomer(int id) async {
    await _dbHelper.deleteCustomer(id);
    await _reloadCustomers();
  }

  Future<void> addCreditTransaction(CreditTransaction transaction) async {
    await _dbHelper.insertCreditTransaction(transaction);
    await _reloadCustomers();
  }

  Future<List<CreditTransaction>> getCreditTransactionsForCustomer(int customerId) async {
    return await _dbHelper.getCreditTransactionsForCustomer(customerId);
  }

  Future<double> getCustomerBalance(int customerId) async {
    return await _dbHelper.getCustomerBalance(customerId);
  }
}

// Chart data model for rendering the sales trend
class SalesChartData {
  final String day;
  final double amount;

  SalesChartData(this.day, this.amount);
}
