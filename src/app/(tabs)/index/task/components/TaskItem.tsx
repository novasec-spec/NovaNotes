import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Animated,
  GestureResponderEvent,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { Task } from '../types/task.types';
import { PRIORITY_COLORS } from '../constants/taskConstants';

interface TaskItemProps {
  task: Task;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (task: Task) => void;
  onShare: (task: Task) => void;
  colors: any;
}

export function TaskItem({ task, onToggle, onDelete, onEdit, onShare, colors }: TaskItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [swipeAnim] = useState(new Animated.Value(0));

  if (!task || !task.id) return null;

  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !task.completed;
  const progressColor = task.completed ? colors.success : isOverdue ? colors.error : colors.primary;

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'critical': return 'alert-circle';
      case 'high': return 'warning';
      case 'medium': return 'radio-button-on';
      case 'low': return 'radio-button-off';
      default: return 'radio-button-off';
    }
  };

  const getTagColor = (tag: string) => {
    const tagColors: Record<string, string> = {
      urgent: colors.error,
      important: colors.warning,
      meeting: colors.info,
      call: colors.success,
      email: colors.primary,
      review: colors.secondary,
      'follow-up': colors.warning,
      waiting: colors.muted,
    };
    return tagColors[tag] || colors.muted;
  };

  return (
    <Animated.View style={[
      styles.container,
      { 
        backgroundColor: colors.card,
        transform: [{ translateX: swipeAnim }],
        borderLeftColor: task.completed ? colors.success : PRIORITY_COLORS[task.priority] || colors.primary,
        borderLeftWidth: 4,
      }
    ]}>
      <TouchableOpacity
        style={styles.taskItem}
        onPress={() => onToggle(task.id)}
        activeOpacity={0.7}
      >
        <View style={styles.leftSection}>
          <TouchableOpacity onPress={() => onToggle(task.id)}>
            <Icon
              name={task.completed ? 'checkmark-circle' : 'ellipse-outline'}
              size={24}
              color={task.completed ? colors.success : colors.text}
            />
          </TouchableOpacity>
          
          <View style={styles.contentSection}>
            <View style={styles.titleRow}>
              <Text
                style={[
                  styles.taskTitle,
                  { color: colors.text },
                  task.completed && styles.taskCompleted,
                ]}
                numberOfLines={1}
              >
                {task.title}
              </Text>
              {task.priority && (
                <Icon
                  name={getPriorityIcon(task.priority)}
                  size={16}
                  color={PRIORITY_COLORS[task.priority] || colors.muted}
                />
              )}
            </View>

            {task.description && (
              <Text style={[styles.taskDesc, { color: colors.muted }]} numberOfLines={1}>
                {task.description}
              </Text>
            )}

            <View style={styles.metaRow}>
              {task.tags?.map((tag: string) => (
                <View key={tag} style={[styles.tag, { backgroundColor: getTagColor(tag) + '20' }]}>
                  <Text style={[styles.tagText, { color: getTagColor(tag) }]}>
                    {tag}
                  </Text>
                </View>
              ))}

              {task.dueDate && (
                <Text style={[styles.dueDate, { color: isOverdue ? colors.error : colors.muted }]}>
                  <Icon name="calendar-outline" size={12} color={isOverdue ? colors.error : colors.muted} />
                  {' '}{new Date(task.dueDate).toLocaleDateString()}
                  {task.dueTime && ` at ${task.dueTime}`}
                </Text>
              )}

              {task.estimatedHours && (
                <Text style={[styles.estimate, { color: colors.muted }]}>
                  <Icon name="time-outline" size={12} color={colors.muted} />
                  {' '}{task.estimatedHours}h
                </Text>
              )}

              {task.projectId && (
                <Text style={[styles.projectTag, { color: colors.primary }]}>
                  <Icon name="folder-outline" size={12} color={colors.primary} />
                  {' '}Project
                </Text>
              )}
            </View>

            {/* Progress Bar */}
            {!task.completed && task.progress !== undefined && (
              <View style={[styles.progressContainer, { backgroundColor: colors.border }]}>
                <View 
                  style={[
                    styles.progressBar, 
                    { 
                      width: `${task.progress}%`,
                      backgroundColor: progressColor,
                    }
                  ]} 
                />
                <Text style={[styles.progressText, { color: colors.text }]}>
                  {task.progress}%
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.rightSection}>
          <TouchableOpacity onPress={() => onShare(task)} style={styles.actionBtn}>
            <Icon name="share-outline" size={18} color={colors.muted} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onEdit(task)} style={styles.actionBtn}>
            <Icon name="pencil-outline" size={18} color={colors.muted} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onDelete(task.id)} style={styles.actionBtn}>
            <Icon name="trash-outline" size={18} color={colors.error} />
          </TouchableOpacity>
        </View>
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
    justifyContent: 'space-between',
    padding: 14,
    gap: 12,
  },
  leftSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  contentSection: {
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
  taskDesc: {
    fontSize: 13,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '500',
  },
  dueDate: {
    fontSize: 11,
  },
  estimate: {
    fontSize: 11,
  },
  projectTag: {
    fontSize: 11,
    fontWeight: '500',
  },
  progressContainer: {
    height: 4,
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  progressBar: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 9,
    position: 'absolute',
    right: 4,
    top: -8,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    padding: 4,
  },
});
