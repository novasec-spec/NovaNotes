import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { ActivityLog } from '../types/task.types';
import { TaskService } from '../services/taskService';

interface TaskActivityLogProps {
  visible: boolean;
  onClose: () => void;
  colors: any;
}

export function TaskActivityLog({ visible, onClose, colors }: TaskActivityLogProps) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const taskService = TaskService.getInstance();

  useEffect(() => {
    if (visible) {
      loadLogs();
    }
  }, [visible]);

  const loadLogs = async () => {
    setLoading(true);
    const data = await taskService.getActivityLog();
    setLogs(data);
    setLoading(false);
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'created': return 'add-circle-outline';
      case 'updated': return 'pencil-outline';
      case 'completed': return 'checkmark-circle-outline';
      case 'deleted': return 'trash-outline';
      case 'shared': return 'share-social-outline';
      case 'comment': return 'chatbubble-outline';
      case 'assigned': return 'person-add-outline';
      case 'status_change': return 'refresh-outline';
      default: return 'time-outline';
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'created': return '#4CAF50';
      case 'completed': return '#4CAF50';
      case 'updated': return '#2196F3';
      case 'deleted': return '#F44336';
      case 'shared': return '#9C27B0';
      case 'comment': return '#FF9800';
      case 'assigned': return '#00BCD4';
      case 'status_change': return '#FF5722';
      default: return '#999';
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'created': return 'Created';
      case 'updated': return 'Updated';
      case 'completed': return 'Completed';
      case 'deleted': return 'Deleted';
      case 'shared': return 'Shared';
      case 'comment': return 'Commented';
      case 'assigned': return 'Assigned';
      case 'status_change': return 'Status Changed';
      default: return action;
    }
  };

  const renderLog = ({ item }: { item: ActivityLog }) => {
    const actionIcon = getActionIcon(item.action);
    const actionColor = getActionColor(item.action);
    const actionLabel = getActionLabel(item.action);

    return (
      <View style={[styles.logItem, { backgroundColor: colors.card, borderLeftColor: actionColor }]}>
        <View style={styles.logIcon}>
          <Icon name={actionIcon} size={20} color={actionColor} />
        </View>
        <View style={styles.logContent}>
          <Text style={[styles.logAction, { color: colors.text }]}>
            {actionLabel}
          </Text>
          <Text style={[styles.logDetails, { color: colors.muted }]}>
            {item.details?.title || item.details?.text || 'Task updated'}
          </Text>
          <Text style={[styles.logTime, { color: colors.muted }]}>
            {new Date(item.timestamp).toLocaleString()}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Activity Log
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Icon name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.statsBar}>
            <Text style={[styles.statsText, { color: colors.muted }]}>
              Total: {logs.length} activities
            </Text>
            <TouchableOpacity onPress={loadLogs}>
              <Icon name="refresh-outline" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>

          <FlatList
            data={logs}
            keyExtractor={(item) => item.id}
            renderItem={renderLog}
            contentContainerStyle={styles.logsList}
            showsVerticalScrollIndicator={false}
            refreshing={loading}
            onRefresh={loadLogs}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Icon name="time-outline" size={48} color={colors.muted} />
                <Text style={[styles.emptyText, { color: colors.muted }]}>
                  No activity yet
                </Text>
              </View>
            }
          />
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
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statsText: {
    fontSize: 13,
  },
  logsList: {
    paddingBottom: 16,
  },
  logItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
  },
  logIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  logContent: {
    flex: 1,
  },
  logAction: {
    fontSize: 14,
    fontWeight: '600',
  },
  logDetails: {
    fontSize: 13,
    marginTop: 2,
  },
  logTime: {
    fontSize: 11,
    marginTop: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 12,
  },
});
