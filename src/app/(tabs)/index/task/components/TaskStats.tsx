import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { TaskStats as TaskStatsType } from '../types/task.types';

interface TaskStatsProps {
  stats: TaskStatsType;
  colors: any;
  onPress?: (filter: string) => void;
}

export function TaskStats({ stats, colors, onPress }: TaskStatsProps) {
  const statItems = [
    {
      label: 'Total',
      value: stats.total,
      icon: 'list-outline',
      color: colors.text,
      filter: 'all',
    },
    {
      label: 'Active',
      value: stats.active,
      icon: 'radio-button-on-outline',
      color: colors.primary,
      filter: 'active',
    },
    {
      label: 'Completed',
      value: stats.completed,
      icon: 'checkmark-circle-outline',
      color: colors.success,
      filter: 'completed',
    },
    {
      label: 'Overdue',
      value: stats.overdue,
      icon: 'alert-circle-outline',
      color: colors.error,
      filter: 'overdue',
    },
  ];

  return (
    <View style={styles.container}>
      {statItems.map((item) => (
        <TouchableOpacity
          key={item.label}
          style={[styles.statItem, { backgroundColor: colors.card }]}
          onPress={() => onPress?.(item.filter)}
          activeOpacity={0.7}
        >
          <View style={[styles.statIcon, { backgroundColor: item.color + '15' }]}>
            <Icon name={item.icon} size={18} color={item.color} />
          </View>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {item.value}
          </Text>
          <Text style={[styles.statLabel, { color: colors.muted }]}>
            {item.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
  },
});
