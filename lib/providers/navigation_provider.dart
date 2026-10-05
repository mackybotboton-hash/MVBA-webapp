import 'package:flutter/foundation.dart';

/// Lightweight provider that owns only the bottom navigation / rail tab index.
/// Extracted from InventoryProvider to prevent unnecessary data-layer rebuilds
/// when the user merely switches tabs.
class NavigationProvider with ChangeNotifier {
  int _currentTabIndex = 0;

  int get currentTabIndex => _currentTabIndex;

  void setTabIndex(int index) {
    if (_currentTabIndex == index) return; // Skip if already on this tab
    _currentTabIndex = index;
    notifyListeners();
  }
}
