// src/hooks/useColors.ts
import { useTheme } from '../contexts/ThemeContext';

export function useColors() {
  const { isDarkMode } = useTheme();

  if (isDarkMode) {
    // 🌙 DARK MODE: Override the colors
    return {
      PINK: '#FF6B9D',        // Keep your signature pink!
      WHITE: '#121212',       // Dark background instead of white
      TEXT_SOFT: '#888888',   // Muted text for dark mode
      TAB_BG: '#1E1E1E',      // Dark tab bar background
      BORDER_PINK: '#2C2C2C', // Dark border instead of light pink
      DEV_TOAST_BG: '#000000',// Darker toast background
    };
  }

  // ☀️ LIGHT MODE: EXACT ORIGINAL COLORS FROM YOUR APP
  return {
    PINK: '#FF6B9D',
    WHITE: '#FFFFFF',
    TEXT_SOFT: '#C4A0B8',
    TAB_BG: '#FFFFFF',
    BORDER_PINK: '#FFE4EE',
    DEV_TOAST_BG: '#1A1A2E',
  };
}
