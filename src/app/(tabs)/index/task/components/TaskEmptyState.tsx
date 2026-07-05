import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

interface TaskEmptyStateProps {
  icon: string;
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function TaskEmptyState({ icon, title, subtitle, actionLabel, onAction }: TaskEmptyStateProps) {
  return (
    <View style={styles.container}>
      <Icon name={icon} size={64} color="#ccc" />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      {actionLabel && onAction && (
        <TouchableOpacity style={styles.actionBtn} onPress={onAction}>
          <Text style={styles.actionLabel}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 4,
    color: '#666',
    textAlign: 'center',
  },
  actionBtn: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: '#FF6B9D',
  },
  actionLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
