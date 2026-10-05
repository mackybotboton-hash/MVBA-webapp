import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/cart_item.dart';
import '../models/customer.dart';
import '../providers/inventory_provider.dart';
import '../providers/settings_provider.dart';
import '../utils/app_constants.dart';
import '../widgets/app_toast.dart';

/// Self-contained checkout confirmation dialog.
/// Displays cart summary, and allows checkout via Cash or Credit (Utang).
class CheckoutDialog extends StatefulWidget {
  final Map<int, CartItem> cart;
  final double total;
  final String currencySymbol;

  const CheckoutDialog({
    super.key,
    required this.cart,
    required this.total,
    required this.currencySymbol,
  });

  @override
  State<CheckoutDialog> createState() => _CheckoutDialogState();
}

class _CheckoutDialogState extends State<CheckoutDialog> {
  // Payment Type: 'cash' or 'credit'
  String _paymentType = 'cash';

  // Cash payment fields
  late final TextEditingController _paymentController;
  late final FocusNode _paymentFocusNode;
  double _paymentVal = 0.0;

  // Credit (Utang) fields
  Customer? _selectedCustomer;

  @override
  void initState() {
    super.initState();
    _paymentVal = widget.total;
    _paymentController = TextEditingController(
      text: widget.total % 1 == 0 ? widget.total.toInt().toString() : widget.total.toStringAsFixed(2),
    );
    _paymentFocusNode = FocusNode();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_paymentFocusNode.canRequestFocus) {
        _paymentFocusNode.requestFocus();
        _paymentController.selection = TextSelection(
          baseOffset: 0,
          extentOffset: _paymentController.text.length,
        );
      }
    });
  }

  @override
  void dispose() {
    _paymentController.dispose();
    _paymentFocusNode.dispose();
    super.dispose();
  }

  void _showAddCustomerInlineDialog(BuildContext context, SettingsProvider settings) {
    final nameController = TextEditingController();
    final phoneController = TextEditingController();
    final notesController = TextEditingController();
    final formKey = GlobalKey<FormState>();

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
                      labelText: settings.tr('Pangalan *', 'Name *'),
                      prefixIcon: const Icon(Icons.person_outline),
                    ),
                    validator: (val) =>
                        val == null || val.trim().isEmpty ? settings.tr('Ilagay ang pangalan', 'Enter name') : null,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: phoneController,
                    decoration: InputDecoration(
                      labelText: settings.tr('Numero ng Telepono', 'Phone Number'),
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
                  final newId = await provider.addCustomer(customer);
                  
                  if (context.mounted) {
                    setState(() {
                      // Fetch the freshly created customer object
                      final newCust = provider.customers.firstWhere((c) => c.id == newId, orElse: () => customer);
                      _selectedCustomer = newCust;
                    });
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

  @override
  Widget build(BuildContext context) {
    final settings = Provider.of<SettingsProvider>(context);
    final provider = Provider.of<InventoryProvider>(context);
    
    final double changeVal = _paymentVal - widget.total;
    final bool isCashCheckoutEnabled = _paymentVal >= widget.total;
    final bool isCreditCheckoutEnabled = _selectedCustomer != null;

    return AlertDialog(
      title: Text.rich(
        TextSpan(
          children: [
            const WidgetSpan(
              alignment: PlaceholderAlignment.middle,
              child: Icon(Icons.shopping_cart_checkout_rounded, color: AppColors.primary),
            ),
            const WidgetSpan(child: SizedBox(width: 8)),
            TextSpan(text: settings.tr('Kumpirmahin ang Benta', 'Confirm Sale')),
          ],
        ),
      ),
      content: SizedBox(
        width: double.maxFinite,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // 1. Sale type selection selector
              Row(
                children: [
                  Expanded(
                    child: ChoiceChip(
                      label: Container(
                        alignment: Alignment.center,
                        child: Text(
                          settings.tr('💵 Cash', '💵 Cash'),
                          style: TextStyle(
                            color: _paymentType == 'cash' ? Colors.white : AppColors.primary,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      selected: _paymentType == 'cash',
                      onSelected: (val) {
                        if (val) {
                          setState(() {
                            _paymentType = 'cash';
                          });
                        }
                      },
                      selectedColor: AppColors.primary,
                      backgroundColor: Colors.grey[100],
                      showCheckmark: false,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: ChoiceChip(
                      label: Container(
                        alignment: Alignment.center,
                        child: Text(
                          settings.tr('📝 Utang (Credit)', '📝 Credit (Utang)'),
                          style: TextStyle(
                            color: _paymentType == 'credit' ? Colors.white : AppColors.primary,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      selected: _paymentType == 'credit',
                      onSelected: (val) {
                        if (val) {
                          setState(() {
                            _paymentType = 'credit';
                          });
                        }
                      },
                      selectedColor: AppColors.primary,
                      backgroundColor: Colors.grey[100],
                      showCheckmark: false,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),

              const Text(
                'Buod ng Transaksyon:',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
              ),
              const SizedBox(height: 4),
              ConstrainedBox(
                constraints: const BoxConstraints(maxHeight: 100),
                child: ListView.builder(
                  shrinkWrap: true,
                  itemCount: widget.cart.values.length,
                  itemBuilder: (context, index) {
                    final item = widget.cart.values.elementAt(index);
                    return Padding(
                      padding: const EdgeInsets.symmetric(vertical: 2.0),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Text(
                              '${item.product.name} (x${item.quantity % 1 == 0 ? item.quantity.toInt() : item.quantity})',
                              style: const TextStyle(fontSize: 12),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          Text(
                            '${widget.currencySymbol}${item.totalPrice.toStringAsFixed(2)}',
                            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ),
              const Divider(height: 16, thickness: 1),

              // 2. Conditional Section based on Payment Type
              if (_paymentType == 'cash') ...[
                // Bayad Section
                const Text(
                  'Bayad ng Customer:',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                ),
                const SizedBox(height: 6),
                TextField(
                  controller: _paymentController,
                  focusNode: _paymentFocusNode,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: InputDecoration(
                    labelText: 'Ibayad ng Customer (${widget.currencySymbol})',
                    hintText: 'Ilagay ang bayad...',
                    border: const OutlineInputBorder(),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                  ),
                  onChanged: (val) {
                    final sanitized = val.replaceAll(',', '.');
                    setState(() {
                      _paymentVal = double.tryParse(sanitized) ?? 0.0;
                    });
                  },
                ),
                const SizedBox(height: 8),

                // Quick Cash Buttons
                Wrap(
                  spacing: 4,
                  runSpacing: 4,
                  children: [
                    SizedBox(
                      height: 32,
                      child: OutlinedButton(
                        onPressed: () {
                          final valStr = widget.total % 1 == 0 ? widget.total.toInt().toString() : widget.total.toStringAsFixed(2);
                          _paymentController.text = valStr;
                          setState(() {
                            _paymentVal = widget.total;
                          });
                        },
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(horizontal: 8),
                          side: const BorderSide(color: AppColors.secondary),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                        ),
                        child: const Text(
                          'Eksaktong Bayad',
                          style: TextStyle(fontWeight: FontWeight.bold, color: AppColors.secondary, fontSize: 11),
                        ),
                      ),
                    ),
                    ...[20, 50, 100, 200, 500, 1000].map((bill) {
                      return SizedBox(
                        height: 32,
                        child: OutlinedButton(
                          onPressed: () {
                            _paymentController.text = bill.toString();
                            setState(() {
                              _paymentVal = bill.toDouble();
                            });
                          },
                          style: OutlinedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(horizontal: 8),
                            side: const BorderSide(color: AppColors.primary),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                          ),
                          child: Text(
                            '${widget.currencySymbol}$bill',
                            style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.primary, fontSize: 11),
                          ),
                        ),
                      );
                    }),
                  ],
                ),
              ] else ...[
                // Utang (Credit) Customer Selector Section
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Pumili ng Customer:',
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                    ),
                    TextButton.icon(
                      onPressed: () => _showAddCustomerInlineDialog(context, settings),
                      icon: const Icon(Icons.person_add_alt_1_outlined, size: 14),
                      label: Text(
                        settings.tr('Bagong Customer', 'New Customer'),
                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                      ),
                      style: TextButton.styleFrom(
                        padding: EdgeInsets.zero,
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                provider.customers.isEmpty
                    ? Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Colors.red.shade50,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: Colors.red.shade100),
                        ),
                        child: Text(
                          settings.tr(
                            'Walang rehistradong customer. Pindutin ang "+ Bagong Customer" sa taas para magdagdag.',
                            'No registered customers. Tap "+ New Customer" above to add one.',
                          ),
                          style: TextStyle(fontSize: 12, color: Colors.red.shade900),
                        ),
                      )
                    : DropdownButtonFormField<Customer>(
                        value: _selectedCustomer,
                        isExpanded: true,
                        decoration: const InputDecoration(
                          labelText: 'Pumili ng Customer *',
                          border: OutlineInputBorder(),
                          contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                          prefixIcon: Icon(Icons.person_outline),
                        ),
                        items: provider.customers.map((cust) {
                          final balance = provider.getBalance(cust.id!);
                          final balanceStr = balance > 0
                              ? ' (${settings.tr("Utang: ", "Debt: ")}${widget.currencySymbol}${balance.toStringAsFixed(2)})'
                              : '';
                          return DropdownMenuItem<Customer>(
                            value: cust,
                            child: Text(
                              '${cust.name}$balanceStr',
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontSize: 13),
                            ),
                          );
                        }).toList(),
                        onChanged: (val) {
                          setState(() {
                            _selectedCustomer = val;
                          });
                        },
                      ),
              ],

              const Divider(height: 16, thickness: 1),

              // Total & summary
              Table(
                defaultVerticalAlignment: TableCellVerticalAlignment.middle,
                columnWidths: const {
                  0: FlexColumnWidth(),
                  1: IntrinsicColumnWidth(),
                },
                children: [
                  TableRow(
                    children: [
                      const Text(
                        'Kabuoan (Total):',
                        style: TextStyle(fontWeight: FontWeight.w500, fontSize: 13),
                      ),
                      Text(
                        '${widget.currencySymbol}${widget.total.toStringAsFixed(2)}',
                        textAlign: TextAlign.right,
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 15,
                          color: AppColors.primary,
                        ),
                      ),
                    ],
                  ),
                  if (_paymentType == 'cash')
                    TableRow(
                      children: [
                        const Text(
                          'Sukli (Change):',
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                        ),
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 4.0),
                          child: Text(
                            _paymentVal < widget.total
                                ? 'Hindi sapat ang bayad'
                                : (_paymentVal == widget.total ? 'Eksaktong bayad!' : '${widget.currencySymbol}${changeVal.toStringAsFixed(2)}'),
                            textAlign: TextAlign.right,
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: _paymentVal < widget.total ? 12 : 18,
                              color: _paymentVal < widget.total ? Colors.red[800] : AppColors.secondary,
                            ),
                          ),
                        ),
                      ],
                    )
                  else
                    TableRow(
                      children: [
                        const Text(
                          'Paraan ng Benta:',
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                        ),
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: 4.0),
                          child: Text(
                            settings.tr('I-utang / Credit Charge', 'Credit Charge / Utang'),
                            textAlign: TextAlign.right,
                            style: const TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 13,
                              color: Colors.red,
                            ),
                          ),
                        ),
                      ],
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () {
            Navigator.pop(context);
          },
          child: const Text('I-cancel'),
        ),
        ElevatedButton(
          onPressed: (_paymentType == 'cash' ? isCashCheckoutEnabled : isCreditCheckoutEnabled)
              ? () {
                  if (_paymentType == 'cash') {
                    final double finalPaid = _paymentVal;
                    final double finalChange = changeVal < 0 ? 0.0 : changeVal;
                    Navigator.pop(context, <String, dynamic>{
                      'type': 'cash',
                      'paid': finalPaid,
                      'change': finalChange,
                    });
                  } else {
                    Navigator.pop(context, <String, dynamic>{
                      'type': 'credit',
                      'customerId': _selectedCustomer!.id,
                      'customerName': _selectedCustomer!.name,
                      'paid': 0.0,
                      'change': 0.0,
                    });
                  }
                }
              : null,
          style: ElevatedButton.styleFrom(
            backgroundColor: _paymentType == 'cash' ? AppColors.primary : Colors.red[800],
            disabledBackgroundColor: Colors.grey[300],
            foregroundColor: Colors.white,
            disabledForegroundColor: Colors.grey[600],
          ),
          child: Text(
            _paymentType == 'cash' 
                ? settings.tr('I-benta Na', 'Complete Cash Sale') 
                : settings.tr('I-utang Na', 'Charge to Credit'),
          ),
        ),
      ],
    );
  }
}
