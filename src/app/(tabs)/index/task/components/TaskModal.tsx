import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Task, TaskPriority, TaskCreateDTO } from '../types/task.types';

interface TaskModalProps {
  visible: boolean;
  editingTask: Task | null;
  onClose: () => void;
  onSave: (task: TaskCreateDTO) => void;
  colors: any;
}

const PRIORITIES: TaskPriority[] = ['low', 'medium', 'high'];
const CATEGORIES = ['Work', 'Personal', 'Shopping', 'Health', 'Finance', 'Other'];

export function TaskModal({ visible, editingTask, onClose, onSave, colors }: TaskModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [category, setCategory] = useState('');
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customCategory, setCustomCategory] = useState('');

  useEffect(() => {
    if (editingTask) {
      setTitle(editingTask.title);
      setDescription(editingTask.description || '');
      setPriority(editingTask.priority);
      setCategory(editingTask.category || '');
      setDueDate(editingTask.dueDate ? new Date(editingTask.dueDate) : null);
    } else {
      resetForm();
    }
  }, [editingTask, visible]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setPriority('medium');
    setCategory('');
    setDueDate(null);
    setCustomCategory('');
  };

  const handleSave = () => {
    if (!title.trim()) return;
    
    onSave({
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      category: customCategory || category || undefined,
      dueDate: dueDate?.toISOString(),
    });
  };

  const renderPriorityButton = (p: TaskPriority) => {
    const colorsMap = {
      low: { bg: '#4CAF50', label: '🟢 Low' },
      medium: { bg: '#FF9800', label: '🟡 Medium' },
      high: { bg: '#F44336', label: '🔴 High' },
    };

    return (
      <TouchableOpacity
        key={p}
        style={[
          styles.priorityBtn,
          priority === p && { backgroundColor: colorsMap[p].bg },
          { borderColor: colorsMap[p].bg }
        ]}
        onPress={() => setPriority(p)}
      >
        <Text style={[
          styles.priorityBtnText,
          priority === p ? { color: '#fff' } : { color: colors.text }
        ]}>
          {colorsMap[p].label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editingTask ? '✏️ Edit Task' : '➕ New Task'}
              </Text>
              <TouchableOpacity onPress={onClose}>
                <Icon name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Title */}
            <TextInput
              style={[styles.input, { backgroundColor: colors.input, color: colors.text }]}
              placeholder="Task title *"
              placeholderTextColor="#999"
              value={title}
              onChangeText={setTitle}
              maxLength={100}
            />

            {/* Description */}
            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: colors.input, color: colors.text }]}
              placeholder="Description (optional)"
              placeholderTextColor="#999"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
            />

            {/* Priority */}
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.text }]}>Priority</Text>
              <View style={styles.priorityRow}>
                {PRIORITIES.map(renderPriorityButton)}
              </View>
            </View>

            {/* Category */}
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.text }]}>Category</Text>
              <View style={styles.categoryRow}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryBtn,
                      category === cat && styles.categoryActive,
                    ]}
                    onPress={() => {
                      setCategory(cat);
                      setCustomCategory('');
                    }}
                  >
                    <Text style={[
                      styles.categoryText,
                      category === cat && styles.categoryTextActive,
                      { color: category === cat ? '#fff' : colors.text }
                    ]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={[styles.input, { backgroundColor: colors.input, color: colors.text, marginTop: 8 }]}
                placeholder="Custom category"
                placeholderTextColor="#999"
                value={customCategory}
                onChangeText={(text) => {
                  setCustomCategory(text);
                  setCategory('');
                }}
              />
            </View>

            {/* Due Date */}
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.text }]}>Due Date</Text>
              <TouchableOpacity
                style={[styles.dateBtn, { backgroundColor: colors.input }]}
                onPress={() => setShowDatePicker(true)}
              >
                <Icon name="calendar-outline" size={20} color={colors.text} />
                <Text style={[styles.dateText, { color: colors.text }]}>
                  {dueDate ? dueDate.toLocaleDateString() : 'Set due date'}
                </Text>
                {dueDate && (
                  <TouchableOpacity onPress={() => setDueDate(null)}>
                    <Icon name="close-circle" size={20} color="#999" />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            </View>

            {/* Save Button */}
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: '#FF6B9D', opacity: title.trim() ? 1 : 0.5 }]}
              onPress={handleSave}
              disabled={!title.trim()}
            >
              <Text style={styles.saveBtnText}>
                {editingTask ? 'Update Task' : 'Add Task'}
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {showDatePicker && (
            <DateTimePicker
              value={dueDate || new Date()}
              mode="date"
              onChange={(event, selectedDate) => {
                setShowDatePicker(false);
                if (selectedDate) {
                  setDueDate(selectedDate);
                }
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  input: {
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginBottom: 12,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  priorityRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  priorityBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: '#F0F0F0',
  },
  priorityBtnText: {
    fontSize: 13,
    fontWeight: '500',
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  categoryBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F0F0F0',
  },
  categoryActive: {
    backgroundColor: '#FF6B9D',
  },
  categoryText: {
    fontSize: 12,
  },
  categoryTextActive: {
    color: '#fff',
  },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    gap: 12,
  },
  dateText: {
    flex: 1,
    fontSize: 16,
  },
  saveBtn: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
