// src/app/(tabs)/notifications/index.tsx
// The Notifications tab — a real notification center, not just a chat inbox.
// Shows every notification the app has logged (chat messages + system events
// like backup-complete, restore-complete, sync errors) grouped by Today /
// Earlier, with unread dots, swipe-to-mark-read, swipe-to-delete, and tap to
// open the relevant screen.
import React, { useEffect, useRef, useState, useCallback } from 'react';
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
} from 'react-native';
import { router } from 'expo-router';
import Icon from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../../contexts/ThemeContext';
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

// ── Per-kind presentation ────────────────────────────────────────────────────
function getKindConfig(kind: NotificationKind): { icon: string; color: string } {
  switch (kind) {
    case 'chat_message': return { icon: 'chatbubble', color: PINK };
    case 'backup_complete': return { icon: 'cloud-done', color: SUCCESS };
    case 'backup_failed': return { icon: 'cloud-offline', color: DANGER };
    case 'restore_complete': return { icon: 'cloud-download', color: BLUE };
    case 'sync_error': return { icon: 'alert-circle', color: DANGER };
    case 'reminder': return { icon: 'alarm', color: WARNING };
    case 'system':
    default: return { icon: 'information-circle', color: GREY };
  }
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'now';
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

// ── Swipeable row ─────────────────────────────────────────────────────────────
// Built on PanResponder + Animated (both core React Native) rather than
// react-native-gesture-handler, to avoid adding a new gesture dependency for
// a single list screen. If this app adopts RNGH elsewhere later, this row is
// a reasonable first candidate to port for smoother (UI-thread) gesture feel.
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
  const [swiping, setSwiping] = useState(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderGrant: () => setSwiping(true),
      onPanResponderMove: (_, gesture) => {
        // Clamp: can swipe left (delete) further than right (mark-read).
        const clamped = Math.max(-140, Math.min(90, gesture.dx));
        translateX.setValue(clamped);
      },
      onPanResponderRelease: (_, gesture) => {
        setSwiping(false);
        if (gesture.dx < SWIPE_DELETE_THRESHOLD) {
          // Swiped far enough left — animate fully off and delete.
          Animated.parallel([
            Animated.timing(translateX, { toValue: -W, duration: 200, useNativeDriver: true }),
            Animated.timing(rowOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
          ]).start(() => onDelete());
        } else if (gesture.dx > SWIPE_READ_THRESHOLD) {
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
    Animated.spring(translateX, { toValue: 0, friction: 8, tension: 80, useNativeDriver: true }).start();
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

  return (
    <View style={styles.rowWrapper}>
      {/* Background action hints, revealed as the row slides over them */}
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
          { backgroundColor: colors.card ?? WHITE, opacity: rowOpacity, transform: [{ translateX }] },
        ]}
      >
        <TouchableOpacity
          style={styles.rowContent}
          onPress={swiping ? undefined : onPress}
          activeOpacity={0.8}
        >
          {notification.senderAvatar ? (
            <Image source={{ uri: notification.senderAvatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.iconCircle, { backgroundColor: kindConfig.color + '1A' }]}>
              <Icon name={kindConfig.icon as any} size={20} color={kindConfig.color} />
            </View>
          )}

          <View style={styles.textCol}>
            <View style={styles.titleRow}>
              <Text
                style={[styles.title, { color: colors.text ?? '#1A1A1A' }, !notification.read && styles.titleUnread]}
                numberOfLines={1}
              >
                {notification.title}
              </Text>
              <Text style={[styles.time, { color: colors.muted ?? GREY }]}>{timeAgo(notification.createdAt)}</Text>
            </View>
            <Text style={[styles.body, { color: colors.muted ?? GREY }]} numberOfLines={2}>
              {notification.body}
            </Text>
          </View>

          {!notification.read && <View style={styles.unreadDot} />}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ label, colors }: { label: string; colors: any }) {
  return (
    <Text style={[styles.sectionHeader, { color: colors.muted ?? GREY, backgroundColor: colors.background }]}>
      {label}
    </Text>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
export default function NotificationsScreen() {
  const { colors } = useTheme();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  useEffect(() => {
    const unsubscribe = NotificationStore.subscribe((all) => {
      setNotifications(all);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handlePress = useCallback(async (n: AppNotification) => {
    if (!n.read) await NotificationStore.markRead(n.id);

    if (n.kind === 'chat_message' && n.chatId) {
      router.push(`/chat/${n.chatId}` as any);
    } else if (n.screen) {
      router.push(n.screen as any);
    }
  }, []);

  const handleMarkRead = useCallback((id: string) => {
    NotificationStore.markRead(id);
  }, []);

  const handleDelete = useCallback((id: string) => {
    NotificationStore.remove(id);
  }, []);

  const handleMarkAllRead = () => {
    NotificationStore.markAllRead();
  };

  const handleClearAll = () => {
    if (notifications.length === 0) return;
    Alert.alert('Clear all notifications', 'This removes every notification from this list. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear all', style: 'destructive', onPress: () => NotificationStore.clearAll() },
    ]);
  };

  const filtered = filter === 'unread' ? notifications.filter(n => !n.read) : notifications;
  const todayItems = filtered.filter(n => isToday(n.createdAt));
  const earlierItems = filtered.filter(n => !isToday(n.createdAt));
  const unreadCount = notifications.filter(n => !n.read).length;

  // Build a single flat list with section header sentinels so we keep one
  // FlatList (cheaper than SectionList for this size, and we already need
  // custom swipe rows per item).
  type ListEntry = { type: 'header'; label: string } | { type: 'item'; data: AppNotification };
  const listData: ListEntry[] = [
    ...(todayItems.length > 0 ? [{ type: 'header' as const, label: 'Today' }, ...todayItems.map(d => ({ type: 'item' as const, data: d }))] : []),
    ...(earlierItems.length > 0 ? [{ type: 'header' as const, label: 'Earlier' }, ...earlierItems.map(d => ({ type: 'item' as const, data: d }))] : []),
  ];

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Notifications</Text>
          {unreadCount > 0 && (
            <Text style={[styles.headerSub, { color: colors.muted }]}>{unreadCount} unread</Text>
          )}
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleMarkAllRead} disabled={unreadCount === 0}>
            <Text style={[styles.headerActionText, unreadCount === 0 && styles.headerActionDisabled]}>
              Mark all read
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleClearAll} style={{ marginLeft: 14 }}>
            <Icon name="trash-outline" size={20} color={colors.muted ?? GREY} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterChip, filter === 'all' && styles.filterChipActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterChipText, filter === 'all' && styles.filterChipTextActive]}>All</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterChip, filter === 'unread' && styles.filterChipActive]}
          onPress={() => setFilter('unread')}
        >
          <Text style={[styles.filterChipText, filter === 'unread' && styles.filterChipTextActive]}>Unread</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PINK} />
        </View>
      ) : listData.length === 0 ? (
        <View style={styles.emptyState}>
          <Icon name="notifications-off-outline" size={48} color={GREY} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {filter === 'unread' ? 'All caught up' : 'No notifications yet'}
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
              <SectionHeader label={item.label} colors={colors} />
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
            const height = item?.type === 'header' ? 34 : ROW_HEIGHT_ESTIMATE;
            return { length: height, offset: height * index, index };
          }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </SafeAreaView>
  );
}

// ── Hook other screens (tab bar badge, etc) can use ─────────────────────────
export function useUnreadNotificationCount(): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const unsubscribe = NotificationStore.subscribe((all) => {
      setCount(all.filter(n => !n.read).length);
    });
    return unsubscribe;
  }, []);
  return count;
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingBottom: 100 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerTitle: { fontSize: 26, fontWeight: '800' },
  headerSub: { fontSize: 12, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  headerActionText: { fontSize: 13, fontWeight: '700', color: PINK },
  headerActionDisabled: { color: GREY, opacity: 0.5 },

  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(153,153,153,0.12)',
  },
  filterChipActive: {
    backgroundColor: PINK,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: GREY,
  },
  filterChipTextActive: {
    color: WHITE,
  },

  sectionHeader: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 6,
  },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 100,
    paddingHorizontal: 40,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', marginTop: 14, marginBottom: 6 },
  emptySub: { fontSize: 13, textAlign: 'center' },

  // Swipeable row
  rowWrapper: {
    paddingHorizontal: 12,
  },
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
  actionHint: {
    alignItems: 'center',
    gap: 2,
  },
  actionHintText: {
    color: WHITE,
    fontSize: 11,
    fontWeight: '700',
  },
  row: {
    borderRadius: 16,
    marginBottom: 8,
  },
  rowContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  titleUnread: {
    fontWeight: '800',
  },
  time: {
    fontSize: 11,
  },
  body: {
    fontSize: 13,
    marginTop: 3,
    lineHeight: 18,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: PINK,
    marginTop: 4,
  },
});
