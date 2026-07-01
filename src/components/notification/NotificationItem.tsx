// src/components/notification/NotificationItem.tsx

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { AppNotification } from '../types/notifications';
import * as Haptics from 'expo-haptics';

interface NotificationItemProps {
  notification: AppNotification;
  onPress: (notification: AppNotification) => void;
  onDelete: (id: string) => void;
  onMarkRead: (id: string) => void;
}

export function NotificationItem({ 
  notification, 
  onPress, 
  onDelete, 
  onMarkRead 
}: NotificationItemProps) {
  const [expanded, setExpanded] = useState(false);
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const getIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'reminder': return { name: 'time-outline', color: '#F59E0B' };
      case 'system': return { name: 'information-circle-outline', color: '#3B82F6' };
      case 'chat': return { name: 'chatbubble-outline', color: '#10B981' };
      case 'task': return { name: 'checkmark-circle-outline', color: '#8B5CF6' };
      case 'progress': return { name: 'sync-outline', color: '#6366F1' };
      case 'alert': return { name: 'alert-circle-outline', color: '#EF4444' };
      default: return { name: 'notifications-outline', color: '#6B7280' };
    }
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.95, duration: 100, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();

    if (!notification.read) {
      onMarkRead(notification.id);
    }
    onPress(notification);
  };

  const handleLongPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setExpanded(!expanded);
  };

  const icon = getIcon(notification.type);
  const isUnread = !notification.read;
  const isProgress = notification.type === 'progress';
  const progress = notification.data?.progress || 0;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={handlePress}
      onLongPress={handleLongPress}
      style={styles.touchable}
    >
      <Animated.View style={[
        styles.container,
        isUnread && styles.unreadContainer,
        { transform: [{ scale: scaleAnim }] }
      ]}>
        {/* Unread indicator */}
        {isUnread && <View style={styles.unreadDot} />}

        {/* Progress bar */}
        {isProgress && (
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { width: `${progress}%` }]} />
          </View>
        )}

        <View style={styles.content}>
          {/* Icon */}
          <View style={[styles.iconContainer, { backgroundColor: icon.color + '15' }]}>
            <Ionicons name={icon.name} size={22} color={icon.color} />
          </View>

          {/* Text */}
          <View style={styles.textContainer}>
            <View style={styles.headerRow}>
              <Text style={[styles.title, isUnread && styles.titleUnread]} numberOfLines={1}>
                {notification.title}
              </Text>
              <Text style={styles.time}>
                {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
              </Text>
            </View>
            <Text style={styles.body} numberOfLines={expanded ? undefined : 2}>
              {notification.body}
            </Text>
            {isProgress && (
              <Text style={styles.progressText}>{progress}% complete</Text>
            )}
            {expanded && notification.data && (
              <View style={styles.metadataContainer}>
                <Text style={styles.metadataText}>
                  ID: {notification.id.substring(0, 8)}
                </Text>
                <Text style={styles.metadataText}>
                  Type: {notification.type}
                </Text>
              </View>
            )}
          </View>

          {/* Actions */}
          {expanded && (
            <View style={styles.actionButtons}>
              <TouchableOpacity
                onPress={() => onMarkRead(notification.id)}
                style={[styles.actionBtn, styles.markReadBtn]}
              >
                <Ionicons name="checkmark-circle-outline" size={20} color="#3B82F6" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  Alert.alert('Delete Notification', 'Are you sure?', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => onDelete(notification.id) },
                  ]);
                }}
                style={[styles.actionBtn, styles.deleteBtn]}
              >
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Chevron for expand */}
        {!expanded && (
          <Ionicons name="chevron-forward" size={16} color="#D1D5DB" style={styles.chevron} />
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  touchable: { marginBottom: 8 },
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    position: 'relative',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  unreadContainer: {
    backgroundColor: '#EFF6FF',
    borderLeftWidth: 3,
    borderLeftColor: '#3B82F6',
  },
  unreadDot: {
    position: 'absolute',
    top: 16,
    left: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
  },
  progressContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#F3F4F6',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#6366F1',
    borderRadius: 2,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  textContainer: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: { fontSize: 15, fontWeight: '600', color: '#374151', flex: 1 },
  titleUnread: { color: '#111827', fontWeight: '700' },
  time: { fontSize: 12, color: '#9CA3AF', marginLeft: 8 },
  body: { fontSize: 13, color: '#6B7280', lineHeight: 18 },
  progressText: { fontSize: 12, color: '#6366F1', marginTop: 4 },
  metadataContainer: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  metadataText: { fontSize: 11, color: '#9CA3AF' },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 8,
    alignSelf: 'center',
  },
  actionBtn: {
    padding: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  markReadBtn: { borderColor: '#3B82F6' },
  deleteBtn: { borderColor: '#FECACA' },
  chevron: { alignSelf: 'center', marginLeft: 4 },
});
