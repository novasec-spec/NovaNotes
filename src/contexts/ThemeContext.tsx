import React, { createContext, useContext, useState } from 'react';
import { useColorScheme } from 'react-native';
import { Colors } from '../constants/theme';

type ThemeContextType = {
  isDarkMode: boolean;
  colors: typeof Colors.light;
  toggleTheme: () => void; // Add this function
};

const ThemeContext = createContext<ThemeContextType>({
  isDarkMode: false,
  colors: Colors.light,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  
  // 1. Create state. It defaults to whatever the phone's system is set to.
  const [isDarkMode, setIsDarkMode] = useState(systemColorScheme === 'dark');

  // 2. Create the toggle function
  const toggleTheme = () => {
    setIsDarkMode(previousState => !previousState);
  };

  return (
    <ThemeContext.Provider 
      value={{ 
        isDarkMode, 
        colors: isDarkMode ? Colors.dark : Colors.light, 
        toggleTheme // Pass the function down
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
