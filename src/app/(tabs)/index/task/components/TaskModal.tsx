import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
  Switch,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import Icon from 'react-native-vector-icons/Ionicons';
import { Task, TaskCreateDTO, TaskPriority, TaskList, Project } from '../types/task.types';
import { PRIORITY_COLORS, DEFAULT_TAGS, REMINDER_TIMES } from '../constants/taskConstants';

interface TaskModalProps {
  visible: boolean;
  editingTask: Task | null;
  onClose: () => void;
  onSave: (task: TaskCreateDTO) => void;
  colors: any;
  lists?: TaskList[];
  projects?: Project[];
}

export function TaskModal({ 
  visible, 
  editingTask, 
  onClose, 
  onSave, 
  colors,
  lists = [],
  projects = [],
}: TaskModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [dueTime, setDueTime] = useState<string>('');
  const [estimatedHours, setEstimatedHours] = useState<string>('');
  const [projectId, setProjectId] = useState<string>('');
  const [listId, setListId] = useState<string>('');
  const [reminderTime, setReminderTime] = useState<string>('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [customTag, setCustomTag] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (editingTask) {
      setTitle(editingTask.title);
      setDescription(editingTask.description || '');
      setPriority(editingTask.priority);
      setCategory(editingTask.category || '');
      setTags(editingTask.tags || []);
      setDueDate(editingTask.dueDate ? new Date(editingTask.dueDate) : null);
      setDueTime(editingTask.dueTime || '');
      setEstimatedHours(editingTask.estimatedHours?.toString() || '');
      setProjectId(editingTask.projectId || '');
      setListId(editingTask.listId || '');
      setReminderTime(editingTask.reminderTime || '');
    } else {
      resetForm();
    }
  }, [editingTask, visible]);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setPriority('medium');
    setCategory('');
    setTags([]);
    setDueDate(null);
    setDueTime('');
    setEstimatedHours('');
    setProjectId('');
    setListId('');
    setReminderTime('');
    setCustomTag('');
    setShowAdvanced(false);
  };

  const handleSave = () => {
    if (!title.trim()) return;

    const taskData: TaskCreateDTO = {
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      category: category || undefined,
      tags: tags.length > 0 ? tags : undefined,
      dueDate: dueDate?.toISOString(),
      dueTime: dueTime || undefined,
      estimatedHours: estimatedHours ? parseFloat(estimatedHours) : undefined,
      projectId: projectId || undefined,
      listId: listId || undefined,
      reminderTime: reminderTime || undefined,
    };

    onSave(taskData);
  };

  const toggleTag = (tag: string) => {
    if (tags.includes(tag)) {
      setTags(tags.filter(t => t !== tag));
    } else {
      setTags([...tags, tag]);
    }
  };

  const addCustomTag = () => {
    if (customTag.trim() && !tags.includes(customTag.trim())) {
      setTags([...tags, customTag.trim()]);
      setCustomTag('');
    }
  };

  const renderPriorityButton = (p: TaskPriority) => {
    const label = p.charAt(0).toUpperCase() + p.slice(1);
    const isActive = priority === p;
    const color = PRIORITY_COLORS[p];

    return (
      <TouchableOpacity
        key={p}
        style={[
          styles.priorityBtn,
          { 
            backgroundColor: isActive ? color : colors.card,
            borderColor: color,
            borderWidth: isActive ? 2 : 1,
          }
        ]}
        onPress={() => setPriority(p)}
      >
        <Icon 
          name={isActive ? 'radio-button-on' : 'radio-button-off'} 
          size={16} 
          color={isActive ? '#fff' : color} 
        />
        <Text style={[
          styles.priorityBtnText,
          { color: isActive ? '#fff' : color }
        ]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editingTask ? 'Edit Task' : 'New Task'}
              </Text>
              <TouchableOpacity onPress={onClose}>
                <Icon name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Title */}
            <TextInput
              style={[styles.input, { 
                backgroundColor: colors.card, 
                color: colors.text,
                borderColor: colors.border,
              }]}
              placeholder="Task title *"
              placeholderTextColor={colors.muted}
              value={title}
              onChangeText={setTitle}
              maxLength={100}
            />

            {/* Description */}
            <TextInput
              style={[styles.input, styles.textArea, { 
                backgroundColor: colors.card, 
                color: colors.text,
                borderColor: colors.border,
              }]}
              placeholder="Description (optional)"
              placeholderTextColor={colors.muted}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
            />

            {/* Priority */}
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.text }]}>Priority</Text>
              <View style={styles.priorityRow}>
                {renderPriorityButton('critical')}
                {renderPriorityButton('high')}
                {renderPriorityButton('medium')}
                {renderPriorityButton('low')}
              </View>
            </View>

            {/* Due Date & Time */}
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.text }]}>Due Date & Time</Text>
              <View style={styles.dateTimeRow}>
                <TouchableOpacity
                  style={[styles.dateBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Icon name="calendar-outline" size={20} color={colors.primary} />
                  <Text style={[styles.dateText, { color: colors.text }]}>
                    {dueDate ? dueDate.toLocaleDateString() : 'Select date'}
                  </Text>
                  {dueDate && (
                    <TouchableOpacity onPress={() => setDueDate(null)}>
                      <Icon name="close-circle" size={16} color={colors.muted} />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.dateBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => setShowTimePicker(true)}
                >
                  <Icon name="time-outline" size={20} color={colors.primary} />
                  <Text style={[styles.dateText, { color: colors.text }]}>
                    {dueTime || 'Select time'}
                  </Text>
                  {dueTime && (
                    <TouchableOpacity onPress={() => setDueTime('')}>
                      <Icon name="close-circle" size={16} color={colors.muted} />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Tags */}
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.text }]}>Tags</Text>
              <View style={styles.tagsRow}>
                {DEFAULT_TAGS.map((tag) => (
                  <TouchableOpacity
                    key={tag}
                    style={[
                      styles.tagBtn,
                      { 
                        backgroundColor: tags.includes(tag) ? colors.primary : colors.card,
                        borderColor: colors.border,
                      }
                    ]}
                    onPress={() => toggleTag(tag)}
                  >
                    <Text style={[
                      styles.tagBtnText,
                      { color: tags.includes(tag) ? '#fff' : colors.text }
                    ]}>
                      {tag}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.customTagRow}>
                <TextInput
                  style={[styles.input, { 
                    flex: 1,
                    backgroundColor: colors.card, 
                    color: colors.text,
                    borderColor: colors.border,
                    marginBottom: 0,
                  }]}
                  placeholder="Add custom tag"
                  placeholderTextColor={colors.muted}
                  value={customTag}
                  onChangeText={setCustomTag}
                />
                <TouchableOpacity
                  style={[styles.addTagBtn, { backgroundColor: colors.primary }]}
                  onPress={addCustomTag}
                >
                  <Icon name="add" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Advanced Options */}
            <TouchableOpacity
              style={styles.advancedToggle}
              onPress={() => setShowAdvanced(!showAdvanced)}
            >
              <Icon name={showAdvanced ? 'chevron-up' : 'chevron-down'} size={20} color={colors.text} />
              <Text style={[styles.advancedText, { color: colors.text }]}>
                {showAdvanced ? 'Hide Advanced Options' : 'Show Advanced Options'}
              </Text>
            </TouchableOpacity>

            {showAdvanced && (
              <View style={styles.advancedSection}>
                {/* Estimated Hours */}
                <View style={styles.section}>
                  <Text style={[styles.sectionLabel, { color: colors.text }]}>
                    Estimated Hours
                  </Text>
                  <TextInput
                    style={[styles.input, { 
                      backgroundColor: colors.card, 
                      color: colors.text,
                      borderColor: colors.border,
                    }]}
                    placeholder="e.g., 2.5"
                    placeholderTextColor={colors.muted}
                    value={estimatedHours}
                    onChangeText={setEstimatedHours}
                    keyboardType="decimal-pad"
                  />
                </View>

                {/* Project */}
                {projects.length > 0 && (
                  <View style={styles.section}>
                    <Text style={[styles.sectionLabel, { color: colors.text }]}>Project</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {projects.map((project) => (
                        <TouchableOpacity
                          key={project.id}
                          style={[
                            styles.selectBtn,
                            { 
                              backgroundColor: projectId === project.id ? colors.primary : colors.card,
                              borderColor: project.color,
                              borderWidth: 1,
                            }
                          ]}
                          onPress={() => setProjectId(projectId === project.id ? '' : project.id)}
                        >
                          <Icon name="folder-outline" size={16} color={projectId === project.id ? '#fff' : project.color} />
                          <Text style={[
                            styles.selectBtnText,
                            { color: projectId === project.id ? '#fff' : colors.text }
                          ]}>
                            {project.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* List */}
                {lists.length > 0 && (
                  <View style={styles.section}>
                    <Text style={[styles.sectionLabel, { color: colors.text }]}>List</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {lists.map((list) => (
                        <TouchableOpacity
                          key={list.id}
                          style={[
                            styles.selectBtn,
                            { 
                              backgroundColor: listId === list.id ? colors.primary : colors.card,
                              borderColor: list.color,
                              borderWidth: 1,
                            }
                          ]}
                          onPress={() => setListId(listId === list.id ? '' : list.id)}
                        >
                          <Icon name={list.icon || 'list-outline'} size={16} color={listId === list.id ? '#fff' : list.color} />
                          <Text style={[
                            styles.selectBtnText,
                            { color: listId === list.id ? '#fff' : colors.text }
                          ]}>
                            {list.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {/* Reminder */}
                <View style={styles.section}>
                  <Text style={[styles.sectionLabel, { color: colors.text }]}>Reminder</Text>
                  <View style={styles.reminderRow}>
                    {REMINDER_TIMES.map((time) => (
                      <TouchableOpacity
                        key={time}
                        style={[
                          styles.reminderBtn,
                          { 
                            backgroundColor: reminderTime === time ? colors.primary : colors.card,
                            borderColor: colors.border,
                          }
                        ]}
                        onPress={() => setReminderTime(reminderTime === time ? '' : time)}
                      >
                        <Text style={[
                          styles.reminderBtnText,
                          { color: reminderTime === time ? '#fff' : colors.text }
                        ]}>
                          {time}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            )}

            {/* Save Button */}
            <TouchableOpacity
              style={[styles.saveBtn, { 
                backgroundColor: colors.primary,
                opacity: title.trim() ? 1 : 0.5,
              }]}
              onPress={handleSave}
              disabled={!title.trim()}
            >
              <Text style={styles.saveBtnText}>
                {editingTask ? 'Update Task' : 'Create Task'}
              </Text>
            </TouchableOpacity>
          </ScrollView>

          {showDatePicker && (
            <DateTimePicker
              value={dueDate || new Date()}
              mode="date"
              onChange={(event, selectedDate) => {
                setShowDatePicker(false);
                if (selectedDate) setDueDate(selectedDate);
              }}
            />
          )}

          {showTimePicker && (
            <DateTimePicker
              value={dueDate || new Date()}
              mode="time"
              onChange={(event, selectedDate) => {
                setShowTimePicker(false);
                if (selectedDate) {
                  const hours = selectedDate.getHours().toString().padStart(2, '0');
                  const minutes = selectedDate.getMinutes().toString().padStart(2, '0');
                  setDueTime(`${hours}:${minutes}`);
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
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
    marginBottom: 16,
    borderBottomWidth: 1,
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
    borderWidth: 1,
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
  },
  priorityBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 20,
    gap: 4,
  },
  priorityBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dateBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  dateText: {
    flex: 1,
    fontSize: 14,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  tagBtnText: {
    fontSize: 12,
    fontWeight: '500',
  },
  customTagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  addTagBtn: {
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  advancedText: {
    fontSize: 14,
    fontWeight: '500',
  },
  advancedSection: {
    marginTop: 8,
  },
  selectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
    gap: 6,
  },
  selectBtnText: {
    fontSize: 12,
    fontWeight: '500',
  },
  reminderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  reminderBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  reminderBtnText: {
    fontSize: 12,
    fontWeight: '500',
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
