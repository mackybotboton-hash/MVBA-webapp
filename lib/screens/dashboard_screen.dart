import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/inventory_provider.dart';
import '../providers/settings_provider.dart';
import '../providers/navigation_provider.dart';
import '../providers/product_filter_provider.dart';
import '../utils/app_constants.dart';
import '../utils/currency_formatter.dart';
import '../widgets/app_skeleton_loader.dart';
import '../widgets/app_drawer.dart';
import 'stock_in_screen.dart';
import 'settings_screen.dart';
import 'expenses_screen.dart';

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final settings = Provider.of<SettingsProvider>(context);
    final currencySymbol = settings.currencySymbol;

    return Scaffold(
      drawer: const AppDrawer(),
      appBar: AppBar(
        title: Text(
          settings.tr(
            'Dashboard ng ${settings.storeName}',
            '${settings.storeName} Dashboard',
          ),
          style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
        ),
        backgroundColor: AppColors.primary,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.settings, color: Colors.white),
            tooltip: 'Mga Setting',
            onPressed: () => SettingsScreen.navigate(context),
          ),
        ],
      ),
      body: Consumer<InventoryProvider>(
        builder: (context, provider, child) {
          if (provider.isLoading) {
            return SingleChildScrollView(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                children: [
                  AppSkeletonLoader.kpiGrid(),
                  const SizedBox(height: 16),
                  ...List.generate(3, (_) => const Padding(
                    padding: EdgeInsets.only(bottom: 12.0),
                    child: SkeletonListItem(),
                  )),
                ],
              ),
            );
          }

          final totalProducts = provider.totalProductsCount;
          final inventoryValue = provider.totalInventoryValue;
          final lowStockCount = provider.lowStockProductsCount;
          final todaySales = provider.todaySalesTotal;
          final todayProfit = provider.todayProfitTotal;
          final todayExpenses = provider.todayExpensesTotal;
          final todayNetProfit = provider.netProfitToday;

          final isTablet = AppBreakpoints.isTablet(context);

          final cardTodaySales = _buildKpiCard(
            title: settings.tr('Benta Ngayong Araw', 'Today\'s Sales'),
            value: CurrencyFormatter.format(todaySales, currencySymbol),
            subtitle: settings.tr('Pang-araw-araw na benta', 'Daily sales total'),
            icon: Icons.monetization_on_rounded,
            iconColor: AppColors.primary,
            bgColor: AppColors.surfaceLight,
          );

          final cardTodayProfit = _buildKpiCard(
            title: settings.tr('Kita sa Benta (Gross)', 'Today\'s Gross Profit'),
            value: CurrencyFormatter.format(todayProfit, currencySymbol),
            subtitle: settings.tr('Tubo bago ibawas ang gastos', 'Profit before expenses'),
            icon: Icons.show_chart_rounded,
            iconColor: Colors.teal.shade800,
            bgColor: Colors.teal.shade50,
          );

          final cardTodayExpenses = _buildKpiCard(
            title: settings.tr('Gastos Ngayong Araw', 'Today\'s Expenses'),
            value: CurrencyFormatter.format(todayExpenses, currencySymbol),
            subtitle: settings.tr('Kabuuang gastos ngayon', 'Operational expenses today'),
            icon: Icons.money_off_rounded,
            iconColor: Colors.red.shade800,
            bgColor: Colors.red.shade50,
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const ExpensesScreen()),
              );
            },
          );

          final cardTodayNetProfit = _buildKpiCard(
            title: settings.tr('Tunay na Kita (Net)', 'Today\'s Net Profit'),
            value: CurrencyFormatter.format(todayNetProfit, currencySymbol),
            subtitle: settings.tr('Kita matapos ibawas ang gastos', 'Profit after expenses'),
            icon: Icons.account_balance_rounded,
            iconColor: Colors.indigo.shade800,
            bgColor: Colors.indigo.shade50,
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const ExpensesScreen()),
              );
            },
          );

          final cardTotalProducts = _buildKpiCard(
            title: settings.tr('Mga Produkto', 'Total Products'),
            value: settings.tr('$totalProducts uri', '$totalProducts items'),
            subtitle: settings.tr('Naka-rehistro sa tindahan', 'Registered in inventory'),
            icon: Icons.inventory_rounded,
            iconColor: Colors.orange.shade800,
            bgColor: Colors.orange.shade50,
          );

          final cardInventoryValue = _buildKpiCard(
            title: settings.tr('Halaga ng Stocks', 'Inventory Value'),
            value: CurrencyFormatter.format(inventoryValue, currencySymbol),
            subtitle: settings.tr('Kabuuang puhunan', 'Total inventory cost'),
            icon: Icons.account_balance_wallet_rounded,
            iconColor: Colors.blue.shade800,
            bgColor: Colors.blue.shade50,
          );

          final cardLowStockAlert = _buildKpiCard(
            title: settings.tr('Kulang sa Stock', 'Low Stock Alert'),
            value: '$lowStockCount item/s',
            subtitle: lowStockCount > 0
                ? settings.tr('Dapat mag-restock! Tap para tingnan.', 'Needs restocking! Tap to view.')
                : settings.tr('Lahat ay may sapat na stock.', 'All products have sufficient stock.'),
            icon: Icons.warning_amber_rounded,
            iconColor: lowStockCount > 0
                ? Colors.red.shade800
                : Colors.green.shade800,
            bgColor: lowStockCount > 0
                ? Colors.red.shade50
                : Colors.green.shade50,
            hasAlert: lowStockCount > 0,
            onTap: () {
              final filterProv = Provider.of<ProductFilterProvider>(
                context,
                listen: false,
              );
              final navProv = Provider.of<NavigationProvider>(
                context,
                listen: false,
              );
              filterProv.setShowOnlyLowStock(true);
              filterProv.setSelectedCategory('All');
              navProv.setTabIndex(1); // Switch to Product List Screen
            },
          );

          Widget kpiSection;
          if (isTablet) {
            kpiSection = Column(
              children: [
                Row(
                  children: [
                    Expanded(child: cardTodaySales),
                    const SizedBox(width: 12),
                    Expanded(child: cardTodayProfit),
                    const SizedBox(width: 12),
                    Expanded(child: cardTodayExpenses),
                    const SizedBox(width: 12),
                    Expanded(child: cardTodayNetProfit),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(child: cardTotalProducts),
                    const SizedBox(width: 12),
                    Expanded(child: cardInventoryValue),
                    const SizedBox(width: 12),
                    Expanded(child: cardLowStockAlert),
                  ],
                ),
              ],
            );
          } else {
            kpiSection = Column(
              children: [
                Row(
                  children: [
                    Expanded(child: cardTodaySales),
                    const SizedBox(width: 12),
                    Expanded(child: cardTodayProfit),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(child: cardTodayExpenses),
                    const SizedBox(width: 12),
                    Expanded(child: cardTodayNetProfit),
                  ],
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(child: cardTotalProducts),
                    const SizedBox(width: 12),
                    Expanded(child: cardInventoryValue),
                  ],
                ),
                const SizedBox(height: 12),
                cardLowStockAlert,
              ],
            );
          }

          Widget chartAndAlertsSection;
          if (isTablet) {
            chartAndAlertsSection = Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  flex: 5,
                  child: _buildSalesChart(
                    provider.salesHistoryLast7Days,
                    currencySymbol,
                    settings,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  flex: 4,
                  child: _buildLowStockAlerts(context, provider, settings),
                ),
              ],
            );
          } else {
            chartAndAlertsSection = Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _buildSalesChart(
                  provider.salesHistoryLast7Days,
                  currencySymbol,
                  settings,
                ),
                const SizedBox(height: 16),
                _buildLowStockAlerts(context, provider, settings),
              ],
            );
          }

          return SingleChildScrollView(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Welcome tag
                Text(
                  settings.tr('Kamusta, Negosyante! 👋', 'Hello, Store Owner! 👋'),
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: Colors.black87,
                  ),
                ),
                Text(
                  settings.tr('Narito ang buod ng iyong tindahan ngayong araw.', 'Here is your store summary for today.'),
                  style: TextStyle(fontSize: 13, color: Colors.grey[600]),
                ),
                const SizedBox(height: 16),
                _buildBackupWarningBanner(context, settings),

                // KPI Section
                kpiSection,
                const SizedBox(height: 16),

                // Chart and Alerts Section
                chartAndAlertsSection,
                const SizedBox(height: 24),
              ],
            ),
          );
        },
      ),
    );
  }

  // KPI Card Builder
  Widget _buildKpiCard({
    required String title,
    required String value,
    required String subtitle,
    required IconData icon,
    required Color iconColor,
    required Color bgColor,
    bool hasAlert = false,
    VoidCallback? onTap,
  }) {
    return Card(
      elevation: 1,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(15),
        side: BorderSide(
          color: hasAlert ? Colors.red.shade300 : Colors.grey.shade200,
          width: hasAlert ? 1.5 : 1,
        ),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(15),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  // Smaller title
                  Expanded(
                    child: Text(
                      title,
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: Colors.grey,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  // Icon container
                  Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: bgColor,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(icon, color: iconColor, size: 20),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              FittedBox(
                fit: BoxFit.scaleDown,
                alignment: Alignment.centerLeft,
                child: Text(
                  value,
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: hasAlert ? Colors.red.shade900 : Colors.black87,
                  ),
                ),
              ),
              const SizedBox(height: 4),
              Text(
                subtitle,
                style: TextStyle(
                  fontSize: 11,
                  color: hasAlert ? Colors.red.shade800 : Colors.grey[600],
                  fontWeight: hasAlert ? FontWeight.bold : FontWeight.normal,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // Custom 7-Day Sales Trend Bar Chart Widget
  Widget _buildSalesChart(List<SalesChartData> data, String currencySymbol, SettingsProvider settings) {
    // Find maximum amount to scale heights
    double maxAmount = 100.0; // default minimum roof
    for (var d in data) {
      if (d.amount > maxAmount) {
        maxAmount = d.amount;
      }
    }

    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  settings.tr('Benta sa Nakaraang 7 Araw', 'Last 7 Days Sales'),
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: Colors.black87,
                  ),
                ),
                Text(
                  settings.tr('Lingguhang Trend', 'Weekly Trend'),
                  style: TextStyle(fontSize: 11, color: Colors.grey[500]),
                ),
              ],
            ),
            const SizedBox(height: 20),
            // Chart bars row
            SizedBox(
              height: 120,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                crossAxisAlignment: CrossAxisAlignment.end,
                children: data.map((d) {
                  // Calculate height ratio (max height is 90px)
                  final ratio = maxAmount > 0 ? d.amount / maxAmount : 0.0;
                  final barHeight = 80 * ratio;

                  return Expanded(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        // Tooltip-like value above bar (only show if amount > 0)
                        if (d.amount > 0)
                          FittedBox(
                            fit: BoxFit.scaleDown,
                            child: Text(
                              '$currencySymbol${d.amount.toStringAsFixed(0)}',
                              style: const TextStyle(
                                fontSize: 9,
                                fontWeight: FontWeight.bold,
                                color: AppColors.primary,
                              ),
                            ),
                          )
                        else
                          Text(
                            '${currencySymbol}0',
                            style: const TextStyle(
                              fontSize: 9,
                              color: Colors.grey,
                            ),
                          ),
                        const SizedBox(height: 4),

                        // The rounded bar
                        Container(
                          height: barHeight < 5
                              ? 5
                              : barHeight, // ensure at least a small dot
                          margin: const EdgeInsets.symmetric(horizontal: 4),
                          decoration: BoxDecoration(
                            color: d.amount > 0
                                ? AppColors.secondary
                                : Colors.grey[300],
                            borderRadius: const BorderRadius.vertical(
                              top: Radius.circular(6),
                            ),
                            gradient: d.amount > 0
                                ? const LinearGradient(
                                    colors: [
                                      AppColors.secondary,
                                      Color(0xFF81C784),
                                    ],
                                    begin: Alignment.bottomCenter,
                                    end: Alignment.topCenter,
                                  )
                                : null,
                          ),
                        ),
                        const SizedBox(height: 6),

                        // Day label (Mon, Tue...)
                        Text(
                          d.day,
                          style: const TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            color: Colors.black87,
                          ),
                        ),
                      ],
                    ),
                  );
                }).toList(),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // Dashboard Low Stock Alert Tiles
  Widget _buildLowStockAlerts(
    BuildContext context,
    InventoryProvider provider,
    SettingsProvider settings,
  ) {
    final lowStockItems = provider.lowStockProducts;

    return Card(
      elevation: 1,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.warning_amber_rounded, color: Colors.red[800]),
                const SizedBox(width: 8),
                Text(
                  settings.tr('Mga Produktong Paubos Na', 'Low Stock Products'),
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                    color: Colors.black87,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (lowStockItems.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 16),
                child: Center(
                  child: Text(
                    settings.tr('Walang mababang stock. Maganda ang takbo ng imbentaryo!', 'No low stock items. Inventory is in great shape!'),
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.grey[600], fontSize: 13),
                  ),
                ),
              )
            else
              ListView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: lowStockItems.length > 5
                    ? 5
                    : lowStockItems.length, // limit to top 5
                itemBuilder: (context, index) {
                  final prod = lowStockItems[index];
                  return Container(
                    margin: const EdgeInsets.symmetric(vertical: 4),
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.red.shade50,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: Colors.red.shade100),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                prod.name,
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 13,
                                ),
                              ),
                              Text(
                                'Kasalukuyan: ${prod.currentStock} ${prod.unit} (Alert Limit: ${prod.minStockThreshold})',
                                style: TextStyle(
                                  fontSize: 11,
                                  color: Colors.red.shade800,
                                ),
                              ),
                            ],
                          ),
                        ),
                        ElevatedButton.icon(
                          onPressed: () {
                            // Quick Restock action navigates to StockIn with this product selected!
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (context) =>
                                    StockInScreen(preSelectedProduct: prod),
                              ),
                            );
                          },
                          icon: const Icon(Icons.add, size: 12),
                          label: const Text(
                            'Stock In',
                            style: TextStyle(fontSize: 11),
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.primary,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 0,
                            ),
                            minimumSize: const Size(60, 28),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(6),
                            ),
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
            if (lowStockItems.length > 5)
              Align(
                alignment: Alignment.center,
                child: Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    'At iba pang ${lowStockItems.length - 5} item/s. Tingnan sa listahan.',
                    style: const TextStyle(fontSize: 11, color: Colors.grey),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildBackupWarningBanner(BuildContext context, SettingsProvider settings) {
    bool showWarning = false;
    String warningMessage = '';

    if (!settings.autoBackupEnabled) {
      showWarning = true;
      warningMessage = settings.tr(
        'Naka-disable ang auto-backup! I-enable ito sa Settings upang maiwasan ang mawalan ng data.',
        'Auto-backup is disabled! Enable it in Settings to secure your store data from loss.',
      );
    } else if (settings.lastAutoBackupDate.isNotEmpty) {
      try {
        final lastBackup = DateTime.parse(settings.lastAutoBackupDate);
        final today = DateTime.now();
        final diff = today.difference(lastBackup).inDays;
        if (diff >= 7) {
          showWarning = true;
          warningMessage = settings.tr(
            'Higit sa 7 araw na ang nakalipas mula noong huling backup. I-backup ang iyong data ngayon!',
            'Your last backup was over 7 days ago. Perform a backup now to secure your records!',
          );
        }
      } catch (_) {}
    } else {
      // Enabled but never backed up
      showWarning = true;
      warningMessage = settings.tr(
        'Gumawa ng iyong unang database backup ngayon upang masigurong ligtas ang iyong data.',
        'Perform your first database backup now to secure your inventory and sales data.',
      );
    }

    if (!showWarning) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.only(bottom: 16.0),
      child: Card(
        color: Colors.amber.shade50,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(10),
          side: BorderSide(color: Colors.amber.shade300),
        ),
        elevation: 0,
        child: Padding(
          padding: const EdgeInsets.all(12.0),
          child: Row(
            children: [
              Icon(Icons.warning_amber_rounded, color: Colors.amber.shade900),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      settings.tr('Babala sa Siguridad ng Data', 'Data Security Warning'),
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Colors.amber.shade900),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      warningMessage,
                      style: TextStyle(fontSize: 11, color: Colors.brown[900]),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              TextButton(
                onPressed: () {
                  // Navigate to backup export screen
                  SettingsScreen.navigate(context);
                },
                child: Text(
                  settings.tr('Ayusin', 'Fix Now'),
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: AppColors.primary),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
