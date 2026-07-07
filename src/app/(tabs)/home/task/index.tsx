import React, { useState, useEffect } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Text,
  ScrollView,
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
import { TaskShareModal } from './components/TaskShareModal';
import { TaskActivityLog } from './components/TaskActivityLog';
import { TaskListModal } from './components/TaskListModal';
import { TaskProjectModal } from './components/TaskProjectModal';
import { TaskTemplateModal } from './components/TaskTemplateModal';
import { Task, TaskFilterType } from './types/task.types';

export default function TasksScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<TaskFilterType>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [showListModal, setShowListModal] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  
  const {
    tasks,
    loading,
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
    getLists,
    getProjects,
    createList,
    createProject,
    applyTemplate,
  } = useTasks();

  const filteredTasks = getFilteredTasks(filter);
  const stats = getStats();

const handleShare = async (taskId: string, userIds: string[]) => {
  try {
    const { data, error } = await supabase
      .from('shared_tasks')
      .insert(
        userIds.map(userId => ({
          task_id: taskId,
          shared_by: currentUserId,
          shared_with: userId,
          permissions: 'edit',
        }))
      );

    if (error) throw error;
    Alert.alert('✅ Shared!', `Task shared with ${userIds.length} user(s)`);
  } catch (error) {
    console.error('Error sharing task:', error);
    Alert.alert('❌ Error', 'Could not share task');
  }
};

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={[styles.title, { color: colors.text }]}>Tasks</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={() => setShowListModal(true)} style={styles.headerBtn}>
            <Icon name="list-outline" size={22} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowProjectModal(true)} style={styles.headerBtn}>
            <Icon name="folder-outline" size={22} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowTemplateModal(true)} style={styles.headerBtn}>
            <Icon name="copy-outline" size={22} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowActivityLog(true)} style={styles.headerBtn}>
            <Icon name="time-outline" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats */}
      <TaskStats stats={stats} colors={colors} />

      {/* Filters */}
      <TaskFilterComponent 
        currentFilter={filter} 
        onFilterChange={setFilter} 
        colors={colors} 
      />

      {/* List */}
      <FlatList
        data={filteredTasks}
        keyExtractor={(item, index) => item?.id || `task-${index}`}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={loadTasks}
            colors={[colors.primary]}
          />
        }
        renderItem={({ item }) => {
          if (!item || !item.id) return null;
          return (
            <TaskItem
              task={item}
              onToggle={toggleComplete}
              onDelete={deleteTask}
              onEdit={(task) => {
                setEditingTask(task);
                setShowModal(true);
              }}
              onShare={(task) => {
                setSelectedTask(task);
                setShowShareModal(true);
              }}
              colors={colors}
            />
          );
        }}
        ListEmptyComponent={
          <TaskEmptyState
            icon="checkbox-outline"
            title="No tasks yet"
            subtitle={`No ${filter} tasks found`}
            actionLabel="Create your first task"
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
        style={[styles.fab, { backgroundColor: colors.primary, bottom: insets.bottom + 20 }]}
        onPress={() => {
          setEditingTask(null);
          setShowModal(true);
        }}
      >
        <Icon name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Modals */}
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
        lists={getLists()}
        projects={getProjects()}
      />

<TaskShareModal
        visible={showShareModal}
        task={selectedTask}
        onClose={() => {
          setShowShareModal(false);
          setSelectedTask(null);
        }}
        onShare={async (taskId, userIds) => {
          // Share implementation
          setShowShareModal(false);
        }}
        colors={colors}
      />

      <TaskActivityLog
        visible={showActivityLog}
        onClose={() => setShowActivityLog(false)}
        colors={colors}
      />

      <TaskListModal
        visible={showListModal}
        onClose={() => setShowListModal(false)}
        onCreateList={createList}
        colors={colors}
      />

      <TaskProjectModal
        visible={showProjectModal}
        onClose={() => setShowProjectModal(false)}
        onCreateProject={createProject}
        colors={colors}
      />

      <TaskTemplateModal
        visible={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        onApplyTemplate={applyTemplate}
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
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 16,
  },
  headerBtn: {
    padding: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
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
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
});
