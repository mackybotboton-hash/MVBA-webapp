import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../models/expense.dart';
import '../utils/currency_formatter.dart';
import '../providers/inventory_provider.dart';
import '../providers/settings_provider.dart';
import '../widgets/app_empty_state.dart';
import '../widgets/app_toast.dart';
import '../widgets/app_drawer.dart';
import '../utils/app_constants.dart';

class ExpensesScreen extends StatefulWidget {
  const ExpensesScreen({super.key});

  @override
  State<ExpensesScreen> createState() => _ExpensesScreenState();
}

class _ExpensesScreenState extends State<ExpensesScreen> {
  int _selectedYear = DateTime.now().year;
  int _selectedMonth = DateTime.now().month;
  String _searchQuery = '';
  final TextEditingController _searchController = TextEditingController();

  final List<String> _categories = [
    'Utilities',
    'Travel/Transpo',
    'Rent',
    'Salaries',
    'Spoilage/Expired',
    'Others',
  ];

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  String _getCategoryLabel(String category, SettingsProvider settings) {
    if (settings.isEnglish) return category;
    switch (category) {
      case 'Utilities':
        return 'Kuryente/Tubig/Net (Utilities)';
      case 'Travel/Transpo':
        return 'Pasahe/Gasolina (Transpo)';
      case 'Rent':
        return 'Upa sa Pwesto (Rent)';
      case 'Salaries':
        return 'Pasahod sa Trabahante';
      case 'Spoilage/Expired':
        return 'Nasirang Paninda';
      case 'Others':
        return 'Iba pang Gastos';
      default:
        return category;
    }
  }

  IconData _getCategoryIcon(String category) {
    switch (category) {
      case 'Utilities':
        return Icons.lightbulb_outline_rounded;
      case 'Travel/Transpo':
        return Icons.local_shipping_outlined;
      case 'Rent':
        return Icons.home_work_outlined;
      case 'Salaries':
        return Icons.people_outline_rounded;
      case 'Spoilage/Expired':
        return Icons.delete_outline_rounded;
      case 'Others':
      default:
        return Icons.receipt_long_outlined;
    }
  }

  void _showAddExpenseDialog(BuildContext context, SettingsProvider settings) {
    final formKey = GlobalKey<FormState>();
    final descController = TextEditingController();
    final amountController = TextEditingController();
    String selectedCategory = _categories.first;
    DateTime expenseDate = DateTime.now();

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              title: Text(settings.tr('Magtala ng Gastos', 'Record Expense')),
              content: Form(
                key: formKey,
                child: SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // Description
                      TextFormField(
                        controller: descController,
                        decoration: InputDecoration(
                          labelText: settings.tr('Deskripsyon *', 'Description *'),
                          hintText: settings.tr('Hal: Kuryente ngayong buwan', 'e.g. Electric bill'),
                          border: const OutlineInputBorder(),
                        ),
                        validator: (value) => value == null || value.trim().isEmpty
                            ? settings.tr('Ilagay ang deskripsyon', 'Enter description')
                            : null,
                      ),
                      const SizedBox(height: 12),

                      // Amount
                      TextFormField(
                        controller: amountController,
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        decoration: InputDecoration(
                          labelText: settings.tr('Halaga (Amount) *', 'Amount *'),
                          prefixText: '${settings.currencySymbol} ',
                          border: const OutlineInputBorder(),
                        ),
                        validator: (value) {
                          if (value == null || value.isEmpty) {
                            return settings.tr('Ilagay ang halaga', 'Enter amount');
                          }
                          final parsed = double.tryParse(value);
                          if (parsed == null || parsed <= 0) {
                            return settings.tr('Dapat higit sa 0', 'Must be greater than 0');
                          }
                          return null;
                        },
                      ),
                      const SizedBox(height: 12),

                      // Category Dropdown
                      DropdownButtonFormField<String>(
                        value: selectedCategory,
                        decoration: InputDecoration(
                          labelText: settings.tr('Kategorya', 'Category'),
                          border: const OutlineInputBorder(),
                        ),
                        items: _categories.map((cat) {
                          return DropdownMenuItem<String>(
                            value: cat,
                            child: Text(_getCategoryLabel(cat, settings)),
                          );
                        }).toList(),
                        onChanged: (val) {
                          if (val != null) {
                            setDialogState(() {
                              selectedCategory = val;
                            });
                          }
                        },
                      ),
                      const SizedBox(height: 12),

                      // Date Selector Trigger
                      InkWell(
                        onTap: () async {
                          final picked = await showDatePicker(
                            context: context,
                            initialDate: expenseDate,
                            firstDate: DateTime.now().subtract(const Duration(days: 365)),
                            lastDate: DateTime.now().add(const Duration(days: 365)),
                          );
                          if (picked != null) {
                            setDialogState(() {
                              expenseDate = picked;
                            });
                          }
                        },
                        child: InputDecorator(
                          decoration: InputDecoration(
                            labelText: settings.tr('Petsa ng Gastos', 'Expense Date'),
                            border: const OutlineInputBorder(),
                            prefixIcon: const Icon(Icons.calendar_today, size: 18),
                          ),
                          child: Text(DateFormat('MMMM dd, yyyy').format(expenseDate)),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(dialogContext),
                  child: Text(settings.tr('I-cancel', 'Cancel')),
                ),
                ElevatedButton(
                  onPressed: () async {
                    if (!formKey.currentState!.validate()) return;
                    
                    final expense = Expense(
                      description: descController.text.trim(),
                      amount: double.parse(amountController.text),
                      category: selectedCategory,
                      expenseDate: expenseDate,
                    );

                    final provider = Provider.of<InventoryProvider>(context, listen: false);
                    await provider.addExpense(expense);

                    if (dialogContext.mounted) {
                      Navigator.pop(dialogContext);
                      AppToast.success(
                        context,
                        settings.tr('Matagumpay na naitala ang gastos!', 'Expense recorded successfully!'),
                      );
                    }
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                  ),
                  child: Text(settings.tr('I-save', 'Save')),
                ),
              ],
            );
          },
        );
      },
    );
  }

  void _confirmDeleteExpense(BuildContext context, int expenseId, String desc, SettingsProvider settings) {
    showDialog(
      context: context,
      builder: (dialogContext) {
        return AlertDialog(
          title: Text(settings.tr('Burahin ang Gastos', 'Delete Expense')),
          content: Text(settings.tr(
            'Sigurado ka bang buburahin ang gastos na "$desc"? Hindi na ito maibabalik.',
            'Are you sure you want to delete the expense "$desc"? This action cannot be undone.',
          )),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialogContext),
              child: Text(settings.tr('I-cancel', 'Cancel')),
            ),
            ElevatedButton(
              onPressed: () async {
                final provider = Provider.of<InventoryProvider>(context, listen: false);
                await provider.deleteExpense(expenseId);
                if (dialogContext.mounted) {
                  Navigator.pop(dialogContext);
                  AppToast.success(
                    context,
                    settings.tr('Nabura na ang record ng gastos.', 'Expense record deleted.'),
                  );
                }
              },
              style: ElevatedButton.styleFrom(backgroundColor: Colors.red[800], foregroundColor: Colors.white),
              child: Text(settings.tr('Burahin', 'Delete')),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final settings = Provider.of<SettingsProvider>(context);
    final currencySymbol = settings.currencySymbol;

    return Scaffold(
      drawer: const AppDrawer(currentRoute: 'expenses'),
      appBar: AppBar(
        title: Text(
          settings.tr('Talaan ng Gastos (Expenses)', 'Expenses Ledger'),
          style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
        ),
        backgroundColor: AppColors.primary,
        elevation: 0,
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showAddExpenseDialog(context, settings),
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        child: const Icon(Icons.add),
      ),
      body: Consumer<InventoryProvider>(
        builder: (context, provider, child) {
          // Filter expenses locally by selected Month, Year and Search Query
          final filteredExpenses = provider.expenses.where((exp) {
            final matchesYear = exp.expenseDate.year == _selectedYear;
            final matchesMonth = _selectedMonth == 0 || exp.expenseDate.month == _selectedMonth;
            if (!matchesYear || !matchesMonth) return false;

            if (_searchQuery.isEmpty) return true;
            final descMatches = exp.description.toLowerCase().contains(_searchQuery.toLowerCase());
            final catMatches = _getCategoryLabel(exp.category, settings).toLowerCase().contains(_searchQuery.toLowerCase());
            return descMatches || catMatches;
          }).toList();

          // Calculate total amount for the filtered period
          final totalPeriodExpenses = filteredExpenses.fold<double>(0.0, (sum, item) => sum + item.amount);

          final isTablet = MediaQuery.of(context).size.width >= 768;

          Widget headerSection = Card(
            elevation: 3,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
            color: const Color(0xFFFFF1F0), // Subtle reddish tone indicating outflow / expense
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 24,
                    backgroundColor: Colors.red.shade100,
                    child: Icon(Icons.trending_down_rounded, color: Colors.red[800], size: 28),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          settings.tr('Kabuuang Gastos sa Piniling Buwan:', 'Total Period Expenses:'),
                          style: TextStyle(fontSize: 12, color: Colors.red[900], fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          CurrencyFormatter.format(totalPeriodExpenses, currencySymbol),
                          style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Colors.red[900]),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          );

          Widget filterPane = Card(
            elevation: 2,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            child: Padding(
              padding: const EdgeInsets.all(12.0),
              child: Column(
                children: [
                  // Month and Year Row
                  Row(
                    children: [
                      // Month Dropdown
                      Expanded(
                        flex: 3,
                        child: DropdownButtonFormField<int>(
                          value: _selectedMonth,
                          isExpanded: true,
                          decoration: InputDecoration(
                            labelText: settings.tr('Buwan', 'Month'),
                            contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                            border: const OutlineInputBorder(),
                          ),
                          items: [
                            DropdownMenuItem<int>(
                              value: 0, 
                              child: Text(
                                settings.tr('Lahat ng Buwan', 'All Months'),
                                style: const TextStyle(fontSize: 12),
                              ),
                            ),
                            ...List.generate(12, (index) {
                              final monthNum = index + 1;
                              final monthTagalog = [
                                'Enero', 'Pebrero', 'Marso', 'Abril', 'Mayo', 'Hunyo',
                                'Hulyo', 'Agosto', 'Setyembre', 'Oktubre', 'Nobyembre', 'Disyembre'
                              ][index];
                              final monthEnglish = [
                                'January', 'February', 'March', 'April', 'May', 'June',
                                'July', 'August', 'September', 'October', 'November', 'December'
                              ][index];
                              return DropdownMenuItem<int>(
                                value: monthNum,
                                child: Text(
                                  settings.tr(monthTagalog, monthEnglish),
                                  style: const TextStyle(fontSize: 12),
                                ),
                              );
                            }),
                          ],
                          onChanged: (val) {
                            if (val != null) {
                              setState(() {
                                _selectedMonth = val;
                              });
                            }
                          },
                        ),
                      ),
                      const SizedBox(width: 8),
                      // Year Dropdown
                      Expanded(
                        flex: 2,
                        child: DropdownButtonFormField<int>(
                          value: _selectedYear,
                          isExpanded: true,
                          decoration: InputDecoration(
                            labelText: settings.tr('Taon', 'Year'),
                            contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                            border: const OutlineInputBorder(),
                          ),
                          items: List.generate(5, (index) {
                            final yearNum = DateTime.now().year - index;
                            return DropdownMenuItem<int>(
                              value: yearNum,
                              child: Text(
                                '$yearNum',
                                style: const TextStyle(fontSize: 12),
                              ),
                            );
                          }),
                          onChanged: (val) {
                            if (val != null) {
                              setState(() {
                                _selectedYear = val;
                              });
                            }
                          },
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  // Search TextField
                  TextField(
                    controller: _searchController,
                    decoration: InputDecoration(
                      hintText: settings.tr('Maghanap ng gastos...', 'Search expenses...'),
                      prefixIcon: const Icon(Icons.search, size: 20),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      border: const OutlineInputBorder(),
                      suffixIcon: _searchQuery.isNotEmpty
                          ? IconButton(
                              icon: const Icon(Icons.clear_rounded, color: Colors.grey, size: 20),
                              onPressed: () {
                                setState(() {
                                  _searchQuery = '';
                                  _searchController.clear();
                                });
                              },
                            )
                          : null,
                    ),
                    onChanged: (val) {
                      setState(() {
                        _searchQuery = val;
                      });
                    },
                  ),
                ],
              ),
            ),
          );

          Widget listSection = Expanded(
            child: filteredExpenses.isEmpty
                ? AppEmptyState(
                    icon: Icons.money_off_rounded,
                    title: settings.tr('Walang nakatalang gastos', 'No expense records'),
                    description: _searchQuery.isEmpty
                        ? settings.tr('I-tap ang "+" button sa ibaba para magtala ng bayad sa kuryente, pasahe, upa, atbp.', 'Tap "+" to record electric bills, transport, rent, etc.')
                        : settings.tr('Walang tumutugma sa iyong paghahanap.', 'No expenses matched your search query.'),
                  )
                : ListView.builder(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    itemCount: filteredExpenses.length,
                    itemBuilder: (context, index) {
                      final item = filteredExpenses[index];
                      final dateFormatted = DateFormat('MMM dd, yyyy').format(item.expenseDate);

                      return Card(
                        elevation: 1,
                        margin: const EdgeInsets.symmetric(vertical: 4),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        child: ListTile(
                          leading: CircleAvatar(
                            backgroundColor: Colors.red.shade50,
                            child: Icon(_getCategoryIcon(item.category), color: Colors.red[800]),
                          ),
                          title: Text(
                            item.description,
                            style: const TextStyle(fontWeight: FontWeight.bold),
                          ),
                          subtitle: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                _getCategoryLabel(item.category, settings),
                                style: const TextStyle(fontSize: 12),
                              ),
                              Text(
                                dateFormatted,
                                style: TextStyle(fontSize: 10, color: Colors.grey[600]),
                              ),
                            ],
                          ),
                          trailing: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                '-${CurrencyFormatter.format(item.amount, currencySymbol)}',
                                style: TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.bold,
                                  color: Colors.red[900],
                                ),
                              ),
                              const SizedBox(width: 4),
                              IconButton(
                                icon: Icon(Icons.delete_outline_rounded, color: Colors.grey[500], size: 20),
                                onPressed: () => _confirmDeleteExpense(
                                  context,
                                  item.id!,
                                  item.description,
                                  settings,
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
          );

          if (isTablet) {
            return Padding(
              padding: const EdgeInsets.all(16.0),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Sidebar filters + summary card
                  SizedBox(
                    width: 320,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        headerSection,
                        const SizedBox(height: 12),
                        filterPane,
                      ],
                    ),
                  ),
                  const SizedBox(width: 16),
                  const VerticalDivider(width: 1, thickness: 1),
                  const SizedBox(width: 16),
                  // List
                  listSection,
                ],
              ),
            );
          }

          // Mobile View
          return Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                headerSection,
                const SizedBox(height: 8),
                filterPane,
                const SizedBox(height: 8),
                listSection,
              ],
            ),
          );
        },
      ),
    );
  }
}
