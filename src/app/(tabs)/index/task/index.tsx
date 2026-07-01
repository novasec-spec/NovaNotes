import React, { useState } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Text,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../../contexts/ThemeContext';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTasks } from './hooks/useTasks';
import { TaskItem } from './components/TaskItem';
import { TaskFilterComponent } from './components/TaskFilter';
import { TaskStats } from './components/TaskStats';
import { TaskModal } from './components/TaskModal';
import { TaskEmptyState } from './components/TaskEmptyState';
import { Task, TaskFilterType } from './types/task.types';

export default function TasksScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<TaskFilterType>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const {
    tasks,
    loading,
    syncing,
    error,
    syncCount,
    loadTasks,
    addTask,
    updateTask,
    deleteTask,
    toggleComplete,
    forceSync,
    getFilteredTasks,
    getStats,
  } = useTasks();

  const filteredTasks = getFilteredTasks(filter);
  const stats = getStats();

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>✅ Tasks</Text>
        <TaskStats stats={stats} colors={colors} />
      </View>

      {/* Sync Status Bar */}
      {(syncCount > 0 || syncing) && (
        <View style={[styles.syncBar, { backgroundColor: '#FF9800' }]}>
          <ActivityIndicator size="small" color="#fff" style={styles.syncSpinner} />
          <Text style={styles.syncText}>
            {syncing ? 'Syncing...' : `${syncCount} task(s) pending sync`}
          </Text>
          {!syncing && (
            <TouchableOpacity onPress={forceSync} style={styles.syncNowBtn}>
              <Text style={styles.syncNowText}>Sync Now</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Filters */}
      <TaskFilterComponent 
        currentFilter={filter} 
        onFilterChange={setFilter} 
        colors={colors} 
      />

      {/* Error Banner */}
      {error && (
        <View style={[styles.errorBanner, { backgroundColor: '#F44336' }]}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
          <TouchableOpacity onPress={loadTasks}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

// In task/index.tsx, update the FlatList renderItem

<FlatList
  data={filteredTasks}
  keyExtractor={(item, index) => {
    // Safe key extraction with fallback
    if (item && item.id) {
      return item.id;
    }
    return `task-${index}-${Date.now()}`;
  }}
  refreshControl={
    <RefreshControl
      refreshing={loading}
      onRefresh={loadTasks}
      colors={['#FF6B9D']}
    />
  }
  renderItem={({ item }) => {
    // Skip rendering if item is invalid
    if (!item || !item.id) {
      console.warn('Skipping invalid task item', item);
      return null;
    }
    return (
      <TaskItem
        task={item}
        onToggle={toggleComplete}
        onDelete={deleteTask}
        onEdit={(task) => {
          setEditingTask(task);
          setShowModal(true);
        }}
      />
    );
  }}
  ListEmptyComponent={
    <TaskEmptyState
      icon="checkbox-outline"
      title="No tasks yet"
      subtitle={`No ${filter} tasks found`}
      actionLabel="Add your first task!"
      onAction={() => {
        setEditingTask(null);
        setShowModal(true);
      }}
    />
  }
  contentContainerStyle={styles.listContent}
/>

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 60 }]}
        onPress={() => {
          setEditingTask(null);
          setShowModal(true);
        }}
      >
        <Icon name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Task Modal */}
      <TaskModal
        visible={showModal}
        editingTask={editingTask}
        onClose={() => {
          setShowModal(false);
          setEditingTask(null);
        }}
        onSave={async (taskData) => {
          if (editingTask) {
            await updateTask(editingTask.id, taskData);
          } else {
            await addTask(taskData);
          }
          setShowModal(false);
          setEditingTask(null);
        }}
        colors={colors}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
  },
  syncBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
  },
  syncSpinner: {
    marginRight: 10,
  },
  syncText: {
    flex: 1,
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  syncNowBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 4,
  },
  syncNowText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  errorBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 8,
  },
  errorText: {
    color: '#fff',
    fontSize: 14,
  },
  retryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  listContent: {
    paddingBottom: 100,
  },
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FF6B9D',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6B9D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
});
