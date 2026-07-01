import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { TaskFilter as TaskFilterType } from '../types/task.types';

interface TaskFilterComponentProps {
  currentFilter: TaskFilterType;
  onFilterChange: (filter: TaskFilterType) => void;
  colors: any;
}

export function TaskFilterComponent({ currentFilter, onFilterChange, colors }: TaskFilterComponentProps) {
  const filters: TaskFilterType[] = ['all', 'active', 'completed'];
  
  return (
    <View style={styles.filterRow}>
      {filters.map((f) => (
        <TouchableOpacity
          key={f}
          style={[
            styles.filterBtn,
            currentFilter === f && styles.filterActive,
          ]}
          onPress={() => onFilterChange(f)}
        >
          <Text style={[
            styles.filterText,
            currentFilter === f && styles.filterTextActive,
            { color: currentFilter === f ? '#fff' : colors.text }
          ]}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 12,
  },
  filterBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
  },
  filterActive: {
    backgroundColor: '#FF6B9D',
  },
  filterText: {
    fontSize: 14,
  },
  filterTextActive: {
    color: '#fff',
  },
});
