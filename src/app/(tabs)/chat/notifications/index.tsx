// src/app/(tabs)/notifications/index.tsx
// The Notifications tab — a real notification center, not just a chat inbox.
// Shows every notification the app has logged (chat messages + system events
// like backup-complete, restore-complete, sync errors) grouped by Today /
// Earlier, with unread dots, swipe-to-mark-read, swipe-to-delete, and tap to
// open the relevant screen.
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  Animated,
  PanResponder,
  Dimensions,
  Alert,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { router } from 'expo-router';
import Icon from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../../contexts/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import {
  NotificationStore,
  AppNotification,
  NotificationKind,
} from './NotificationStore';

const { width: W } = Dimensions.get('window');

// ── Design tokens ──────────────────────────────────────────────────────────────
const PINK = '#FF6B9D';
const WHITE = '#FFFFFF';
const SUCCESS = '#22C55E';
const DANGER = '#EF4444';
const WARNING = '#F59E0B';
const BLUE = '#3B82F6';
const GREY = '#9CA3AF';

const SWIPE_DELETE_THRESHOLD = -90;
const SWIPE_READ_THRESHOLD = 70;
const ROW_HEIGHT_ESTIMATE = 84;
const CACHE_KEY = 'notifications_cache';
const CACHE_EXPIRY = 3600000; // 1 hour

// ── Per-kind presentation ────────────────────────────────────────────────────
function getKindConfig(kind: NotificationKind): { icon: string; color: string; label: string } {
  const configs: Record<NotificationKind, { icon: string; color: string; label: string }> = {
    chat_message: { icon: 'chatbubble', color: PINK, label: 'Message' },
    backup_complete: { icon: 'cloud-done', color: SUCCESS, label: 'Backup Complete' },
    backup_failed: { icon: 'cloud-offline', color: DANGER, label: 'Backup Failed' },
    restore_complete: { icon: 'cloud-download', color: BLUE, label: 'Restore Complete' },
    sync_error: { icon: 'alert-circle', color: DANGER, label: 'Sync Error' },
    reminder: { icon: 'alarm', color: WARNING, label: 'Reminder' },
    system: { icon: 'information-circle', color: GREY, label: 'System' },
  };
  return configs[kind] || configs.system;
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString();
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const today = new Date();
  return d.toDateString() === today.toDateString();
}

function getInitials(name?: string): string {
  if (!name) return '?';
  return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function avatarColor(id: string): string {
  const COLORS = ['#FF6B9D', '#A855F7', '#22C55E', '#F59E0B', '#3B82F6', '#F97316', '#EC4899', '#06B6D4', '#8B5CF6'];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

// ── Cache Manager ────────────────────────────────────────────────────────────
class NotificationCache {
  static async save(notifications: AppNotification[]) {
    try {
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify({
        data: notifications,
        timestamp: Date.now(),
      }));
    } catch (error) {
      console.warn('Failed to cache notifications:', error);
    }
  }

  static async load(): Promise<AppNotification[] | null> {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (!cached) return null;
      
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.timestamp > CACHE_EXPIRY) {
        return null;
      }
      return parsed.data;
    } catch (error) {
      console.warn('Failed to load cached notifications:', error);
      return null;
    }
  }

  static async clear() {
    await AsyncStorage.removeItem(CACHE_KEY);
  }
}

// ── Avatar Component ──────────────────────────────────────────────────────────
function NotificationAvatar({ 
  uri, 
  name, 
  userId, 
  size = 44 
}: { 
  uri?: string; 
  name?: string; 
  userId?: string; 
  size?: number;
}) {
  const [imgError, setImgError] = useState(false);
  const bg = userId ? avatarColor(userId) : '#FF6B9D';

  if (uri && !imgError) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: bg, alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ fontSize: size * 0.38, color: '#fff', fontWeight: '700' }}>
        {getInitials(name)}
      </Text>
    </View>
  );
}

// ── Swipeable row ─────────────────────────────────────────────────────────────
function SwipeableRow({
  notification,
  onPress,
  onMarkRead,
  onDelete,
  colors,
}: {
  notification: AppNotification;
  onPress: () => void;
  onMarkRead: () => void;
  onDelete: () => void;
  colors: any;
}) {
  const translateX = useRef(new Animated.Value(0)).current;
  const rowOpacity = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [swiping, setSwiping] = useState(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderGrant: () => {
        setSwiping(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      },
      onPanResponderMove: (_, gesture) => {
        const clamped = Math.max(-140, Math.min(90, gesture.dx));
        translateX.setValue(clamped);
        const scale = 1 - Math.min(Math.abs(clamped) / 500, 0.03);
        scaleAnim.setValue(scale);
      },
      onPanResponderRelease: (_, gesture) => {
        setSwiping(false);
        if (gesture.dx < SWIPE_DELETE_THRESHOLD) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Animated.parallel([
            Animated.timing(translateX, { toValue: -W, duration: 200, useNativeDriver: true }),
            Animated.timing(rowOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
            Animated.timing(scaleAnim, { toValue: 0.8, duration: 200, useNativeDriver: true }),
          ]).start(() => onDelete());
        } else if (gesture.dx > SWIPE_READ_THRESHOLD) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          onMarkRead();
          springBack();
        } else {
          springBack();
        }
      },
      onPanResponderTerminate: springBack,
    })
  ).current;

  function springBack() {
    Animated.parallel([
      Animated.spring(translateX, { toValue: 0, friction: 8, tension: 80, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 80, useNativeDriver: true }),
    ]).start();
  }

  const kindConfig = getKindConfig(notification.kind);
  const deleteOpacity = translateX.interpolate({
    inputRange: [-140, -40, 0],
    outputRange: [1, 0.3, 0],
    extrapolate: 'clamp',
  });
  const readOpacity = translateX.interpolate({
    inputRange: [0, 40, 90],
    outputRange: [0, 0.3, 1],
    extrapolate: 'clamp',
  });

  // Determine if this is a chat message notification
  const isChatMessage = notification.kind === 'chat_message';
  const avatarUri = notification.senderAvatar;
  const senderName = notification.senderName || notification.title;

  return (
    <View style={styles.rowWrapper}>
      <View style={[styles.actionBackdrop, styles.actionBackdropRight]}>
        <Animated.View style={[styles.actionHint, { opacity: deleteOpacity }]}>
          <Icon name="trash" size={20} color={WHITE} />
          <Text style={styles.actionHintText}>Delete</Text>
        </Animated.View>
      </View>
      <View style={[styles.actionBackdrop, styles.actionBackdropLeft]}>
        <Animated.View style={[styles.actionHint, { opacity: readOpacity }]}>
          <Icon name="checkmark-done" size={20} color={WHITE} />
          <Text style={styles.actionHintText}>Read</Text>
        </Animated.View>
      </View>

      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.row,
          { 
            backgroundColor: colors.card ?? WHITE, 
            opacity: rowOpacity, 
            transform: [{ translateX }, { scale: scaleAnim }] 
          },
          notification.read && styles.rowRead,
        ]}
      >
        <TouchableOpacity
          style={styles.rowContent}
          onPress={swiping ? undefined : onPress}
          activeOpacity={0.8}
        >
          {/* Avatar - shows sender avatar for chat messages */}
          {isChatMessage ? (
            <NotificationAvatar
              uri={avatarUri}
              name={senderName}
              userId={notification.senderId}
              size={48}
            />
          ) : (
            <View style={[styles.iconCircle, { backgroundColor: kindConfig.color + '18' }]}>
              <Icon name={kindConfig.icon as any} size={22} color={kindConfig.color} />
            </View>
          )}

          <View style={styles.textCol}>
            <View style={styles.titleRow}>
              <View style={styles.titleContainer}>
                <Text
                  style={[
                    styles.title, 
                    { color: colors.text ?? '#1A1A1A' }, 
                    !notification.read && styles.titleUnread
                  ]}
                  numberOfLines={1}
                >
                  {isChatMessage ? senderName : notification.title}
                </Text>
                {!notification.read && <View style={styles.unreadDot} />}
              </View>
              <Text style={[styles.time, { color: colors.muted ?? GREY }]}>
                {timeAgo(notification.createdAt)}
              </Text>
            </View>
            <Text style={[styles.body, { color: colors.muted ?? GREY }]} numberOfLines={2}>
              {notification.body}
            </Text>
            <View style={styles.tagContainer}>
              <View style={[styles.tag, { backgroundColor: kindConfig.color + '14' }]}>
                <Icon name={kindConfig.icon as any} size={10} color={kindConfig.color} />
                <Text style={[styles.tagText, { color: kindConfig.color }]}>
                  {kindConfig.label}
                </Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ label, count, colors }: { label: string; count?: number; colors: any }) {
  return (
    <View style={[styles.sectionHeaderContainer, { backgroundColor: colors.background }]}>
      <Text style={[styles.sectionHeader, { color: colors.muted ?? GREY }]}>
        {label}
      </Text>
      {count !== undefined && count > 0 && (
        <View style={[styles.sectionCount, { backgroundColor: colors.border }]}>
          <Text style={[styles.sectionCountText, { color: colors.muted }]}>{count}</Text>
        </View>
      )}
    </View>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function NotificationsScreen() {
  const { colors } = useTheme();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [isCached, setIsCached] = useState(false);

  useEffect(() => {
    loadNotifications();
    return () => {};
  }, []);

  const loadNotifications = async (refresh = false) => {
    try {
      setLoading(true);
      
      if (!refresh) {
        const cached = await NotificationCache.load();
        if (cached && cached.length > 0) {
          setNotifications(cached);
          setIsCached(true);
          setLoading(false);
        }
      }

      const freshData = await NotificationStore.getAll();
      if (freshData && freshData.length > 0) {
        setNotifications(freshData);
        setIsCached(false);
        await NotificationCache.save(freshData);
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRefreshing(true);
    await loadNotifications(true);
  };

  const handlePress = useCallback(async (n: AppNotification) => {
    if (!n.read) {
      await NotificationStore.markRead(n.id);
      const updated = notifications.map(notif => 
        notif.id === n.id ? { ...notif, read: true } : notif
      );
      setNotifications(updated);
      await NotificationCache.save(updated);
    }

    if (n.kind === 'chat_message' && n.chatId) {
      // Navigate to chat with the user
      router.push({
        pathname: '/(tabs)/chat',
        params: { chatId: n.chatId },
      });
    } else if (n.kind === 'reminder') {
      router.push('/(tabs)/vibe');
    } else if (n.kind === 'backup_complete' || n.kind === 'backup_failed') {
      router.push('/(tabs)/notes');
    } else if (n.screen) {
      router.push(n.screen as any);
    }
  }, [notifications]);

  const handleMarkRead = useCallback(async (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await NotificationStore.markRead(id);
    const updated = notifications.map(n => 
      n.id === id ? { ...n, read: true } : n
    );
    setNotifications(updated);
    await NotificationCache.save(updated);
  }, [notifications]);

  const handleDelete = useCallback(async (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const updated = notifications.filter(n => n.id !== id);
    setNotifications(updated);
    await NotificationStore.remove(id);
    await NotificationCache.save(updated);
  }, [notifications]);

  const handleMarkAllRead = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
    if (unreadIds.length === 0) return;

    Alert.alert(
      'Mark All as Read',
      `Mark ${unreadIds.length} notification${unreadIds.length > 1 ? 's' : ''} as read?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark All',
          onPress: async () => {
            await NotificationStore.markAllRead();
            const updated = notifications.map(n => ({ ...n, read: true }));
            setNotifications(updated);
            await NotificationCache.save(updated);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  };

  const handleClearAll = () => {
    if (notifications.length === 0) return;
    
    Alert.alert(
      'Clear All Notifications',
      'This removes every notification from this list. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear All', 
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            await NotificationStore.clearAll();
            setNotifications([]);
            await NotificationCache.clear();
          },
        },
      ]
    );
  };

  const filtered = filter === 'unread' ? notifications.filter(n => !n.read) : notifications;
  const todayItems = filtered.filter(n => isToday(n.createdAt));
  const earlierItems = filtered.filter(n => !isToday(n.createdAt));
  const unreadCount = notifications.filter(n => !n.read).length;

  type ListEntry = { type: 'header'; label: string; count?: number } | { type: 'item'; data: AppNotification };
  const listData: ListEntry[] = [
    ...(todayItems.length > 0 ? [{ type: 'header' as const, label: 'Today', count: todayItems.length }, ...todayItems.map(d => ({ type: 'item' as const, data: d }))] : []),
    ...(earlierItems.length > 0 ? [{ type: 'header' as const, label: 'Earlier', count: earlierItems.length }, ...earlierItems.map(d => ({ type: 'item' as const, data: d }))] : []),
  ];

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar barStyle={colors.statusBar || 'dark-content'} />
      
      {/* ─── Header (matches chat screen style) ─── */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIconContainer}>
            <Icon name="notifications" size={22} color="#FF6B9D" />
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Notifications</Text>
            <Text style={[styles.headerSub, { color: colors.muted }]}>
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up ✨'}
            </Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity 
            onPress={handleMarkAllRead} 
            disabled={unreadCount === 0}
            style={[styles.iconButton, { backgroundColor: colors.border }]}
          >
            <Icon name="checkmark-done" size={20} color={unreadCount > 0 ? PINK : GREY} />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={handleClearAll} 
            style={[styles.iconButton, { backgroundColor: colors.border }]}
          >
            <Icon name="trash-outline" size={20} color={notifications.length > 0 ? colors.muted : GREY} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── Filter Row ─── */}
      <View style={[styles.filterRow, { backgroundColor: colors.background }]}>
        <TouchableOpacity
          style={[styles.filterChip, filter === 'all' && styles.filterChipActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterChipText, filter === 'all' && styles.filterChipTextActive]}>
            All {notifications.length > 0 && `(${notifications.length})`}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, filter === 'unread' && styles.filterChipActive]}
          onPress={() => setFilter('unread')}
        >
          <Text style={[styles.filterChipText, filter === 'unread' && styles.filterChipTextActive]}>
            Unread {unreadCount > 0 && `(${unreadCount})`}
          </Text>
        </TouchableOpacity>
        {isCached && (
          <View style={styles.cachedBadge}>
            <Icon name="cloud-outline" size={12} color={GREY} />
            <Text style={[styles.cachedBadgeText, { color: GREY }]}>Cached</Text>
          </View>
        )}
      </View>

      {/* ─── Loading ─── */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PINK} />
          <Text style={[styles.loadingText, { color: colors.muted }]}>
            {isCached ? 'Loading fresh notifications...' : 'Loading notifications...'}
          </Text>
        </View>
      ) : listData.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIconContainer, { backgroundColor: colors.card }]}>
            <Icon name="notifications-off-outline" size={56} color={GREY} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {filter === 'unread' ? '🎉 All caught up!' : 'No notifications yet'}
          </Text>
          <Text style={[styles.emptySub, { color: colors.muted }]}>
            {filter === 'unread'
              ? 'You have no unread notifications'
              : 'Messages and app updates will show up here'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item, index) => item.type === 'header' ? `header_${item.label}_${index}` : item.data.id}
          renderItem={({ item }) =>
            item.type === 'header' ? (
              <SectionHeader label={item.label} count={item.count} colors={colors} />
            ) : (
              <SwipeableRow
                notification={item.data}
                onPress={() => handlePress(item.data)}
                onMarkRead={() => handleMarkRead(item.data.id)}
                onDelete={() => handleDelete(item.data.id)}
                colors={colors}
              />
            )
          }
          getItemLayout={(data, index) => {
            const item = data?.[index];
            const height = item?.type === 'header' ? 38 : ROW_HEIGHT_ESTIMATE;
            return { length: height, offset: height * index, index };
          }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={PINK}
              colors={[PINK]}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

// ── Hook other screens (tab bar badge, etc) ─────────────────────────────────
export function useUnreadNotificationCount(): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const loadCount = async () => {
      const all = await NotificationStore.getAll();
      setCount(all.filter(n => !n.read).length);
    };
    loadCount();
    
    const unsubscribe = NotificationStore.subscribe((all) => {
      setCount(all.filter(n => !n.read).length);
    });
    return unsubscribe;
  }, []);
  return count;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  listContent: { paddingBottom: 100 },

  // ─── Header (matches chat screen) ───
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF6B9D20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  headerSub: { fontSize: 12, opacity: 0.7 },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ─── Filter Row ───
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(153,153,153,0.12)',
  },
  filterChipActive: { backgroundColor: PINK },
  filterChipText: { fontSize: 13, fontWeight: '600', color: GREY },
  filterChipTextActive: { color: WHITE },
  cachedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(153,153,153,0.08)',
  },
  cachedBadgeText: { fontSize: 10, fontWeight: '500' },

  // ─── Loading ───
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14, fontWeight: '500' },

  // ─── Empty State ───
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', marginTop: 8, textAlign: 'center' },
  emptySub: { fontSize: 14, textAlign: 'center', marginTop: 4, opacity: 0.6 },

  // ─── Section Header ───
  sectionHeaderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 8,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionCount: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  sectionCountText: { fontSize: 10, fontWeight: '600' },

  // ─── Swipeable Row ───
  rowWrapper: { paddingHorizontal: 12 },
  actionBackdrop: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 90,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBackdropRight: {
    right: 12,
    backgroundColor: DANGER,
    borderRadius: 16,
  },
  actionBackdropLeft: {
    left: 12,
    backgroundColor: SUCCESS,
    borderRadius: 16,
  },
  actionHint: { alignItems: 'center', gap: 2 },
  actionHintText: { color: WHITE, fontSize: 11, fontWeight: '700' },
  row: {
    borderRadius: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  rowRead: { opacity: 0.7 },
  rowContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: { flex: 1 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  title: { fontSize: 14, fontWeight: '600', flex: 1 },
  titleUnread: { fontWeight: '800' },
  time: { fontSize: 11, flexShrink: 0 },
  body: { fontSize: 13, marginTop: 3, lineHeight: 18 },
  tagContainer: { marginTop: 4, flexDirection: 'row' },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  tagText: { fontSize: 9, fontWeight: '600' },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: PINK,
    flexShrink: 0,
  },
});
