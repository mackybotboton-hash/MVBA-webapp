import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';
import 'package:path/path.dart' as p;
import 'package:provider/provider.dart';
import '../models/product.dart';
import '../providers/inventory_provider.dart';
import '../providers/settings_provider.dart';
import 'barcode_scanner_modal.dart';
import 'pin_lock_screen.dart';
import '../utils/title_case_formatter.dart';
import '../utils/app_constants.dart';

class AddEditProductScreen extends StatefulWidget {
  final Product? product; // If null, we are in "Add" mode. If provided, we are in "Edit" mode.

  const AddEditProductScreen({super.key, this.product});

  @override
  State<AddEditProductScreen> createState() => _AddEditProductScreenState();
}

class _AddEditProductScreenState extends State<AddEditProductScreen> {
  static const _feedbackChannel = MethodChannel('com.sarisari.inventory/scan_feedback');

  Future<void> _triggerFeedback() async {
    try {
      final settings = Provider.of<SettingsProvider>(context, listen: false);
      await _feedbackChannel.invokeMethod('playScanFeedback', {
        'volume': settings.beepVolume.toInt(),
        'vibrateStrength': settings.vibrationStrength.toInt(),
      });
    } catch (_) {}
  }

  final _formKey = GlobalKey<FormState>();

  late String _name;
  late String _category;
  late String _unit;
  late double _buyingPrice;
  late double _sellingPrice;
  late double _currentStock;
  late double _minStockThreshold;
  late double _wholesalePrice;
  late double _wholesaleMinQty;
  DateTime? _expiryDate;

  final _nameController = TextEditingController();
  final _buyingPriceController = TextEditingController();
  final _sellingPriceController = TextEditingController();
  final _currentStockController = TextEditingController();
  final _minStockThresholdController = TextEditingController();
  final _wholesalePriceController = TextEditingController();
  final _wholesaleMinQtyController = TextEditingController();
  final _barcodeController = TextEditingController();
  final FocusNode _barcodeFocusNode = FocusNode();

  final FocusNode _keyboardFocusNode = FocusNode();
  final StringBuffer _barcodeBuffer = StringBuffer();
  DateTime? _lastKeyEventTime;

  File? _imageFile;
  String? _existingImagePath;
  final ImagePicker _picker = ImagePicker();

  Future<void> _pickImage(ImageSource source) async {
    try {
      final pickedFile = await _picker.pickImage(
        source: source,
        maxWidth: 600,
        maxHeight: 600,
        imageQuality: 85,
      );
      if (pickedFile != null) {
        setState(() {
          _imageFile = File(pickedFile.path);
        });
      }
    } catch (_) {}
  }

  void _showImageSourceActionSheet() {
    showModalBottomSheet(
      context: context,
      builder: (context) => SafeArea(
        child: Wrap(
          children: [
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('Pumili sa Gallery (Pick from Gallery)'),
              onTap: () {
                Navigator.pop(context);
                _pickImage(ImageSource.gallery);
              },
            ),
            ListTile(
              leading: const Icon(Icons.camera_alt_outlined),
              title: const Text('Kumuha ng Larawan (Take Photo)'),
              onTap: () {
                Navigator.pop(context);
                _pickImage(ImageSource.camera);
              },
            ),
            if (_imageFile != null)
              ListTile(
                leading: const Icon(Icons.delete_outline, color: Colors.red),
                title: const Text('Tanggalin ang Larawan', style: TextStyle(color: Colors.red)),
                onTap: () {
                  Navigator.pop(context);
                  setState(() {
                    _imageFile = null;
                    _existingImagePath = null;
                  });
                },
              ),
          ],
        ),
      ),
    );
  }


  @override
  void initState() {
    super.initState();

    final isEdit = widget.product != null;
    _name = isEdit ? widget.product!.name : '';
    _category = isEdit ? widget.product!.category : 'Beverages';
    _unit = isEdit ? widget.product!.unit : 'pcs';
    _buyingPrice = isEdit ? widget.product!.buyingPrice : 0.0;
    _sellingPrice = isEdit ? widget.product!.sellingPrice : 0.0;
    _currentStock = isEdit ? widget.product!.currentStock : 0.0;
    _minStockThreshold = isEdit ? widget.product!.minStockThreshold : 5.0;
    _wholesalePrice = isEdit ? (widget.product!.wholesalePrice ?? 0.0) : 0.0;
    _wholesaleMinQty = isEdit ? (widget.product!.wholesaleMinQty ?? 0.0) : 0.0;
    _expiryDate = isEdit ? widget.product!.expiryDate : null;

    final barcodeVal = isEdit ? widget.product!.barcode ?? '' : '';
    _barcodeController.text = barcodeVal;

    _existingImagePath = isEdit ? widget.product!.imagePath : null;
    if (_existingImagePath != null) {
      _imageFile = File(_existingImagePath!);
    }

    if (isEdit) {
      _nameController.text = _name;
      _buyingPriceController.text = _buyingPrice.toString();
      _sellingPriceController.text = _sellingPrice.toString();
      _currentStockController.text = _currentStock.toString();
      _minStockThresholdController.text = _minStockThreshold.toString();
      _wholesalePriceController.text = _wholesalePrice > 0 ? _wholesalePrice.toString() : '';
      _wholesaleMinQtyController.text = _wholesaleMinQty > 0 ? _wholesaleMinQty.toString() : '';
    } else {
      _minStockThresholdController.text = '5.0'; // Default threshold
    }

    // Add listeners to rebuild on price updates for the live profit calculator
    _buyingPriceController.addListener(_onPriceChanged);
    _sellingPriceController.addListener(_onPriceChanged);
  }

  void _onPriceChanged() {
    setState(() {
      _buyingPrice = double.tryParse(_buyingPriceController.text) ?? 0.0;
      _sellingPrice = double.tryParse(_sellingPriceController.text) ?? 0.0;
    });
  }

  @override
  void dispose() {
    _nameController.dispose();
    _buyingPriceController.removeListener(_onPriceChanged);
    _sellingPriceController.removeListener(_onPriceChanged);
    _buyingPriceController.dispose();
    _sellingPriceController.dispose();
    _currentStockController.dispose();
    _minStockThresholdController.dispose();
    _wholesalePriceController.dispose();
    _wholesaleMinQtyController.dispose();
    _barcodeController.dispose();
    _barcodeFocusNode.dispose();
    _keyboardFocusNode.dispose();
    super.dispose();
  }

  Future<void> _scanBarcode() async {
    final result = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => const BarcodeScannerModal(),
    );
    
    if (result != null && mounted) {
      setState(() {
        _barcodeController.text = result;
      });
    }
  }

  void _handleHardwareKey(KeyEvent event) {
    if (event is KeyDownEvent) {
      final now = DateTime.now();
      
      if (_lastKeyEventTime != null && now.difference(_lastKeyEventTime!).inMilliseconds > 100) {
        _barcodeBuffer.clear();
      }
      _lastKeyEventTime = now;

      final key = event.logicalKey;
      if (key == LogicalKeyboardKey.enter) {
        final code = _barcodeBuffer.toString().trim();
        if (code.length >= 3) {
          _triggerFeedback();
          setState(() {
            _barcodeController.text = code;
          });
        }
        _barcodeBuffer.clear();
      } else if (event.character != null && event.character!.isNotEmpty) {
        _barcodeBuffer.write(event.character);
      }
    }
  }

  // Choose Expiry Date via Calendar Picker
  Future<void> _selectExpiryDate(BuildContext context) async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: _expiryDate ?? DateTime.now().add(const Duration(days: 90)),
      firstDate: DateTime.now().subtract(const Duration(days: 365)), // allow past expiry dates for logging
      lastDate: DateTime.now().add(const Duration(days: 365 * 10)),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(
              primary: AppColors.primary, // primary green
              onPrimary: Colors.white,
              onSurface: Colors.black87,
            ),
          ),
          child: child!,
        );
      },
    );

    if (picked != null && picked != _expiryDate) {
      setState(() {
        _expiryDate = picked;
      });
    }
  }

  // Form Submission
  Future<void> _submitForm() async {
    if (!_formKey.currentState!.validate()) return;

    _formKey.currentState!.save();

    final provider = Provider.of<InventoryProvider>(context, listen: false);

    String? savedPath = _existingImagePath;

    if (_imageFile != null && _imageFile!.path != _existingImagePath) {
      try {
        final appDir = await getApplicationDocumentsDirectory();
        final fileName = 'product_img_${DateTime.now().millisecondsSinceEpoch}${p.extension(_imageFile!.path)}';
        final localFile = await _imageFile!.copy(p.join(appDir.path, fileName));
        savedPath = localFile.path;

        // Delete old image if it exists
        if (_existingImagePath != null) {
          final oldFile = File(_existingImagePath!);
          if (await oldFile.exists()) {
            await oldFile.delete();
          }
        }
      } catch (_) {}
    } else if (_imageFile == null && _existingImagePath != null) {
      try {
        final oldFile = File(_existingImagePath!);
        if (await oldFile.exists()) {
          await oldFile.delete();
        }
      } catch (_) {}
      savedPath = null;
    }

    final productData = Product(
      id: widget.product?.id,
      name: _nameController.text.trim(),
      category: _category,
      unit: _unit,
      buyingPrice: double.parse(_buyingPriceController.text),
      sellingPrice: double.parse(_sellingPriceController.text),
      currentStock: double.parse(_currentStockController.text),
      minStockThreshold: double.parse(_minStockThresholdController.text),
      wholesalePrice: _wholesalePriceController.text.isNotEmpty ? double.parse(_wholesalePriceController.text) : null,
      wholesaleMinQty: _wholesaleMinQtyController.text.isNotEmpty ? double.parse(_wholesaleMinQtyController.text) : null,
      expiryDate: _expiryDate,
      barcode: _barcodeController.text.trim().isEmpty ? null : _barcodeController.text.trim(),
      imagePath: savedPath,
    );

    if (widget.product == null) {
      final createdProduct = await provider.addProduct(productData);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Matagumpay na naidagdag ang "${productData.name}"!'),
            backgroundColor: AppColors.secondary,
          ),
        );
        Navigator.pop(context, createdProduct);
      }
    } else {
      await provider.updateProduct(productData);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Matagumpay na na-edit ang "${productData.name}"!'),
            backgroundColor: AppColors.secondary,
          ),
        );
        Navigator.pop(context);
      }
    }
  }

  // Delete Action
  void _deleteProduct() {
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Buraing Produkto?'),
          content: Text(
            'Sigurado ka bang gusto mong burahin ang "${widget.product!.name}"?\n\n'
            'Babala: Kasama nitong mabubura ang lahat ng kasaysayan ng restock at benta para sa produktong ito.'
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Huwag burahin'),
            ),
            ElevatedButton(
              onPressed: () {
                final settings = Provider.of<SettingsProvider>(context, listen: false);
                if (settings.isAdminLockEnabled && settings.hasPin) {
                  // Pop dialogue
                  Navigator.pop(context);
                  // Push lock screen first
                  Navigator.push<bool>(
                    context,
                    MaterialPageRoute(
                      builder: (context) => const PinLockScreen(
                        isStartup: false,
                      ),
                    ),
                  ).then((unlocked) {
                    if (unlocked == true && context.mounted) {
                      final provider = Provider.of<InventoryProvider>(context, listen: false);
                      provider.deleteProduct(widget.product!.id!);
                      // Pop AddEdit Screen
                      Navigator.pop(context);
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text('Nabura na ang "${widget.product!.name}".'),
                          backgroundColor: Colors.red[800],
                        ),
                      );
                    }
                  });
                } else {
                  final provider = Provider.of<InventoryProvider>(context, listen: false);
                  provider.deleteProduct(widget.product!.id!);
                  
                  // Pop dialogue
                  Navigator.pop(context);
                  
                  // Pop AddEdit Screen
                  Navigator.pop(context);
                  
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Nabura na ang "${widget.product!.name}".'),
                      backgroundColor: Colors.red[800],
                    ),
                  );
                }
              },
              style: ElevatedButton.styleFrom(backgroundColor: Colors.red[800], foregroundColor: Colors.white),
              child: const Text('Oo, Burahin'),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final isEdit = widget.product != null;
    final profit = _sellingPrice - _buyingPrice;
    final isProfitNegative = profit < 0;
    final settings = Provider.of<SettingsProvider>(context);

    List<String> currentCategories = List.from(settings.productCategories);
    if (!currentCategories.contains(_category)) {
      currentCategories.add(_category);
    }
    List<String> currentUnits = List.from(settings.productUnits);
    if (!currentUnits.contains(_unit)) {
      currentUnits.add(_unit);
    }

    return KeyboardListener(
      focusNode: _keyboardFocusNode,
      autofocus: true,
      onKeyEvent: _handleHardwareKey,
      child: Scaffold(
        appBar: AppBar(
          title: Text(
            isEdit ? 'I-edit ang Produkto' : 'Magdagdag ng Produkto',
            style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
          ),
          backgroundColor: AppColors.primary,
          iconTheme: const IconThemeData(color: Colors.white),
          actions: [
            if (isEdit)
              IconButton(
                icon: const Icon(Icons.delete_forever_rounded, color: Colors.white),
                onPressed: _deleteProduct,
                tooltip: 'Burahin ang Produkto',
              ),
          ],
        ),
        body: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 600),
            child: SingleChildScrollView(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Product Image Selector
                Center(
                  child: GestureDetector(
                    onTap: _showImageSourceActionSheet,
                    child: Container(
                      width: 120,
                      height: 120,
                      decoration: BoxDecoration(
                        color: Colors.grey[100],
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: Colors.grey.shade300),
                      ),
                      child: _imageFile != null
                          ? ClipRRect(
                              borderRadius: BorderRadius.circular(15),
                              child: _imageFile!.existsSync() 
                                  ? Image.file(
                                      _imageFile!,
                                      fit: BoxFit.cover,
                                      width: 120,
                                      height: 120,
                                    )
                                  : Column(
                                      mainAxisAlignment: MainAxisAlignment.center,
                                      children: [
                                        Icon(Icons.broken_image_outlined, size: 36, color: Colors.red[300]),
                                        const SizedBox(height: 8),
                                        const Text('Error loading', style: TextStyle(fontSize: 10)),
                                      ],
                                    ),
                            )
                          : Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.add_a_photo_outlined, size: 36, color: Colors.grey[600]),
                                const SizedBox(height: 8),
                                Text(
                                  settings.tr('Larawan (Photo)', 'Larawan (Photo)'),
                                  style: TextStyle(fontSize: 11, color: Colors.grey[600]),
                                ),
                              ],
                            ),
                    ),
                  ),
                ),
                const SizedBox(height: 20),

                // Product Name
                TextFormField(
                  controller: _nameController,
                  textCapitalization: TextCapitalization.words,
                  inputFormatters: [TitleCaseTextInputFormatter()],
                  decoration: const InputDecoration(
                    labelText: 'Pangalan ng Produkto (Product Name) *',
                    border: OutlineInputBorder(),
                    prefixIcon: Icon(Icons.shopping_basket_outlined, color: AppColors.secondary),
                  ),
                  validator: (value) {
                    if (value == null || value.trim().isEmpty) {
                      return 'Ilagay ang pangalan ng produkto';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 16),

                // Barcode input and camera scan button
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: TextFormField(
                        controller: _barcodeController,
                        focusNode: _barcodeFocusNode,
                        autofocus: widget.product == null,
                        decoration: const InputDecoration(
                          labelText: 'Barcode (Opsyonal)',
                          border: OutlineInputBorder(),
                          prefixIcon: Icon(Icons.qr_code_scanner_outlined, color: AppColors.secondary),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    SizedBox(
                      height: 56,
                      child: ElevatedButton(
                        onPressed: _scanBarcode,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.surfaceLight,
                          foregroundColor: AppColors.primary,
                          elevation: 0,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(10),
                            side: BorderSide(color: Colors.grey.shade300),
                          ),
                        ),
                        child: const Icon(Icons.camera_alt_outlined),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                // Category and Unit Dropdowns Side by Side
                Row(
                  children: [
                    // Category
                    Expanded(
                      flex: 3,
                      child: DropdownButtonFormField<String>(
                        initialValue: _category,
                        isExpanded: true,
                        decoration: const InputDecoration(
                          labelText: 'Kategorya *',
                          border: OutlineInputBorder(),
                          contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 15),
                        ),
                        items: currentCategories.map((cat) {
                          return DropdownMenuItem<String>(
                            value: cat,
                            child: Text(
                              cat,
                              style: const TextStyle(fontSize: 12),
                              overflow: TextOverflow.ellipsis,
                            ),
                          );
                        }).toList(),
                        onChanged: (val) {
                          setState(() {
                            _category = val!;
                          });
                        },
                      ),
                    ),
                    const SizedBox(width: 12),

                    // Unit
                    Expanded(
                      flex: 2,
                      child: DropdownButtonFormField<String>(
                        initialValue: _unit,
                        isExpanded: true,
                        decoration: const InputDecoration(
                          labelText: 'Unit *',
                          border: OutlineInputBorder(),
                          contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 15),
                        ),
                        items: currentUnits.map((u) {
                          return DropdownMenuItem<String>(
                            value: u,
                            child: Text(u),
                          );
                        }).toList(),
                        onChanged: (val) {
                          setState(() {
                            _unit = val!;
                          });
                        },
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                // Prices Section
                Row(
                  children: [
                    // Buying Price
                    Expanded(
                      child: TextFormField(
                        controller: _buyingPriceController,
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        decoration: const InputDecoration(
                          labelText: 'Puhunan (Buying Price) *',
                          prefixText: '₱ ',
                          border: OutlineInputBorder(),
                        ),
                        validator: (value) {
                          if (value == null || value.isEmpty) {
                            return 'Ilagay ang puhunan';
                          }
                          if (double.tryParse(value) == null) {
                            return 'Dapat ay numero';
                          }
                          if (double.parse(value) < 0) {
                            return 'Bawal ang negatibo';
                          }
                          return null;
                        },
                      ),
                    ),
                    const SizedBox(width: 12),

                    // Selling Price
                    Expanded(
                      child: TextFormField(
                        controller: _sellingPriceController,
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        decoration: const InputDecoration(
                          labelText: 'Presyo (Selling Price) *',
                          prefixText: '₱ ',
                          border: OutlineInputBorder(),
                        ),
                        validator: (value) {
                          if (value == null || value.isEmpty) {
                            return 'Ilagay ang presyo';
                          }
                          if (double.tryParse(value) == null) {
                            return 'Dapat ay numero';
                          }
                          if (double.parse(value) < 0) {
                            return 'Bawal ang negatibo';
                          }
                          return null;
                        },
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                
                // Wholesale Pricing Section (Optional)
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.grey.shade100,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.grey.shade300),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        settings.tr('Wholesale Price / Bulk Discount (Opsyonal)', 'Wholesale Price (Optional)'),
                        style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.black87),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Expanded(
                            child: TextFormField(
                              controller: _wholesalePriceController,
                              keyboardType: const TextInputType.numberWithOptions(decimal: true),
                              decoration: const InputDecoration(
                                labelText: 'Presyong Wholesale',
                                prefixText: '₱ ',
                                border: OutlineInputBorder(),
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: TextFormField(
                              controller: _wholesaleMinQtyController,
                              keyboardType: const TextInputType.numberWithOptions(decimal: true),
                              decoration: const InputDecoration(
                                labelText: 'Minimum Dami (Qty)',
                                border: OutlineInputBorder(),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        settings.tr('Mag-aapply ito sa POS kung bibilhin ang item nang sapat ang dami.', 'This price applies in POS if they buy the minimum quantity.'),
                        style: const TextStyle(fontSize: 11, color: Colors.grey),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // Real-time Profit Preview Widget
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  decoration: BoxDecoration(
                    color: isProfitNegative
                        ? Colors.red.shade50
                        : AppColors.surfaceLight,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(
                      color: isProfitNegative ? Colors.red.shade200 : AppColors.surfaceBorder,
                    ),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        isProfitNegative ? 'Babala: Lugi ang Presyo!' : 'Tubo kada item (Profit):',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          color: isProfitNegative ? Colors.red.shade900 : AppColors.primary,
                        ),
                      ),
                      Text(
                        '₱${profit.toStringAsFixed(2)}',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: isProfitNegative ? Colors.red.shade900 : AppColors.primary,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                // Stock details
                Row(
                  children: [
                    // Current Stock Quantity
                    Expanded(
                      child: TextFormField(
                        controller: _currentStockController,
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        decoration: InputDecoration(
                          labelText: 'Stock Qty *',
                          border: const OutlineInputBorder(),
                          suffixText: _unit,
                          helperText: isEdit ? 'Ayusin kung may labis/kulang' : 'Simulang stock ng item',
                        ),
                        validator: (value) {
                          if (value == null || value.isEmpty) {
                            return 'Ilagay ang stock';
                          }
                          if (double.tryParse(value) == null) {
                            return 'Dapat ay numero';
                          }
                          if (double.parse(value) < 0) {
                            return 'Bawal ang negatibo';
                          }
                          return null;
                        },
                      ),
                    ),
                    const SizedBox(width: 12),

                    // Low Stock Alert Threshold
                    Expanded(
                      child: TextFormField(
                        controller: _minStockThresholdController,
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        decoration: const InputDecoration(
                          labelText: 'Stock Threshold *',
                          border: OutlineInputBorder(),
                          helperText: 'Mag-aalerto kapag mas mababa rito',
                        ),
                        validator: (value) {
                          if (value == null || value.isEmpty) {
                            return 'Ilagay ang threshold';
                          }
                          if (double.tryParse(value) == null) {
                            return 'Dapat ay numero';
                          }
                          if (double.parse(value) < 0) {
                            return 'Bawal ang negatibo';
                          }
                          return null;
                        },
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                if (settings.showExpiryDate) ...[
                  // Expiry Date (Optional)
                  InkWell(
                    onTap: () => _selectExpiryDate(context),
                    borderRadius: BorderRadius.circular(8),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 16),
                      decoration: BoxDecoration(
                        border: Border.all(color: Colors.grey.shade400),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Row(
                              children: const [
                                Icon(Icons.calendar_today_rounded, color: AppColors.secondary),
                                SizedBox(width: 10),
                                Expanded(
                                  child: Text(
                                    'Petsa ng Expiry (Optional):',
                                    style: TextStyle(fontSize: 14, color: Colors.black87),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            _expiryDate == null
                                ? 'Walang expiry date'
                                : DateFormat('MMM dd, yyyy').format(_expiryDate!),
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              color: _expiryDate != null ? Colors.red.shade800 : Colors.grey[700],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  if (_expiryDate != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 4, right: 8),
                      child: Align(
                        alignment: Alignment.centerRight,
                        child: TextButton(
                          onPressed: () {
                            setState(() {
                              _expiryDate = null;
                            });
                          },
                          style: TextButton.styleFrom(
                            padding: EdgeInsets.zero,
                            minimumSize: const Size(50, 30),
                            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                          ),
                          child: const Text('Tanggalin ang Expiry', style: TextStyle(color: Colors.red)),
                        ),
                      ),
                    ),
                ],
                const SizedBox(height: 32),

                // Save Button
                ElevatedButton(
                  onPressed: _submitForm,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary, // Forest Green
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: Text(
                    isEdit ? 'I-save ang Pagbabago' : 'I-save ang Produkto',
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  ),
),
);
  }
}
