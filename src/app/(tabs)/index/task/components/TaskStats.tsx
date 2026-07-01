import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TaskStats as TaskStatsType } from '../types/task.types';

interface TaskStatsProps {
  stats: TaskStatsType;
  colors: any;
}

export function TaskStats({ stats, colors }: TaskStatsProps) {
  return (
    <View style={styles.container}>
      <Text style={[styles.stats, { color: colors.text }]}>
        {stats.active} active • {stats.completed} done
      </Text>
      {stats.overdue > 0 && (
        <Text style={styles.overdue}>⚠️ {stats.overdue} overdue</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-end',
  },
  stats: {
    fontSize: 14,
  },
  overdue: {
    fontSize: 12,
    color: '#F44336',
    marginTop: 2,
  },
});
