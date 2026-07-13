// src/app/(tabs)/faith/notifications.tsx - FIXED
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../contexts/ThemeContext';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import FaithNotificationService, { FaithNotification } from './services/notificationService';

export default function FaithNotificationHistory() {
  const { colors, isDarkMode } = useTheme();
  const [notifications, setNotifications] = useState<FaithNotification[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  // ✅ Get the service instance
  const notificationService = FaithNotificationService.getInstance();

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      const saved = await notificationService.getNotifications();
      setNotifications(saved);
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  const markAsRead = async (id: string) => {
    await notificationService.markAsRead(id);
    const updated = notifications.map(n =>
      n.id === id ? { ...n, read: true } : n
    );
    setNotifications(updated);
  };

  const clearAll = async () => {
    Alert.alert(
      'Clear All Notifications',
      'Are you sure you want to delete all faith notifications?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await notificationService.clearAll();
            setNotifications([]);
          },
        },
      ]
    );
  };

  const getIcon = (type: string) => {
    const icons: Record<string, { name: string; color: string }> = {
      verse_of_the_day: { name: 'bible', color: '#8B5CF6' },
      prayer_reminder: { name: 'hands-pray', color: '#22C55E' },
      answered_prayer: { name: 'heart-flash', color: '#22C55E' },
      sermon_reminder: { name: 'church', color: '#F59E0B' },
      praise_reminder: { name: 'star', color: '#22C55E' },
    };
    return icons[type] || { name: 'bell', color: '#888' };
  };

  const renderNotification = ({ item }: { item: FaithNotification }) => {
    const icon = getIcon(item.type);

    return (
      <TouchableOpacity
        style={[
          styles.notificationItem,
          { backgroundColor: colors.card },
          !item.read && { borderLeftColor: '#8B5CF6', borderLeftWidth: 4 },
        ]}
        onPress={() => markAsRead(item.id)}
      >
        <View style={[styles.iconContainer, { backgroundColor: icon.color + '20' }]}>
          <MaterialCommunityIcons name={icon.name} size={22} color={icon.color} />
        </View>
        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={[styles.body, { color: colors.muted }]} numberOfLines={2}>
            {item.body}
          </Text>
          <Text style={[styles.time, { color: colors.muted }]}>
            {new Date(item.createdAt).toLocaleString()}
          </Text>
        </View>
        {!item.read && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Icon name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>🔔 Faith Notifications</Text>
        {notifications.length > 0 && (
          <TouchableOpacity onPress={clearAll}>
            <Icon name="trash-outline" size={22} color={colors.muted} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={item => item.id}
        renderItem={renderNotification}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B5CF6" />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="bell-off" size={48} color={colors.muted} />
            <Text style={[styles.emptyText, { color: colors.text }]}>No notifications yet</Text>
            <Text style={[styles.emptySub, { color: colors.muted }]}>
              You'll see notifications here when they arrive
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '700' },

  listContent: { padding: 16, paddingBottom: 40 },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { flex: 1 },
  title: { fontSize: 14, fontWeight: '600' },
  body: { fontSize: 13, marginTop: 2, lineHeight: 18 },
  time: { fontSize: 11, marginTop: 4, opacity: 0.6 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#8B5CF6',
  },

  emptyContainer: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptySub: { fontSize: 14, marginTop: 4, opacity: 0.6 },
});
