import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { TaskFilter as TaskFilterType } from '../types/task.types';

interface TaskFilterProps {
  currentFilter: TaskFilterType;
  onFilterChange: (filter: TaskFilterType) => void;
  colors: any;
}

export function TaskFilterComponent({ currentFilter, onFilterChange, colors }: TaskFilterProps) {
  const filters: { key: TaskFilterType; label: string; icon: string }[] = [
    { key: 'all', label: 'All', icon: 'apps-outline' },
    { key: 'active', label: 'Active', icon: 'radio-button-on-outline' },
    { key: 'completed', label: 'Done', icon: 'checkmark-circle-outline' },
    { key: 'overdue', label: 'Overdue', icon: 'alert-circle-outline' },
    { key: 'today', label: 'Today', icon: 'today-outline' },
    { key: 'upcoming', label: 'Upcoming', icon: 'calendar-outline' },
  ];

  return (
    <ScrollView 
      horizontal 
      showsHorizontalScrollIndicator={false}
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      {filters.map((filter) => {
        const isActive = currentFilter === filter.key;
        return (
          <TouchableOpacity
            key={filter.key}
            style={[
              styles.filterBtn,
              { backgroundColor: isActive ? colors.primary : colors.card },
            ]}
            onPress={() => onFilterChange(filter.key)}
          >
            <Icon 
              name={filter.icon} 
              size={16} 
              color={isActive ? '#fff' : colors.muted} 
            />
            <Text
              style={[
                styles.filterText,
                { color: isActive ? '#fff' : colors.text },
              ]}
            >
              {filter.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    maxHeight: 50,
    marginBottom: 12,
  },
  contentContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
