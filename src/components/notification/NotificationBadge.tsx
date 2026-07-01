// src/components/notification/NotificationBadge.tsx

import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

interface NotificationBadgeProps {
  count: number;
  maxCount?: number;
  size?: 'small' | 'medium' | 'large';
  showZero?: boolean;
  animated?: boolean;
}

export function NotificationBadge({
  count,
  maxCount = 99,
  size = 'medium',
  showZero = false,
  animated = true,
}: NotificationBadgeProps) {
  const [scaleAnim] = React.useState(new Animated.Value(0));
  const [prevCount, setPrevCount] = React.useState(count);

  React.useEffect(() => {
    if (animated && count !== prevCount) {
      // Animate badge
      Animated.sequence([
        Animated.spring(scaleAnim, {
          toValue: 1.5,
          friction: 3,
          tension: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 3,
          tension: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(1);
    }
    setPrevCount(count);
  }, [count, animated]);

  if (!showZero && count === 0) return null;

  const displayCount = count > maxCount ? `${maxCount}+` : String(count);

  const sizeStyles = {
    small: {
      container: { minWidth: 16, height: 16, paddingHorizontal: 4 },
      text: { fontSize: 10 },
    },
    medium: {
      container: { minWidth: 20, height: 20, paddingHorizontal: 6 },
      text: { fontSize: 12 },
    },
    large: {
      container: { minWidth: 24, height: 24, paddingHorizontal: 8 },
      text: { fontSize: 14 },
    },
  };

  const selectedSize = sizeStyles[size];

  return (
    <Animated.View
      style={[
        styles.container,
        selectedSize.container,
        { transform: [{ scale: scaleAnim }] },
      ]}
    >
      <Text style={[styles.text, selectedSize.text]}>{displayCount}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#EF4444',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
  },
  text: {
    color: '#fff',
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 16,
  },
});
