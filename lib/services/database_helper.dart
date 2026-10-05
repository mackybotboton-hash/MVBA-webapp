import 'dart:async';
import 'package:path/path.dart';
import 'package:sqflite/sqflite.dart';
import '../models/product.dart';
import '../models/stock_in.dart';
import '../models/sale.dart';
import '../models/customer.dart';
import '../models/credit_transaction.dart';
import '../models/expense.dart';

class DatabaseHelper {
  static final DatabaseHelper instance = DatabaseHelper._init();
  static Database? _database;

  DatabaseHelper._init();

  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDB('sarisari_inventory.db');
    return _database!;
  }

  Future<void> closeDatabase() async {
    if (_database != null) {
      await _database!.close();
      _database = null;
    }
  }

  Future<Database> _initDB(String filePath) async {
    final dbPath = await getDatabasesPath();
    final path = join(dbPath, filePath);

    return await openDatabase(
      path,
      version: 8,
      onCreate: _createDB,
      onUpgrade: _onUpgrade,
      onConfigure: _onConfigure,
    );
  }

  Future _onConfigure(Database db) async {
    // Enable Foreign Key support
    await db.execute('PRAGMA foreign_keys = ON');
  }

  Future _onUpgrade(Database db, int oldVersion, int newVersion) async {
    if (oldVersion < 2) {
      try {
        await db.execute('ALTER TABLE products ADD COLUMN barcode TEXT');
      } catch (_) {}
    }
    if (oldVersion < 3) {
      try {
        await db.execute('ALTER TABLE sales ADD COLUMN amount_paid REAL DEFAULT 0.0');
        await db.execute('ALTER TABLE sales ADD COLUMN change_given REAL DEFAULT 0.0');
      } catch (_) {}
    }
    if (oldVersion < 4) {
      // Performance indexes for queries that sort/filter by date and join on product_id
      try {
        await db.execute('CREATE INDEX IF NOT EXISTS idx_sales_sale_date ON sales(sale_date)');
        await db.execute('CREATE INDEX IF NOT EXISTS idx_sales_product_id ON sales(product_id)');
        await db.execute('CREATE INDEX IF NOT EXISTS idx_stock_ins_delivery_date ON stock_ins(delivery_date)');
        await db.execute('CREATE INDEX IF NOT EXISTS idx_stock_ins_product_id ON stock_ins(product_id)');
      } catch (_) {}
    }
    if (oldVersion < 5) {
      // Feature: Product Images
      try {
        await db.execute('ALTER TABLE products ADD COLUMN image_path TEXT');
      } catch (_) {}
      // Feature: Credit/Utang Tracking
      try {
        await db.execute('''
          CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT,
            notes TEXT,
            created_at TEXT NOT NULL
          )
        ''');
        await db.execute('''
          CREATE TABLE IF NOT EXISTS credit_transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER NOT NULL,
            type TEXT NOT NULL,
            amount REAL NOT NULL,
            description TEXT,
            sale_id INTEGER,
            transaction_date TEXT NOT NULL,
            FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE,
            FOREIGN KEY (sale_id) REFERENCES sales (id) ON DELETE SET NULL
          )
        ''');
        await db.execute('CREATE INDEX IF NOT EXISTS idx_credit_customer_id ON credit_transactions(customer_id)');
        await db.execute('CREATE INDEX IF NOT EXISTS idx_credit_transaction_date ON credit_transactions(transaction_date)');
      } catch (_) {}
    }
    if (oldVersion < 6) {
      try {
        await db.execute('ALTER TABLE products ADD COLUMN is_inventory INTEGER DEFAULT 1');
      } catch (_) {}
    }
    if (oldVersion < 7) {
      try {
        await db.execute('''
          CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            description TEXT NOT NULL,
            amount REAL NOT NULL,
            category TEXT NOT NULL,
            expense_date TEXT NOT NULL
          )
        ''');
        await db.execute('CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date)');
      } catch (_) {}
    }
    if (oldVersion < 8) {
      try {
        await db.execute('ALTER TABLE products ADD COLUMN wholesale_price REAL');
        await db.execute('ALTER TABLE products ADD COLUMN wholesale_min_qty REAL');
      } catch (_) {}
    }
  }

  Future _createDB(Database db, int version) async {
    // 1. Create Products Table
    await db.execute('''
      CREATE TABLE products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        unit TEXT NOT NULL,
        buying_price REAL NOT NULL,
        selling_price REAL NOT NULL,
        current_stock REAL NOT NULL,
        min_stock_threshold REAL NOT NULL,
        expiry_date TEXT,
        barcode TEXT,
        image_path TEXT,
        is_inventory INTEGER DEFAULT 1,
        wholesale_price REAL,
        wholesale_min_qty REAL
      )
    ''');

    // 2. Create Stock Ins Table (Restocking history)
    await db.execute('''
      CREATE TABLE stock_ins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        quantity REAL NOT NULL,
        supplier_name TEXT NOT NULL,
        delivery_date TEXT NOT NULL,
        FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
      )
    ''');

    // 3. Create Sales Table
    await db.execute('''
      CREATE TABLE sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        quantity REAL NOT NULL,
        selling_price REAL NOT NULL,
        buying_price REAL NOT NULL,
        sale_date TEXT NOT NULL,
        amount_paid REAL,
        change_given REAL,
        FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE
      )
    ''');

    // 4. Create Customers Table (Utang/Credit tracking)
    await db.execute('''
      CREATE TABLE customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        notes TEXT,
        created_at TEXT NOT NULL
      )
    ''');

    // 5. Create Credit Transactions Table
    await db.execute('''
      CREATE TABLE credit_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        amount REAL NOT NULL,
        description TEXT,
        sale_id INTEGER,
        transaction_date TEXT NOT NULL,
        FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE,
        FOREIGN KEY (sale_id) REFERENCES sales (id) ON DELETE SET NULL
      )
    ''');

    // 6. Performance indexes
    await db.execute('CREATE INDEX IF NOT EXISTS idx_sales_sale_date ON sales(sale_date)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_sales_product_id ON sales(product_id)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_stock_ins_delivery_date ON stock_ins(delivery_date)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_stock_ins_product_id ON stock_ins(product_id)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_credit_customer_id ON credit_transactions(customer_id)');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_credit_transaction_date ON credit_transactions(transaction_date)');

    // 7. Create Expenses Table
    await db.execute('''
      CREATE TABLE expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        description TEXT NOT NULL,
        amount REAL NOT NULL,
        category TEXT NOT NULL,
        expense_date TEXT NOT NULL
      )
    ''');
    await db.execute('CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date)');
  }

  // ==========================================
  // PRODUCT CRUD OPERATIONS
  // ==========================================

  Future<int> insertProduct(Product product) async {
    final db = await instance.database;
    return await db.insert('products', product.toMap());
  }

  Future<Product?> getProductById(int id) async {
    final db = await instance.database;
    final maps = await db.query(
      'products',
      where: 'id = ?',
      whereArgs: [id],
    );

    if (maps.isNotEmpty) {
      return Product.fromMap(maps.first);
    } else {
      return null;
    }
  }

  Future<List<Product>> getProducts() async {
    final db = await instance.database;
    final result = await db.query('products', orderBy: 'name ASC');
    return result.map((json) => Product.fromMap(json)).toList();
  }

  Future<int> updateProduct(Product product) async {
    final db = await instance.database;
    return await db.update(
      'products',
      product.toMap(),
      where: 'id = ?',
      whereArgs: [product.id],
    );
  }

  Future<int> deleteProduct(int id) async {
    final db = await instance.database;
    return await db.delete(
      'products',
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  // ==========================================
  // TRANSACTION-SAFE STOCK-IN OPERATIONS
  // ==========================================

  Future<int> insertStockIn(StockIn stockIn) async {
    final db = await instance.database;
    int stockInId = -1;

    // Use a transaction to ensure database consistency
    await db.transaction((txn) async {
      // 1. Insert the stock-in log
      stockInId = await txn.insert('stock_ins', stockIn.toMap());

      // 2. Retrieve the product to update its stock
      final productMaps = await txn.query(
        'products',
        columns: ['current_stock'],
        where: 'id = ?',
        whereArgs: [stockIn.productId],
      );

      if (productMaps.isNotEmpty) {
        final double currentStock = (productMaps.first['current_stock'] as num).toDouble();
        final double newStock = currentStock + stockIn.quantity;

        // 3. Update the product stock
        await txn.update(
          'products',
          {'current_stock': newStock},
          where: 'id = ?',
          whereArgs: [stockIn.productId],
        );
      }
    });

    return stockInId;
  }

  Future<List<StockIn>> getStockIns() async {
    final db = await instance.database;
    // Join products to get the name of the product
    final result = await db.rawQuery('''
      SELECT stock_ins.*, products.name AS product_name 
      FROM stock_ins 
      INNER JOIN products ON stock_ins.product_id = products.id 
      ORDER BY datetime(delivery_date) DESC
    ''');

    return result.map((json) => StockIn.fromMap(json)).toList();
  }

  // ==========================================
  // TRANSACTION-SAFE SALES OPERATIONS
  // ==========================================

  // Perform multiple sales in a single transaction (for a shopping cart checkout!)
  Future<void> checkoutCart(List<Sale> sales, {int? customerId}) async {
    final db = await instance.database;

    await db.transaction((txn) async {
      double totalBill = 0.0;
      for (final sale in sales) {
        // 1. Retrieve the current stock, name, and inventory status of the product
        final productMaps = await txn.query(
          'products',
          columns: ['name', 'current_stock', 'is_inventory'],
          where: 'id = ?',
          whereArgs: [sale.productId],
        );

        if (productMaps.isNotEmpty) {
          final String productName = productMaps.first['name'] as String;
          final double currentStock = (productMaps.first['current_stock'] as num).toDouble();
          final int isInventoryInt = productMaps.first['is_inventory'] == null 
              ? 1 
              : productMaps.first['is_inventory'] as int;
          final bool isInventory = isInventoryInt == 1;

          final double newStock = currentStock - sale.quantity;

          if (isInventory && newStock < 0) {
            throw StateError("Kulang sa stock ang '$productName' (Kasalukuyan: $currentStock, Hinihingi: ${sale.quantity})");
          }

          totalBill += sale.totalPrice;

          // 2. Insert the sale log
          await txn.insert('sales', sale.toMap());

          // 3. Update the product stock (only if it is tracked in inventory)
          if (isInventory) {
            await txn.update(
              'products',
              {'current_stock': newStock},
              where: 'id = ?',
              whereArgs: [sale.productId],
            );
          }
        }
      }

      // If customerId is provided, log the credit transaction as well!
      if (customerId != null) {
        await txn.insert('credit_transactions', {
          'customer_id': customerId,
          'type': 'credit',
          'amount': totalBill,
          'description': 'Benta sa POS (POS Purchase)',
          'transaction_date': DateTime.now().toIso8601String(),
        });
      }
    });
  }

  // NOTE: insertSale() was removed — it was dead code never called by any screen.
  // All sales go through checkoutCart() which handles batch inserts in a single transaction.

  Future<List<Sale>> getSales() async {
    final db = await instance.database;
    // Join products to get the name and unit of the product
    final result = await db.rawQuery('''
      SELECT sales.*, products.name AS product_name, products.unit AS product_unit 
      FROM sales 
      INNER JOIN products ON sales.product_id = products.id 
      ORDER BY datetime(sale_date) DESC
    ''');

    return result.map((json) => Sale.fromMap(json)).toList();
  }

  // Void/Undo a sale: removes the sales log and restores the stock to inventory
  Future<void> voidSale(int saleId) async {
    final db = await instance.database;

    await db.transaction((txn) async {
      // 1. Retrieve the sale details first
      final saleMaps = await txn.query(
        'sales',
        where: 'id = ?',
        whereArgs: [saleId],
      );

      if (saleMaps.isNotEmpty) {
        final sale = Sale.fromMap(saleMaps.first);

        // 2. Restore stock quantity in the products table (only if it is tracked in inventory)
        final productMaps = await txn.query(
          'products',
          columns: ['current_stock', 'is_inventory'],
          where: 'id = ?',
          whereArgs: [sale.productId],
        );

        if (productMaps.isNotEmpty) {
          final int isInventoryInt = productMaps.first['is_inventory'] == null 
              ? 1 
              : productMaps.first['is_inventory'] as int;
          final bool isInventory = isInventoryInt == 1;

          if (isInventory) {
            final double currentStock = (productMaps.first['current_stock'] as num).toDouble();
            final double restoredStock = currentStock + sale.quantity;

            await txn.update(
              'products',
              {'current_stock': restoredStock},
              where: 'id = ?',
              whereArgs: [sale.productId],
            );
          }
        }

        // 3. Delete the sales log
        await txn.delete(
          'sales',
          where: 'id = ?',
          whereArgs: [saleId],
        );
      }
    });
  }

  // Support splitting / unpacking bulk stock (e.g. converting a pack to pieces)
  Future<void> unpackProduct({
    required int parentProductId,
    required double parentQuantity,
    required int childProductId,
    required double childQuantityAdded,
  }) async {
    final db = await instance.database;

    await db.transaction((txn) async {
      // 1. Deduct quantity from the parent product
      final parentMaps = await txn.query(
        'products',
        columns: ['current_stock'],
        where: 'id = ?',
        whereArgs: [parentProductId],
      );

      if (parentMaps.isNotEmpty) {
        final double parentStock = (parentMaps.first['current_stock'] as num).toDouble();
        await txn.update(
          'products',
          {'current_stock': parentStock - parentQuantity},
          where: 'id = ?',
          whereArgs: [parentProductId],
        );
      }

      // 2. Add quantity to the child product
      final childMaps = await txn.query(
        'products',
        columns: ['current_stock'],
        where: 'id = ?',
        whereArgs: [childProductId],
      );

      if (childMaps.isNotEmpty) {
        final double childStock = (childMaps.first['current_stock'] as num).toDouble();
        await txn.update(
          'products',
          {'current_stock': childStock + childQuantityAdded},
          where: 'id = ?',
          whereArgs: [childProductId],
        );
      }

      // 3. Log this action (for now, we'll log it as a special StockIn for the child product)
      await txn.insert('stock_ins', {
        'product_id': childProductId,
        'quantity': childQuantityAdded,
        'supplier_name': 'UNPACK / TINGI conversion from Parent Product ID $parentProductId',
        'delivery_date': DateTime.now().toIso8601String(),
      });
    });
  }

  // NOTE: The orphan close() method was removed.
  // Use closeDatabase() instead — it properly nulls the _database reference
  // to allow re-initialization (required by BackupService.restoreDatabase).

  // ==========================================
  // CUSTOMER (UTANG) CRUD OPERATIONS
  // ==========================================

  Future<int> insertCustomer(Customer customer) async {
    final db = await instance.database;
    return await db.insert('customers', customer.toMap());
  }

  Future<List<Customer>> getCustomers() async {
    final db = await instance.database;
    final result = await db.query('customers', orderBy: 'name ASC');
    return result.map((json) => Customer.fromMap(json)).toList();
  }

  Future<int> updateCustomer(Customer customer) async {
    final db = await instance.database;
    return await db.update(
      'customers',
      customer.toMap(),
      where: 'id = ?',
      whereArgs: [customer.id],
    );
  }

  Future<int> deleteCustomer(int id) async {
    final db = await instance.database;
    return await db.delete(
      'customers',
      where: 'id = ?',
      whereArgs: [id],
    );
  }

  // ==========================================
  // CREDIT TRANSACTION OPERATIONS
  // ==========================================

  Future<int> insertCreditTransaction(CreditTransaction transaction) async {
    final db = await instance.database;
    return await db.insert('credit_transactions', transaction.toMap());
  }

  Future<List<CreditTransaction>> getCreditTransactionsForCustomer(int customerId) async {
    final db = await instance.database;
    final result = await db.query(
      'credit_transactions',
      where: 'customer_id = ?',
      whereArgs: [customerId],
      orderBy: 'datetime(transaction_date) DESC',
    );
    return result.map((json) => CreditTransaction.fromMap(json)).toList();
  }

  Future<List<CreditTransaction>> getAllCreditTransactions() async {
    final db = await instance.database;
    final result = await db.rawQuery('''
      SELECT credit_transactions.*, customers.name AS customer_name
      FROM credit_transactions
      INNER JOIN customers ON credit_transactions.customer_id = customers.id
      ORDER BY datetime(transaction_date) DESC
    ''');
    return result.map((json) => CreditTransaction.fromMap(json)).toList();
  }

  /// Returns the outstanding balance for a customer (credits - payments).
  Future<double> getCustomerBalance(int customerId) async {
    final db = await instance.database;
    final result = await db.rawQuery('''
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN type = 'payment' THEN amount ELSE 0 END), 0) AS balance
      FROM credit_transactions
      WHERE customer_id = ?
    ''', [customerId]);

    if (result.isNotEmpty) {
      return (result.first['balance'] as num).toDouble();
    }
    return 0.0;
  }

  /// Returns a map of customer_id -> outstanding balance for all customers.
  Future<Map<int, double>> getAllCustomerBalances() async {
    final db = await instance.database;
    final result = await db.rawQuery('''
      SELECT customer_id,
        COALESCE(SUM(CASE WHEN type = 'credit' THEN amount ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN type = 'payment' THEN amount ELSE 0 END), 0) AS balance
      FROM credit_transactions
      GROUP BY customer_id
    ''');

    final Map<int, double> balances = {};
    for (final row in result) {
      balances[row['customer_id'] as int] = (row['balance'] as num).toDouble();
    }
    return balances;
  }

  // ==========================================
  // EXPENSE CRUD OPERATIONS
  // ==========================================

  Future<int> insertExpense(Expense expense) async {
    final db = await instance.database;
    return await db.insert('expenses', expense.toMap());
  }

  Future<List<Expense>> getAllExpenses() async {
    final db = await instance.database;
    final result = await db.query('expenses', orderBy: 'datetime(expense_date) DESC');
    return result.map((json) => Expense.fromMap(json)).toList();
  }

  Future<int> deleteExpense(int id) async {
    final db = await instance.database;
    return await db.delete(
      'expenses',
      where: 'id = ?',
      whereArgs: [id],
    );
  }
}
