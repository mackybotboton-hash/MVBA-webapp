import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/settings_provider.dart';
import '../providers/navigation_provider.dart';
import '../screens/expenses_screen.dart';
import '../screens/settings_screen.dart';
import '../screens/backup_export_screen.dart';
import '../utils/app_constants.dart';

class AppDrawer extends StatelessWidget {
  final String? currentRoute;
  const AppDrawer({super.key, this.currentRoute});

  @override
  Widget build(BuildContext context) {
    final settings = Provider.of<SettingsProvider>(context);
    final navProvider = Provider.of<NavigationProvider>(context);
    final currentTab = navProvider.currentTabIndex;

    void navigateToTab(int index) {
      // Cleanly pop all routes until we reach the root MainNavigation screen
      Navigator.popUntil(context, (route) => route.isFirst);
      
      // Switch the active tab index in the root layout
      navProvider.setTabIndex(index);
    }

    void navigateToSubScreen(Widget screen) {
      // Cleanly pop all routes until we reach the root MainNavigation screen
      Navigator.popUntil(context, (route) => route.isFirst);
      
      // Push the new standalone view on the next frame to prevent _debugLocked error
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (context.mounted) {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => screen),
          );
        }
      });
    }

    Widget buildDrawerItem({
      required IconData icon,
      required String label,
      required VoidCallback onTap,
      bool isSelected = false,
    }) {
      return ListTile(
        leading: Icon(
          icon,
          color: isSelected ? AppColors.primary : Colors.grey[700],
        ),
        title: Text(
          label,
          style: TextStyle(
            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
            color: isSelected ? AppColors.primary : Colors.black87,
          ),
        ),
        selected: isSelected,
        selectedTileColor: AppColors.surfaceLight,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 2),
        onTap: onTap,
      );
    }

    return Drawer(
      child: Column(
        children: [
          // Drawer Header
          UserAccountsDrawerHeader(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [AppColors.primaryDark, AppColors.primary],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
            accountName: Text(
              settings.storeName,
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
            ),
            accountEmail: Text(
              '${settings.tr('Tagapamahala', 'Manager')}: ${settings.ownerName}',
              style: const TextStyle(color: Colors.white70),
            ),
            currentAccountPicture: CircleAvatar(
              backgroundColor: AppColors.accent,
              child: const Icon(
                Icons.storefront_rounded,
                size: 40,
                color: Colors.white,
              ),
            ),
          ),

          // Drawer Navigation List
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              children: [
                const SizedBox(height: 8),
                
                // Dashboard
                buildDrawerItem(
                  icon: Icons.dashboard_rounded,
                  label: settings.tr('Dashboard', 'Dashboard'),
                  isSelected: currentRoute == null && currentTab == 0,
                  onTap: () => navigateToTab(0),
                ),
                
                // Products
                buildDrawerItem(
                  icon: Icons.inventory_2_rounded,
                  label: settings.tr('Mga Produkto', 'Products'),
                  isSelected: currentRoute == null && currentTab == 1,
                  onTap: () => navigateToTab(1),
                ),
                
                // Stock In
                buildDrawerItem(
                  icon: Icons.add_business_rounded,
                  label: settings.tr('Stock In (Restock)', 'Stock In (Restock)'),
                  isSelected: currentRoute == null && currentTab == 2,
                  onTap: () => navigateToTab(2),
                ),
                
                // POS (Benta)
                buildDrawerItem(
                  icon: Icons.point_of_sale_rounded,
                  label: settings.tr('Mag-benta (POS)', 'POS Cart'),
                  isSelected: currentRoute == null && currentTab == 3,
                  onTap: () => navigateToTab(3),
                ),
                
                // Utang Ledger
                buildDrawerItem(
                  icon: Icons.account_balance_wallet_rounded,
                  label: settings.tr('Utang Ledger', 'Utang Ledger'),
                  isSelected: currentRoute == null && currentTab == 4,
                  onTap: () => navigateToTab(4),
                ),
                
                // History
                buildDrawerItem(
                  icon: Icons.history_rounded,
                  label: settings.tr('Kasaysayan ng Benta', 'Sales History'),
                  isSelected: currentRoute == null && currentTab == 5,
                  onTap: () => navigateToTab(5),
                ),
                
                const Divider(height: 20, thickness: 1),
                
                // Expenses Tracker [NEW]
                buildDrawerItem(
                  icon: Icons.receipt_long_rounded,
                  label: settings.tr('Gastos (Expenses)', 'Expenses'),
                  isSelected: currentRoute == 'expenses',
                  onTap: () {
                    if (currentRoute == 'expenses') {
                      Navigator.pop(context);
                    } else {
                      navigateToSubScreen(const ExpensesScreen());
                    }
                  },
                ),

                // Database & Backup Shortcut
                buildDrawerItem(
                  icon: Icons.backup_rounded,
                  label: settings.tr('Backup at CSV', 'Backup & CSV'),
                  isSelected: currentRoute == 'backup',
                  onTap: () {
                    if (currentRoute == 'backup') {
                      Navigator.pop(context);
                    } else {
                      navigateToSubScreen(const BackupExportScreen());
                    }
                  },
                ),

                // Settings
                buildDrawerItem(
                  icon: Icons.settings_rounded,
                  label: settings.tr('Mga Setting', 'Settings'),
                  isSelected: currentRoute == 'settings',
                  onTap: () {
                    if (currentRoute == 'settings') {
                      Navigator.pop(context);
                    } else {
                      // Cleanly pop all routes until we reach the root MainNavigation screen
                      Navigator.popUntil(context, (route) => route.isFirst);
                      
                      // Push SettingsScreen in next frame to prevent _debugLocked error
                      WidgetsBinding.instance.addPostFrameCallback((_) {
                        if (context.mounted) {
                          SettingsScreen.navigate(context);
                        }
                      });
                    }
                  },
                ),
              ],
            ),
          ),
          
          // Drawer Footer
          Container(
            padding: const EdgeInsets.all(16),
            alignment: Alignment.center,
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.bolt_rounded, size: 14, color: AppColors.primary),
                SizedBox(width: 4),
                Text(
                  'Powered by MVBA Solutions',
                  style: TextStyle(color: AppColors.primary, fontSize: 11, fontWeight: FontWeight.w600, letterSpacing: 0.3),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
