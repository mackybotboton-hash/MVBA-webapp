import 'package:flutter/material.dart';

/// Centralized color constants used throughout the app.
/// MVBA Signature Theme: "Emerald Obsidian & Champagne Gold"
/// A premium, exclusive palette that sets this app apart.
class AppColors {
  AppColors._(); // Prevent instantiation

  // Primary brand colors (Emerald Obsidian / Deep Royal Teal)
  static const Color primary = Color(0xFF0D5C46);      // Deep Obsidian Teal
  static const Color primaryDark = Color(0xFF0A3D2F);   // Darker shade for gradients
  static const Color secondary = Color(0xFF148C6B);     // Vibrant Emerald

  // Accent / Highlight colors (Champagne Gold & Warm Amber)
  static const Color accent = Color(0xFFD97706);        // Champagne Gold
  static const Color accentLight = Color(0xFFF59E0B);   // Warm Amber / Bright Gold
  static const Color accentSurface = Color(0xFFFEF3C7); // Light gold tint background

  // Surface / background tints
  static const Color surfaceLight = Color(0xFFE6F5F0);  // Frosted Mint
  static const Color surfaceBorder = Color(0xFFB2DFCE); // Soft Teal Border
  static const Color searchFill = Color(0xFFF0FAF6);    // Ultra-light Mint Fill
  static const Color cardBackground = Color(0xFFF8FAFC); // Clean Frosted Milk

  // Functional colors
  static const Color error = Colors.red;
  static const Color warning = Colors.orange;
  static const Color success = Color(0xFF059669);       // Emerald Green (success variant)
}

/// Responsive layout breakpoints.
class AppBreakpoints {
  AppBreakpoints._();

  /// Width threshold for tablet-style layout (NavigationRail, side-by-side panes).
  static const double tablet = 768;

  /// Returns true if the current screen width qualifies as a tablet layout.
  static bool isTablet(BuildContext context) {
    return MediaQuery.of(context).size.width >= tablet;
  }
}
