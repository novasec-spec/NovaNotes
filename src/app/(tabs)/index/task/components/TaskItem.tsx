import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { Task } from '../types/task.types';
import { useTheme } from '../../../../../contexts/ThemeContext';

interface TaskItemProps {
  task: Task;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (task: Task) => void;
}

export function TaskItem({ task, onToggle, onDelete, onEdit }: TaskItemProps) {
  const { colors } = useTheme();
  const [swipeAnim] = React.useState(new Animated.Value(0));

  // Comprehensive null checks
  if (!task) {
    console.warn('TaskItem: task is null or undefined');
    return null;
  }

  // Safely access id with fallback
  const taskId = task.id || task._id || '';
  
  if (!taskId) {
    console.warn('TaskItem: task has no id', task);
    return null;
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return '#F44336';
      case 'medium': return '#FF9800';
      case 'low': return '#4CAF50';
      default: return '#999';
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'high': return '🔴';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  };

  // Safe checks using taskId
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !task.completed;
  const isPendingSync = !task._synced && !taskId.startsWith('local_');
  const isLocalTask = taskId.startsWith('local_') && task._synced === false;
  const isDeleted = task._deleted === true;

  return (
    <Animated.View style={[
      styles.container,
      {
        backgroundColor: colors.card,
        transform: [{ translateX: swipeAnim }]
      }
    ]}>
      <TouchableOpacity
        style={[styles.taskItem, { backgroundColor: colors.card }]}
        onPress={() => onToggle(taskId)}
        onLongPress={() => onEdit(task)}
        activeOpacity={0.7}
      >
        <TouchableOpacity onPress={() => onToggle(taskId)}>
          <Icon
            name={task.completed ? 'checkbox' : 'square-outline'}
            size={24}
            color={task.completed ? '#4CAF50' : colors.text}
          />
        </TouchableOpacity>

        <View style={styles.taskContent}>
          <View style={styles.titleRow}>
            <Text
              style={[
                styles.taskTitle,
                { color: colors.text },
                task.completed && styles.taskCompleted,
              ]}
              numberOfLines={1}
            >
              {task.title || 'Untitled Task'}
            </Text>
            <Text style={styles.priorityEmoji}>
              {getPriorityLabel(task.priority)}
            </Text>
          </View>

          {task.description && (
            <Text style={[styles.taskDesc, { color: colors.muted }]} numberOfLines={1}>
              {task.description}
            </Text>
          )}

          <View style={styles.metaRow}>
            {task.category && (
              <View style={[styles.categoryTag, { backgroundColor: colors.muted + '30' }]}>
                <Text style={[styles.categoryText, { color: colors.text }]}>
                  #{task.category}
                </Text>
              </View>
            )}
            
            {task.dueDate && (
              <Text style={[
                styles.dueDate,
                { color: isOverdue ? '#F44336' : colors.muted }
              ]}>
                {isOverdue ? '⚠️ Overdue' : `📅 ${new Date(task.dueDate).toLocaleDateString()}`}
              </Text>
            )}

            {/* Sync Status Indicators */}
            {isLocalTask && (
              <Text style={[styles.syncStatus, { color: '#FF9800' }]}>
                ⏳ Creating...
              </Text>
            )}
            
            {isPendingSync && (
              <Text style={[styles.syncStatus, { color: '#FF9800' }]}>
                🔄 Syncing...
              </Text>
            )}
            
            {isDeleted && (
              <Text style={[styles.syncStatus, { color: '#F44336' }]}>
                🗑️ Deleting...
              </Text>
            )}
          </View>
        </View>

        <TouchableOpacity
          onPress={() => onDelete(taskId)}
          style={styles.deleteBtn}
        >
          <Icon name="trash-outline" size={20} color="#999" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  taskContent: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  taskCompleted: {
    textDecorationLine: 'line-through',
    opacity: 0.6,
  },
  priorityEmoji: {
    fontSize: 14,
    marginLeft: 8,
  },
  taskDesc: {
    fontSize: 13,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  categoryTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 11,
  },
  dueDate: {
    fontSize: 11,
  },
  syncStatus: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  deleteBtn: {
    padding: 4,
  },
});
