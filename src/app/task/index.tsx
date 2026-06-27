// src/app/(tabs)/tasks/index.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Modal,
  Switch,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';
import Icon from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../config/supabase';

interface Task {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
  category?: string;
  dueDate?: string;
  createdAt: string;
  _synced?: boolean;
}

export default function TasksScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all');

  useEffect(() => {
    loadTasks();
  }, []);

  const loadTasks = async () => {
    try {
      const cached = await AsyncStorage.getItem('tasks_data');
      if (cached) {
        setTasks(JSON.parse(cached));
      }
      await syncTasks();
    } catch (error) {
      console.error('Load tasks error:', error);
    } finally {
      setLoading(false);
    }
  };

  const syncTasks = async () => {
    // Sync with Supabase
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data && data.length > 0) {
        const formattedTasks = data.map((t) => ({
          id: t.id,
          title: t.title,
          description: t.description,
          completed: t.completed,
          priority: t.priority,
          category: t.category,
          dueDate: t.due_date,
          createdAt: t.created_at,
          _synced: true,
        }));
        setTasks(formattedTasks);
        await AsyncStorage.setItem('tasks_data', JSON.stringify(formattedTasks));
      }
    } catch (error) {
      console.error('Sync tasks error:', error);
    }
  };

  const saveTask = async (task: Task) => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .upsert({
          id: task.id,
          title: task.title,
          description: task.description,
          completed: task.completed,
          priority: task.priority,
          category: task.category,
          due_date: task.dueDate,
          created_at: task.createdAt,
        })
        .select()
        .single();

      if (error) throw error;

      const updated = tasks.map((t) => (t.id === task.id ? { ...task, _synced: true } : t));
      setTasks(updated);
      await AsyncStorage.setItem('tasks_data', JSON.stringify(updated));
    } catch (error) {
      console.error('Save task error:', error);
    }
  };

  const deleteTask = async (id: string) => {
    try {
      await supabase.from('tasks').delete().eq('id', id);
      const updated = tasks.filter((t) => t.id !== id);
      setTasks(updated);
      await AsyncStorage.setItem('tasks_data', JSON.stringify(updated));
    } catch (error) {
      console.error('Delete task error:', error);
    }
  };

  const toggleComplete = async (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const updated = { ...task, completed: !task.completed };
    await saveTask(updated);
  };

  const filteredTasks = tasks
    .filter((t) => {
      if (filter === 'active') return !t.completed;
      if (filter === 'completed') return t.completed;
      return true;
    })
    .sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const stats = {
    total: tasks.length,
    completed: tasks.filter((t) => t.completed).length,
    active: tasks.filter((t) => !t.completed).length,
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>✅ Tasks</Text>
        <Text style={[styles.stats, { color: colors.text }]}>
          {stats.active} active • {stats.completed} done
        </Text>
      </View>

      {/* Filters */}
      <View style={styles.filterRow}>
        {['all', 'active', 'completed'].map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterActive]}
            onPress={() => setFilter(f as any)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      <FlatList
        data={filteredTasks}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); syncTasks().finally(() => setRefreshing(false)); }} />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.taskItem, { backgroundColor: colors.card }]}
            onPress={() => toggleComplete(item.id)}
            onLongPress={() => { setEditingTask(item); setShowModal(true); }}
          >
            <TouchableOpacity onPress={() => toggleComplete(item.id)}>
              <Icon
                name={item.completed ? 'checkbox' : 'square-outline'}
                size={24}
                color={item.completed ? '#4CAF50' : colors.text}
              />
            </TouchableOpacity>
            <View style={styles.taskContent}>
              <Text
                style={[
                  styles.taskTitle,
                  { color: colors.text },
                  item.completed && styles.taskCompleted,
                ]}
                numberOfLines={1}
              >
                {item.title}
              </Text>
              {item.description && (
                <Text style={[styles.taskDesc, { color: colors.muted }]} numberOfLines={1}>
                  {item.description}
                </Text>
              )}
            </View>
            <View style={styles.taskRight}>
              <View style={[styles.priorityDot, { backgroundColor: item.priority === 'high' ? '#F44336' : item.priority === 'medium' ? '#FF9800' : '#4CAF50' }]} />
              <TouchableOpacity onPress={() => { deleteTask(item.id); }}>
                <Icon name="trash-outline" size={20} color="#999" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="checkbox-outline" size={60} color="#ccc" />
            <Text style={[styles.emptyText, { color: colors.text }]}>No tasks yet</Text>
            <Text style={[styles.emptySub, { color: colors.muted }]}>Add your first task!</Text>
          </View>
        }
      />

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 20 }]}
        onPress={() => { setEditingTask(null); setShowModal(true); }}
      >
        <Icon name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Add/Edit Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editingTask ? 'Edit Task' : 'New Task'}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Icon name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.input, color: colors.text }]}
              placeholder="Task title"
              placeholderTextColor="#999"
              value={editingTask?.title || ''}
              onChangeText={(text) => setEditingTask(prev => prev ? { ...prev, title: text } : { id: Date.now().toString(), title: text, completed: false, priority: 'medium', createdAt: new Date().toISOString() })}
            />

            <TextInput
              style={[styles.modalInput, styles.modalTextArea, { backgroundColor: colors.input, color: colors.text }]}
              placeholder="Description (optional)"
              placeholderTextColor="#999"
              value={editingTask?.description || ''}
              onChangeText={(text) => setEditingTask(prev => prev ? { ...prev, description: text } : null)}
              multiline
            />

            <View style={styles.priorityRow}>
              <Text style={[styles.priorityLabel, { color: colors.text }]}>Priority:</Text>
              {['low', 'medium', 'high'].map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.priorityBtn,
                    editingTask?.priority === p && styles.priorityActive,
                    { borderColor: p === 'high' ? '#F44336' : p === 'medium' ? '#FF9800' : '#4CAF50' },
                  ]}
                  onPress={() => setEditingTask(prev => prev ? { ...prev, priority: p as any } : null)}
                >
                  <Text style={[styles.priorityBtnText, { color: editingTask?.priority === p ? '#fff' : colors.text }]}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: '#FF6B9D' }]}
              onPress={() => {
                if (editingTask?.title) {
                  if (tasks.find((t) => t.id === editingTask.id)) {
                    saveTask(editingTask);
                  } else {
                    const newTask = { ...editingTask, _synced: false };
                    setTasks([newTask, ...tasks]);
                    AsyncStorage.setItem('tasks_data', JSON.stringify([newTask, ...tasks]));
                    saveTask(newTask);
                  }
                  setShowModal(false);
                  setEditingTask(null);
                }
              }}
            >
              <Text style={styles.saveBtnText}>Save Task</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: { fontSize: 28, fontWeight: '800' },
  stats: { fontSize: 14 },
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
  filterActive: { backgroundColor: '#FF6B9D' },
  filterText: { fontSize: 14, color: '#666' },
  filterTextActive: { color: '#fff' },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    gap: 12,
  },
  taskContent: { flex: 1 },
  taskTitle: { fontSize: 16, fontWeight: '500' },
  taskCompleted: { textDecorationLine: 'line-through', opacity: 0.6 },
  taskDesc: { fontSize: 13, marginTop: 2 },
  taskRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  priorityDot: { width: 10, height: 10, borderRadius: 5 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyText: { fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptySub: { fontSize: 14, marginTop: 4 },
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: '700' },
  modalInput: {
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginBottom: 12,
  },
  modalTextArea: { minHeight: 80, textAlignVertical: 'top' },
  priorityRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  priorityLabel: { fontSize: 14, fontWeight: '500' },
  priorityBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  priorityActive: { backgroundColor: '#FF6B9D', borderColor: '#FF6B9D' },
  priorityBtnText: { fontSize: 13, fontWeight: '500' },
  saveBtn: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
