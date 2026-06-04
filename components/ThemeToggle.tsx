// components/ThemeToggle.tsx
import React from 'react';
import { TouchableOpacity, StyleSheet, Animated } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle() {
  const { theme, toggleTheme, colors } = useTheme();
  const isDark = theme === 'dark';

  return (
    <TouchableOpacity 
      style={[styles.toggleButton, { backgroundColor: colors.surface }]} 
      onPress={toggleTheme}
      activeOpacity={0.7}
    >
      <Animated.View style={styles.iconContainer}>
        <Icon 
          name={isDark ? 'moon' : 'sunny'} 
          size={22} 
          color={isDark ? '#FFD700' : '#FF6B9D'} 
        />
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  toggleButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
