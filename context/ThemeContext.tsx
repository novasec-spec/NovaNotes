// context/ThemeContext.tsx
import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  theme: ThemeMode;
  toggleTheme: () => void;
  colors: typeof lightColors;
}

// Light theme colors
const lightColors = {
  background: '#FFF5F7',
  surface: '#FFFFFF',
  text: '#333333',
  textSecondary: '#888888',
  primary: '#FF6B9D',
  primaryLight: '#FFE4E9',
  border: '#F0F0F0',
  card: '#FFFFFF',
  icon: '#FF6B9D',
  quoteBackground: '#FFFFFF',
  statBackground: '#FFFFFF',
  affirmationBackground: '#FFD70020',
};

// Dark theme colors
const darkColors = {
  background: '#121212',
  surface: '#1E1E1E',
  text: '#E0E0E0',
  textSecondary: '#A0A0A0',
  primary: '#FF8FAB',
  primaryLight: '#2D1B20',
  border: '#2C2C2C',
  card: '#1E1E1E',
  icon: '#FF8FAB',
  quoteBackground: '#1E1E1E',
  statBackground: '#1E1E1E',
  affirmationBackground: '#2D1B20',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<ThemeMode>('light');

  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('appTheme');
      if (savedTheme === 'light' || savedTheme === 'dark') {
        setTheme(savedTheme);
      }
    } catch (error) {
      console.error('Failed to load theme:', error);
    }
  };

  const toggleTheme = async () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    await AsyncStorage.setItem('appTheme', newTheme);
  };

  const colors = theme === 'light' ? lightColors : darkColors;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
