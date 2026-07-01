// src/components/notification/NotificationList.tsx

import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  FlatList,
  RefreshControl,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NotificationItem } from './NotificationItem';
import { AppNotification } from '../../types/notifications';

interface NotificationListProps {
  notifications: AppNotification[];
  loading?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  onLoadMore?: () => void;
  onNotificationPress: (notification: AppNotification) => void;
  onNotificationDelete: (id: string) => void;
  onNotificationMarkRead: (id: string) => void;
  onMarkAllRead?: () => void;
  onDeleteAll?: () => void;
  emptyMessage?: string;
  emptyIcon?: string;
}

export function NotificationList({
  notifications,
  loading = false,
  refreshing = false,
  onRefresh,
  onLoadMore,
  onNotificationPress,
  onNotificationDelete,
  onNotificationMarkRead,
  onMarkAllRead,
  onDeleteAll,
  emptyMessage = 'No notifications',
  emptyIcon = 'notifications-off-outline',
}: NotificationListProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const handleLongPress = useCallback((id: string) => {
    const newSelected = new Set(selectedIds);
    if (selectedIds.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
    setIsSelectionMode(newSelected.size > 0);
  }, [selectedIds]);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === notifications.length) {
      setSelectedIds(new Set());
      setIsSelectionMode(false);
    } else {
      setSelectedIds(new Set(notifications.map(n => n.id)));
      setIsSelectionMode(true);
    }
  }, [notifications, selectedIds]);

  const handleBulkDelete = useCallback(() => {
    if (onDeleteAll) {
      onDeleteAll();
    } else {
      selectedIds.forEach(id => onNotificationDelete(id));
    }
    setSelectedIds(new Set());
    setIsSelectionMode(false);
  }, [selectedIds, onDeleteAll, onNotificationDelete]);

  const handleBulkMarkRead = useCallback(() => {
    if (onMarkAllRead) {
      onMarkAllRead();
    } else {
      selectedIds.forEach(id => onNotificationMarkRead(id));
    }
    setSelectedIds(new Set());
    setIsSelectionMode(false);
  }, [selectedIds, onMarkAllRead, onNotificationMarkRead]);

  const renderItem = useCallback(({ item }: { item: AppNotification }) => {
    const isSelected = selectedIds.has(item.id);
    
    return (
      <Animated.View style={{ opacity: fadeAnim }}>
        <NotificationItem
          notification={item}
          onPress={(notification) => {
            if (isSelectionMode) {
              handleLongPress(notification.id);
            } else {
              onNotificationPress(notification);
            }
          }}
          onDelete={onNotificationDelete}
          onMarkRead={onNotificationMarkRead}
          isSelected={isSelected}
          onLongPress={() => handleLongPress(item.id)}
        />
      </Animated.View>
    );
  }, [selectedIds, isSelectionMode, handleLongPress, onNotificationPress, onNotificationDelete, onNotificationMarkRead]);

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name={emptyIcon as any} size={64} color="#D1D5DB" />
      <Text style={styles.emptyText}>{emptyMessage}</Text>
    </View>
  );

  const renderHeader = () => {
    if (notifications.length === 0) return null;

    if (isSelectionMode) {
      return (
        <View style={styles.selectionHeader}>
          <TouchableOpacity onPress={handleSelectAll} style={styles.selectionButton}>
            <Text style={styles.selectionButtonText}>
              {selectedIds.size === notifications.length ? 'Deselect All' : 'Select All'}
            </Text>
          </TouchableOpacity>
          <View style={styles.selectionActions}>
            <TouchableOpacity onPress={handleBulkMarkRead} style={styles.selectionAction}>
              <Ionicons name="checkmark-done-outline" size={20} color="#3B82F6" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleBulkDelete} style={styles.selectionAction}>
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => {
                setSelectedIds(new Set());
                setIsSelectionMode(false);
              }}
              style={styles.selectionAction}
            >
              <Ionicons name="close-outline" size={20} color="#6B7280" />
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (onMarkAllRead || onDeleteAll) {
      return (
        <View style={styles.header}>
          <Text style={styles.headerCount}>{notifications.length} notifications</Text>
          <View style={styles.headerActions}>
            {onMarkAllRead && (
              <TouchableOpacity onPress={onMarkAllRead} style={styles.headerAction}>
                <Ionicons name="checkmark-done-circle-outline" size={20} color="#3B82F6" />
                <Text style={styles.headerActionText}>Mark all read</Text>
              </TouchableOpacity>
            )}
            {onDeleteAll && (
              <TouchableOpacity onPress={onDeleteAll} style={styles.headerAction}>
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
                <Text style={[styles.headerActionText, { color: '#EF4444' }]}>Delete all</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      );
    }

    return null;
  };

  const renderFooter = () => {
    if (!loading) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color="#3B82F6" />
      </View>
    );
  };

  return (
    <FlatList
      data={notifications}
      renderItem={renderItem}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.list}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        ) : undefined
      }
      ListHeaderComponent={renderHeader}
      ListEmptyComponent={renderEmpty}
      ListFooterComponent={renderFooter}
      onEndReached={onLoadMore}
      onEndReachedThreshold={0.5}
      showsVerticalScrollIndicator={false}
      initialNumToRender={15}
      maxToRenderPerBatch={10}
      windowSize={5}
    />
  );
}

const styles = StyleSheet.create({
  list: { flexGrow: 1, padding: 16, paddingBottom: 80 },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerCount: { fontSize: 14, color: '#6B7280' },
  headerActions: { flexDirection: 'row', gap: 16 },
  headerAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerActionText: { fontSize: 13, color: '#3B82F6', fontWeight: '500' },
  selectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
  },
  selectionButton: { padding: 4 },
  selectionButtonText: { fontSize: 14, color: '#3B82F6', fontWeight: '600' },
  selectionActions: { flexDirection: 'row', gap: 16 },
  selectionAction: { padding: 4 },
  footer: { paddingVertical: 20, alignItems: 'center' },
});
