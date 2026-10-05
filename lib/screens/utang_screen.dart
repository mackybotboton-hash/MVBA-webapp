import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../models/customer.dart';
import '../models/credit_transaction.dart';
import '../providers/inventory_provider.dart';
import '../providers/settings_provider.dart';
import '../widgets/app_empty_state.dart';
import '../widgets/app_toast.dart';
import '../utils/app_constants.dart';
import '../utils/currency_formatter.dart';
import '../widgets/app_drawer.dart';

class UtangScreen extends StatefulWidget {
  const UtangScreen({super.key});

  @override
  State<UtangScreen> createState() => _UtangScreenState();
}

class _UtangScreenState extends State<UtangScreen> {
  String _searchQuery = '';
  final TextEditingController _searchController = TextEditingController();

  void _showAddCustomerDialog(BuildContext context) {
    final nameController = TextEditingController();
    final phoneController = TextEditingController();
    final notesController = TextEditingController();
    final formKey = GlobalKey<FormState>();

    final settings = Provider.of<SettingsProvider>(context, listen: false);

    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          title: Text(settings.tr('Magdagdag ng Customer', 'Add Customer')),
          content: Form(
            key: formKey,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  TextFormField(
                    controller: nameController,
                    decoration: InputDecoration(
                      labelText: settings.tr('Pangalan (Name) *', 'Name *'),
                      prefixIcon: const Icon(Icons.person_outline),
                    ),
                    validator: (val) =>
                        val == null || val.trim().isEmpty ? settings.tr('Ilagay ang pangalan', 'Enter name') : null,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: phoneController,
                    decoration: InputDecoration(
                      labelText: settings.tr('Numero ng Telepono (Phone)', 'Phone Number'),
                      prefixIcon: const Icon(Icons.phone_outlined),
                    ),
                    keyboardType: TextInputType.phone,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: notesController,
                    decoration: InputDecoration(
                      labelText: settings.tr('Tala / Notes (Optional)', 'Notes (Optional)'),
                      prefixIcon: const Icon(Icons.note_alt_outlined),
                    ),
                    maxLines: 2,
                  ),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: Text(settings.tr('I-cancel', 'Cancel')),
            ),
            ElevatedButton(
              onPressed: () async {
                if (formKey.currentState!.validate()) {
                  final provider = Provider.of<InventoryProvider>(context, listen: false);
                  final customer = Customer(
                    name: nameController.text.trim(),
                    phone: phoneController.text.trim().isEmpty ? null : phoneController.text.trim(),
                    notes: notesController.text.trim().isEmpty ? null : notesController.text.trim(),
                    createdAt: DateTime.now(),
                  );
                  await provider.addCustomer(customer);
                  if (context.mounted) {
                    AppToast.success(context, settings.tr('Naidagdag ang customer!', 'Customer added successfully!'));
                    Navigator.pop(ctx);
                  }
                }
              },
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: Colors.white),
              child: Text(settings.tr('I-save', 'Save')),
            ),
          ],
        );
      },
    );
  }

  void _showCustomerDetailsBottomSheet(BuildContext context, Customer customer) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => CustomerDetailsSheet(customer: customer),
    );
  }

  @override
  Widget build(BuildContext context) {
    final provider = Provider.of<InventoryProvider>(context);
    final settings = Provider.of<SettingsProvider>(context);
    final currencySymbol = settings.currencySymbol;

    final filteredCustomers = provider.customers.where((cust) {
      return cust.name.toLowerCase().contains(_searchQuery.toLowerCase()) ||
          (cust.phone != null && cust.phone!.contains(_searchQuery));
    }).toList();

    return Scaffold(
      drawer: const AppDrawer(),
      appBar: AppBar(
        title: Text(
          settings.tr('Utang at Listahan ng Credit', 'Credit & Utang Ledger'),
          style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
        ),
        backgroundColor: AppColors.primary,
        elevation: 0,
      ),
      body: Column(
        children: [
          // KPI section
          Container(
            padding: const EdgeInsets.all(16),
            color: AppColors.primary.withOpacity(0.05),
            child: Row(
              children: [
                Expanded(
                  child: Card(
                    color: Colors.red.shade50,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                      side: BorderSide(color: Colors.red.shade100),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(12.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            settings.tr('Kabuuang Pautang', 'Total Outstanding'),
                            style: TextStyle(fontSize: 12, color: Colors.red.shade900, fontWeight: FontWeight.w600),
                          ),
                          const SizedBox(height: 4),
                          FittedBox(
                            fit: BoxFit.scaleDown,
                            child: Text(
                              CurrencyFormatter.format(provider.totalOutstandingCredit, currencySymbol),
                              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.red.shade900),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Card(
                    color: Colors.blue.shade50,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                      side: BorderSide(color: Colors.blue.shade100),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(12.0),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            settings.tr('May Utang na Customer', 'Active Debtors'),
                            style: TextStyle(fontSize: 12, color: Colors.blue.shade900, fontWeight: FontWeight.w600),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            '${provider.customersWithCreditCount} customer/s',
                            style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.blue.shade900),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Search bar
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: TextField(
              controller: _searchController,
              onChanged: (value) {
                setState(() {
                  _searchQuery = value;
                });
              },
              decoration: InputDecoration(
                hintText: settings.tr('Maghanap ng customer...', 'Search customer...'),
                prefixIcon: const Icon(Icons.search, color: AppColors.secondary),
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
                filled: true,
                fillColor: AppColors.searchFill,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
                contentPadding: const EdgeInsets.symmetric(vertical: 0),
              ),
            ),
          ),

          // Customer list
          Expanded(
            child: provider.customers.isEmpty
                ? AppEmptyState(
                    icon: Icons.people_outline_rounded,
                    title: settings.tr('Walang mga customer', 'No customers registered'),
                    description: settings.tr(
                      'Magdagdag ng mga customer upang masimulan ang pag-track ng credit o utang.',
                      'Add customers to begin tracking their credit ledger.',
                    ),
                    actionLabel: settings.tr('Magdagdag ng Customer', 'Add Customer'),
                    onAction: () => _showAddCustomerDialog(context),
                  )
                : filteredCustomers.isEmpty
                    ? Center(
                        child: Text(
                          settings.tr('Walang nahanap na customer.', 'No customers found.'),
                          style: TextStyle(color: Colors.grey[500]),
                        ),
                      )
                    : ListView.builder(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        itemCount: filteredCustomers.length,
                        itemBuilder: (context, index) {
                          final cust = filteredCustomers[index];
                          final balance = provider.getBalance(cust.id!);

                          return Card(
                            elevation: 0.5,
                            margin: const EdgeInsets.symmetric(vertical: 4),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(10),
                              side: BorderSide(
                                color: balance > 0 ? Colors.red.shade200 : Colors.grey.shade200,
                              ),
                            ),
                            child: ListTile(
                              leading: CircleAvatar(
                                backgroundColor: balance > 0 ? Colors.red.shade100 : Colors.green.shade100,
                                child: Icon(
                                  Icons.person,
                                  color: balance > 0 ? Colors.red.shade900 : Colors.green.shade900,
                                ),
                              ),
                              title: Text(cust.name, style: const TextStyle(fontWeight: FontWeight.bold)),
                              subtitle: Text(
                                cust.phone ?? settings.tr('Walang phone number', 'No phone number'),
                                style: const TextStyle(fontSize: 11),
                              ),
                              trailing: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  Text(
                                    balance > 0
                                         ? CurrencyFormatter.format(balance, currencySymbol)
                                        : settings.tr('Walang Utang', 'No balance'),
                                    style: TextStyle(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 14,
                                      color: balance > 0 ? Colors.red[800] : Colors.green[800],
                                    ),
                                  ),
                                  if (balance > 0)
                                    Text(
                                      settings.tr('Dapat Bayaran', 'Outstanding'),
                                      style: TextStyle(fontSize: 9, color: Colors.red[800], fontWeight: FontWeight.w600),
                                    ),
                                ],
                              ),
                              onTap: () => _showCustomerDetailsBottomSheet(context, cust),
                            ),
                          );
                        },
                      ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showAddCustomerDialog(context),
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        child: const Icon(Icons.person_add_rounded),
      ),
    );
  }
}

class CustomerDetailsSheet extends StatefulWidget {
  final Customer customer;
  const CustomerDetailsSheet({super.key, required this.customer});

  @override
  State<CustomerDetailsSheet> createState() => _CustomerDetailsSheetState();
}

class _CustomerDetailsSheetState extends State<CustomerDetailsSheet> {
  List<CreditTransaction> _history = [];
  bool _isLoading = true;
  double _balance = 0.0;

  @override
  void initState() {
    super.initState();
    _loadHistory();
  }

  Future<void> _loadHistory() async {
    final provider = Provider.of<InventoryProvider>(context, listen: false);
    final history = await provider.getCreditTransactionsForCustomer(widget.customer.id!);
    final balance = await provider.getCustomerBalance(widget.customer.id!);

    if (mounted) {
      setState(() {
        _history = history;
        _balance = balance;
        _isLoading = false;
      });
    }
  }

  void _showAddTransactionDialog(BuildContext context, String type) {
    final amountController = TextEditingController();
    final descController = TextEditingController();
    final formKey = GlobalKey<FormState>();

    final settings = Provider.of<SettingsProvider>(context, listen: false);
    final currencySymbol = settings.currencySymbol;
    final isPayment = type == 'payment';

    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          title: Text(
            isPayment
                ? settings.tr('Magtala ng Bayad (Log Payment)', 'Record Payment')
                : settings.tr('Magdagdag ng Utang (Add Debt)', 'Record Debt Adjustment'),
          ),
          content: Form(
            key: formKey,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextFormField(
                  controller: amountController,
                  decoration: InputDecoration(
                    labelText: '${settings.tr('Halaga (Amount)', 'Amount')} ($currencySymbol) *',
                    prefixIcon: const Icon(Icons.attach_money_rounded),
                  ),
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  validator: (val) {
                    if (val == null || val.trim().isEmpty) {
                      return settings.tr('Ilagay ang halaga', 'Enter amount');
                    }
                    final numAmount = double.tryParse(val);
                    if (numAmount == null || numAmount <= 0) {
                      return settings.tr('Dapat ay numero na higit sa 0', 'Must be a number greater than 0');
                    }
                    if (isPayment && numAmount > _balance) {
                      return settings.tr(
                        'Hindi pwedeng lumampas sa utang (Max: ${CurrencyFormatter.format(_balance, currencySymbol)})',
                        'Cannot exceed total debt (Max: ${CurrencyFormatter.format(_balance, currencySymbol)})',
                      );
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: descController,
                  decoration: InputDecoration(
                    labelText: settings.tr('Keterangan / Description', 'Description / Details'),
                    prefixIcon: const Icon(Icons.description_outlined),
                    hintText: isPayment
                        ? settings.tr('Hal. Bayad sa utang kanina', 'e.g. Paid partial balance')
                        : settings.tr('Hal. Adjustment, karagdagang kuha', 'e.g. Manual balance adjustment'),
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: Text(settings.tr('I-cancel', 'Cancel')),
            ),
            ElevatedButton(
              onPressed: () async {
                if (formKey.currentState!.validate()) {
                  final provider = Provider.of<InventoryProvider>(context, listen: false);
                  final tx = CreditTransaction(
                    customerId: widget.customer.id!,
                    type: type,
                    amount: double.parse(amountController.text),
                    description: descController.text.trim().isEmpty ? null : descController.text.trim(),
                    transactionDate: DateTime.now(),
                  );
                  await provider.addCreditTransaction(tx);
                  await _loadHistory();
                  if (context.mounted) {
                    AppToast.success(context, settings.tr('Matagumpay na naitala!', 'Successfully recorded!'));
                    Navigator.pop(ctx);
                  }
                }
              },
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: Colors.white),
              child: Text(settings.tr('I-save', 'Save')),
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

    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.only(
          topLeft: Radius.circular(20),
          topRight: Radius.circular(20),
        ),
      ),
      padding: EdgeInsets.only(
        top: 20,
        left: 16,
        right: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      height: MediaQuery.of(context).size.height * 0.85,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header handle
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey[350],
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Customer Profile Info
          Row(
            children: [
              CircleAvatar(
                radius: 24,
                backgroundColor: _balance > 0 ? Colors.red.shade100 : Colors.green.shade100,
                child: Icon(Icons.person, size: 28, color: _balance > 0 ? Colors.red[900] : Colors.green[900]),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.customer.name,
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    if (widget.customer.phone != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        widget.customer.phone!,
                        style: TextStyle(fontSize: 13, color: Colors.grey[600]),
                      ),
                    ],
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    CurrencyFormatter.format(_balance, currencySymbol),
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                      color: _balance > 0 ? Colors.red[800] : Colors.green[800],
                    ),
                  ),
                  Text(
                    settings.tr('Kasalukuyang Utang', 'Current Balance'),
                    style: TextStyle(fontSize: 10, color: Colors.grey[600], fontWeight: FontWeight.w500),
                  ),
                ],
              ),
            ],
          ),
          if (widget.customer.notes != null && widget.customer.notes!.isNotEmpty) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: Colors.grey[50],
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.grey.shade200),
              ),
              child: Row(
                children: [
                  const Icon(Icons.info_outline, size: 16, color: Colors.grey),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      widget.customer.notes!,
                      style: TextStyle(fontSize: 12, color: Colors.grey[700], fontStyle: FontStyle.italic),
                    ),
                  ),
                ],
              ),
            ),
          ],
          const Divider(height: 24),

          // Transaction History list
          Text(
            settings.tr('Kasaysayan ng Transaksyon', 'Transaction History'),
            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),

          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _history.isEmpty
                    ? Center(
                        child: Text(
                          settings.tr('Walang nakaraang transaksyon.', 'No previous transactions.'),
                          style: TextStyle(color: Colors.grey[500], fontSize: 13),
                        ),
                      )
                    : ListView.builder(
                        itemCount: _history.length,
                        itemBuilder: (context, index) {
                          final tx = _history[index];
                          final formattedDate = DateFormat('MMM dd, yyyy - hh:mm a').format(tx.transactionDate);
                          final isCredit = tx.isCredit;

                          return Container(
                            margin: const EdgeInsets.symmetric(vertical: 4),
                            decoration: BoxDecoration(
                              color: Colors.grey[50],
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: Colors.grey.shade100),
                            ),
                            child: ListTile(
                              dense: true,
                              leading: CircleAvatar(
                                backgroundColor: isCredit ? Colors.red.shade50 : Colors.green.shade50,
                                radius: 14,
                                child: Icon(
                                  isCredit ? Icons.arrow_upward_rounded : Icons.arrow_downward_rounded,
                                  size: 14,
                                  color: isCredit ? Colors.red[800] : Colors.green[800],
                                ),
                              ),
                              title: Text(
                                tx.description ??
                                    (isCredit
                                        ? settings.tr('Utang (Purchased on credit)', 'Credit purchase')
                                        : settings.tr('Bayad sa Utang', 'Balance payment')),
                                style: const TextStyle(fontWeight: FontWeight.w600),
                              ),
                              subtitle: Text(formattedDate, style: const TextStyle(fontSize: 10)),
                              trailing: Text(
                                '${isCredit ? "+" : "-"}${CurrencyFormatter.format(tx.amount, currencySymbol)}',
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  fontSize: 13,
                                  color: isCredit ? Colors.red[800] : Colors.green[800],
                                ),
                              ),
                            ),
                          );
                        },
                      ),
          ),

          const SizedBox(height: 16),

          // Actions Panel
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _showAddTransactionDialog(context, 'credit'),
                  icon: const Icon(Icons.add_circle_outline),
                  label: Text(
                    settings.tr('Magdagdag ng Utang', 'Add Credit'),
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.red[800],
                    side: BorderSide(color: Colors.red.shade300),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: _balance <= 0 ? null : () => _showAddTransactionDialog(context, 'payment'),
                  icon: const Icon(Icons.check_circle_outline),
                  label: Text(
                    settings.tr('Magbayad (Pay)', 'Record Payment'),
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
