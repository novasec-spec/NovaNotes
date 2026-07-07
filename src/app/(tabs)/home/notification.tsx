// src/screens/notification/NotificationScreen.tsx

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Animated,
  Platform,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Dimensions,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../../contexts/ThemeContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useNotification } from '../../../contexts/NotificationContext';
import { useNotificationBadge } from '../../../hooks/notification/useNotificationBadge';
import { NotificationList } from '../../../components/notification/NotificationList';
import { NotificationActionSheet } from '../../../components/notification/NotificationActionSheet';
import { NotificationEmptyState } from '../../../components/notification/NotificationEmptyState';
import { NotificationBadge } from '../../../components/notification/NotificationBadge';
import { AppNotification, NotificationType } from '../../../types/notifications';
import {
  groupNotificationsByDate,
  getNotificationSummary,
  filterNotifications,
} from '../../../utils/notification/notificationHelpers';

const { width: W } = Dimensions.get('window');

type FilterType = 'all' | 'unread' | 'read' | NotificationType;

// ─── DEDUPLICATION HELPERS ─────────────────────────────

const deduplicateNotifications = (notifications: AppNotification[]): AppNotification[] => {
  const seen = new Map<string, AppNotification>();
  
  for (const notif of notifications) {
    // Use id as key for deduplication
    if (!seen.has(notif.id)) {
      seen.set(notif.id, notif);
    }
  }
  
  // Sort by created_at descending (newest first)
  return Array.from(seen.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
};

export default function NotificationScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { colors, isDarkMode } = useTheme();
  const { 
    getAll, 
    markAsRead, 
    markAllRead, 
    delete: deleteNotification,
    deleteAll,
    subscribe,
    unsubscribe,
  } = useNotification();
  const { count: badgeCount, refresh: refreshBadge } = useNotificationBadge();

  // State
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [filteredNotifications, setFilteredNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('all');
  const [selectedNotification, setSelectedNotification] = useState<AppNotification | null>(null);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showStats, setShowStats] = useState(false);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [notificationCount, setNotificationCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);

  // Animation values
  const searchAnim = useRef(new Animated.Value(0)).current;
  const headerAnim = useRef(new Animated.Value(0)).current;
  const fabAnim = useRef(new Animated.Value(0)).current;
  const statsAnim = useRef(new Animated.Value(0)).current;

  // ─── DEDUPLICATE NOTIFICATIONS ──────────────────────

  const deduplicateAndSet = useCallback((newNotifications: AppNotification[]) => {
    const deduped = deduplicateNotifications(newNotifications);
    setNotifications(deduped);
    
    // Update counts
    const total = deduped.length;
    const unread = deduped.filter(n => !n.read).length;
    setNotificationCount(total);
    setUnreadCount(unread);
    
    return deduped;
  }, []);

  // ─── LOAD NOTIFICATIONS ─────────────────────────────

  const loadNotifications = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const data = await getAll(user.id);
      const deduped = deduplicateAndSet(data);
      applyFilters(deduped, selectedFilter, searchQuery);
    } catch (error) {
      console.error('Error loading notifications:', error);
      Alert.alert('Error', 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [user?.id, getAll, selectedFilter, searchQuery, deduplicateAndSet]);

  // ─── APPLY FILTERS ──────────────────────────────────

  const applyFilters = useCallback((
    data: AppNotification[],
    filter: FilterType,
    search: string
  ) => {
    let filtered = [...data];

    // Apply type filter
    if (filter === 'unread') {
      filtered = filtered.filter(n => !n.read);
    } else if (filter === 'read') {
      filtered = filtered.filter(n => n.read);
    } else if (filter !== 'all') {
      filtered = filtered.filter(n => n.type === filter);
    }

    // Apply search
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(n =>
        n.title.toLowerCase().includes(searchLower) ||
        n.body.toLowerCase().includes(searchLower)
      );
    }

    // Apply sort
    if (sortOrder === 'oldest') {
      filtered = filtered.sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    } else {
      filtered = filtered.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }

    setFilteredNotifications(filtered);
  }, [sortOrder]);

  // ─── REAL-TIME SUBSCRIPTION ─────────────────────────

  useEffect(() => {
    if (!user?.id) return;

    const sub = subscribe(user.id, (payload) => {
      console.log('📡 New notification:', payload.new);
      
      // Check if notification already exists
      const exists = notifications.some(n => n.id === payload.new.id);
      if (!exists) {
        setNotifications(prev => {
          const updated = [payload.new, ...prev];
          return deduplicateNotifications(updated);
        });
        applyFilters([...notifications, payload.new], selectedFilter, searchQuery);
        refreshBadge();
      }
    });

    return () => unsubscribe(user.id);
  }, [user?.id, subscribe, unsubscribe, selectedFilter, searchQuery, notifications]);

  // ─── ANIMATIONS ─────────────────────────────────────

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(fabAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // ─── LOAD ON FOCUS ──────────────────────────────────

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
      refreshBadge();
    }, [loadNotifications, refreshBadge])
  );

  // ─── HANDLE FILTER CHANGE ──────────────────────────

  const handleFilterChange = useCallback((filter: FilterType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedFilter(filter);
    applyFilters(notifications, filter, searchQuery);
  }, [notifications, searchQuery, applyFilters]);

  // ─── HANDLE SEARCH ──────────────────────────────────

  const handleSearch = useCallback((text: string) => {
    setSearchQuery(text);
    applyFilters(notifications, selectedFilter, text);
  }, [notifications, selectedFilter, applyFilters]);

  // ─── TOGGLE SEARCH ──────────────────────────────────

  const toggleSearch = useCallback(() => {
    const show = !showSearch;
    setShowSearch(show);
    
    Animated.spring(searchAnim, {
      toValue: show ? 1 : 0,
      friction: 8,
      tension: 40,
      useNativeDriver: false,
    }).start();

    if (!show) {
      setSearchQuery('');
      applyFilters(notifications, selectedFilter, '');
    }
  }, [showSearch, notifications, selectedFilter, applyFilters]);

  // ─── TOGGLE SORT ────────────────────────────────────

  const toggleSort = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest');
    applyFilters(notifications, selectedFilter, searchQuery);
  }, [notifications, selectedFilter, searchQuery, applyFilters]);

  // ─── HANDLE NOTIFICATION PRESS ─────────────────────

  const handleNotificationPress = useCallback((notification: AppNotification) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (isSelectionMode) {
      handleLongPress(notification);
      return;
    }

    // Mark as read
    if (!notification.read) {
      markAsRead(notification.id, user?.id);
      setNotifications(prev => 
        prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
      );
      refreshBadge();
    }

    // Navigate based on data
    const screen = notification.data?.screen;
    const params = notification.data?.params || {};

    if (screen) {
      router.push({
        pathname: `/${screen}`,
        params: params,
      } as any);
    } else {
      setSelectedNotification(notification);
      setActionSheetVisible(true);
    }
  }, [user?.id, markAsRead, refreshBadge, isSelectionMode]);

  // ─── HANDLE LONG PRESS ─────────────────────────────

  const handleLongPress = useCallback((notification: AppNotification) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(notification.id)) {
        newSet.delete(notification.id);
      } else {
        newSet.add(notification.id);
      }
      setIsSelectionMode(newSet.size > 0);
      return newSet;
    });
  }, []);

  // ─── BULK ACTIONS ───────────────────────────────────

  const handleBulkMarkRead = useCallback(async () => {
    if (selectedIds.size === 0) return;
    
    Alert.alert(
      'Mark as Read',
      `Mark ${selectedIds.size} notifications as read?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Read',
          onPress: async () => {
            for (const id of selectedIds) {
              await markAsRead(id, user?.id);
            }
            setNotifications(prev =>
              prev.map(n => 
                selectedIds.has(n.id) ? { ...n, read: true } : n
              )
            );
            setSelectedIds(new Set());
            setIsSelectionMode(false);
            refreshBadge();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  }, [selectedIds, user?.id, markAsRead, refreshBadge]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    
    Alert.alert(
      'Delete Notifications',
      `Delete ${selectedIds.size} notifications?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            for (const id of selectedIds) {
              await deleteNotification(id, user?.id);
            }
            setNotifications(prev =>
              prev.filter(n => !selectedIds.has(n.id))
            );
            setSelectedIds(new Set());
            setIsSelectionMode(false);
            refreshBadge();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          },
        },
      ]
    );
  }, [selectedIds, user?.id, deleteNotification, refreshBadge]);

  // ─── MARK ALL READ ──────────────────────────────────

  const handleMarkAllRead = useCallback(async () => {
    if (unreadCount === 0) {
      Alert.alert('All Read ✨', 'You have no unread notifications!');
      return;
    }

    Alert.alert(
      'Mark All as Read',
      `Mark all ${unreadCount} unread notifications as read?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark All',
          onPress: async () => {
            await markAllRead(user?.id);
            setNotifications(prev =>
              prev.map(n => ({ ...n, read: true }))
            );
            setUnreadCount(0);
            refreshBadge();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  }, [unreadCount, user?.id, markAllRead, refreshBadge]);

  // ─── DELETE ALL ─────────────────────────────────────

  const handleDeleteAll = useCallback(async () => {
    if (notificationCount === 0) {
      Alert.alert('Empty 📭', 'No notifications to delete');
      return;
    }

    Alert.alert(
      'Delete All',
      `Delete all ${notificationCount} notifications? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            await deleteAll(user?.id);
            setNotifications([]);
            setFilteredNotifications([]);
            setNotificationCount(0);
            setUnreadCount(0);
            refreshBadge();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          },
        },
      ]
    );
  }, [notificationCount, user?.id, deleteAll, refreshBadge]);

  // ─── REFRESH ────────────────────────────────────────

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  }, [loadNotifications]);

  // ─── GET FILTER OPTIONS ─────────────────────────────

  const filterOptions = useMemo(() => {
    const summary = getNotificationSummary(notifications);
    const options: Array<{ id: FilterType; label: string; count?: number }> = [
      { id: 'all', label: 'All', count: summary.total },
      { id: 'unread', label: 'Unread', count: summary.unread },
      { id: 'read', label: 'Read', count: summary.total - summary.unread },
    ];

    const typeCounts: { [key in NotificationType]?: number } = {};
    for (const n of notifications) {
      typeCounts[n.type] = (typeCounts[n.type] || 0) + 1;
    }

    const types: NotificationType[] = ['reminder', 'system', 'chat', 'task', 'progress', 'alert'];
    for (const type of types) {
      if (typeCounts[type] && typeCounts[type]! > 0) {
        options.push({ 
          id: type, 
          label: type.charAt(0).toUpperCase() + type.slice(1), 
          count: typeCounts[type] 
        });
      }
    }

    return options;
  }, [notifications]);

  // ─── GET ACTION SHEET OPTIONS ──────────────────────

  const getActionSheetOptions = useCallback((notification: AppNotification) => {
    return [
      {
        id: 'mark_read',
        label: notification.read ? 'Mark as Unread' : 'Mark as Read',
        icon: notification.read ? 'eye-off-outline' : 'eye-outline',
        action: (n: AppNotification) => {
          markAsRead(n.id, user?.id);
          setNotifications(prev =>
            prev.map(item => 
              item.id === n.id ? { ...item, read: !item.read } : item
            )
          );
          refreshBadge();
        },
      },
      {
        id: 'delete',
        label: 'Delete',
        icon: 'trash-outline',
        color: '#EF4444',
        destructive: true,
        action: (n: AppNotification) => {
          Alert.alert('Delete Notification', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: async () => {
                await deleteNotification(n.id, user?.id);
                setNotifications(prev => prev.filter(item => item.id !== n.id));
                refreshBadge();
              },
            },
          ]);
        },
      },
      {
        id: 'share',
        label: 'Share',
        icon: 'share-outline',
        action: (n: AppNotification) => {
          // Implement share functionality
          console.log('Share notification:', n);
        },
      },
    ];
  }, [user?.id, markAsRead, deleteNotification, refreshBadge]);

  // ─── RENDER HEADER ──────────────────────────────────

  const renderHeader = () => {
    if (isSelectionMode) {
      return (
        <View style={[styles.header, styles.selectionHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => {
            setSelectedIds(new Set());
            setIsSelectionMode(false);
          }}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.selectionTitle, { color: colors.text }]}>
            {selectedIds.size} selected
          </Text>
          <View style={styles.selectionActions}>
            <TouchableOpacity onPress={handleBulkMarkRead} style={styles.selectionAction}>
              <Ionicons name="checkmark-done-outline" size={22} color="#3B82F6" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleBulkDelete} style={styles.selectionAction}>
              <Ionicons name="trash-outline" size={22} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <>
        <Animated.View style={[
          styles.header, 
          { 
            backgroundColor: colors.card, 
            borderBottomColor: colors.border,
            paddingTop: insets.top - 20,
            opacity: headerAnim,
            transform: [{ translateY: headerAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [-20, 0],
            }) }],
          }
        ]}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Notifications</Text>
            {badgeCount > 0 && (
              <View style={styles.headerBadge}>
                <NotificationBadge count={badgeCount} size="small" />
              </View>
            )}
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity onPress={() => setShowStats(true)} style={styles.headerButton}>
              <Ionicons name="stats-chart-outline" size={22} color={colors.muted} />
            </TouchableOpacity>
            <TouchableOpacity onPress={toggleSort} style={styles.headerButton}>
              <Ionicons 
                name={sortOrder === 'newest' ? 'arrow-down' : 'arrow-up'} 
                size={22} 
                color={colors.muted} 
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={toggleSearch} style={styles.headerButton}>
              <Ionicons name={showSearch ? 'close-outline' : 'search-outline'} size={22} color={colors.muted} />
            </TouchableOpacity>
            {notificationCount > 0 && (
              <TouchableOpacity onPress={handleMarkAllRead} style={styles.headerButton}>
                <Ionicons name="checkmark-done-circle-outline" size={22} color="#3B82F6" />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>

        {/* Search Bar */}
        <Animated.View style={[
          styles.searchContainer,
          {
            backgroundColor: colors.card,
            maxHeight: searchAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 60],
            }),
            opacity: searchAnim,
            marginBottom: searchAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 12],
            }),
          },
        ]}>
          <View style={[styles.searchBar, { backgroundColor: colors.background }]}>
            <Ionicons name="search-outline" size={20} color={colors.muted} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search notifications..."
              placeholderTextColor={colors.muted}
              value={searchQuery}
              onChangeText={handleSearch}
              autoFocus={showSearch}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => handleSearch('')}>
                <Ionicons name="close-circle" size={20} color={colors.muted} />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>

        {/* Filter Tabs */}
        <View style={[styles.filterContainer, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}
          >
            {filterOptions.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.filterTab,
                  selectedFilter === option.id && styles.filterTabActive,
                  { backgroundColor: selectedFilter === option.id ? '#FF6B9D' : colors.background },
                ]}
                onPress={() => handleFilterChange(option.id)}
              >
                <Text style={[
                  styles.filterLabel,
                  selectedFilter === option.id && styles.filterLabelActive,
                  { color: selectedFilter === option.id ? '#fff' : colors.text },
                ]}>
                  {option.label}
                </Text>
                {option.count !== undefined && option.count > 0 && (
                  <View style={[
                    styles.filterCount,
                    selectedFilter === option.id && styles.filterCountActive,
                  ]}>
                    <Text style={[
                      styles.filterCountText,
                      selectedFilter === option.id && styles.filterCountTextActive,
                      { color: selectedFilter === option.id ? '#fff' : colors.text },
                    ]}>
                      {option.count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Stats Bar */}
        {notificationCount > 0 && (
          <View style={[styles.statsBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
            <Text style={[styles.statsBarText, { color: colors.muted }]}>
              {notificationCount} total • {unreadCount} unread
            </Text>
            <TouchableOpacity onPress={handleDeleteAll}>
              <Text style={[styles.clearAllText, { color: '#EF4444' }]}>Clear All</Text>
            </TouchableOpacity>
          </View>
        )}
      </>
    );
  };

  // ─── RENDER FAB ─────────────────────────────────────

  const renderFAB = () => {
    if (isSelectionMode || loading || notificationCount === 0) return null;

    return (
      <Animated.View style={[
        styles.fabContainer,
        {
          transform: [{ scale: fabAnim }],
          bottom: insets.bottom + 24,
        },
      ]}>
        <TouchableOpacity
          style={[styles.fab, { backgroundColor: '#FF6B9D' }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            // Scroll to top
          }}
        >
          <Ionicons name="chevron-up" size={24} color="#fff" />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // ─── RENDER STATS MODAL ────────────────────────────

  const renderStatsModal = () => (
    <Modal visible={showStats} transparent animationType="slide">
      <View style={styles.statsOverlay}>
        <View style={[styles.statsSheet, { backgroundColor: colors.card }]}>
          <View style={styles.statsHeader}>
            <Text style={[styles.statsTitle, { color: colors.text }]}>📊 Notification Stats</Text>
            <TouchableOpacity onPress={() => setShowStats(false)}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.statsGrid}>
            <View style={[styles.statItem, { backgroundColor: colors.background }]}>
              <Text style={[styles.statNumber, { color: '#FF6B9D' }]}>{notificationCount}</Text>
              <Text style={[styles.statLabel, { color: colors.text }]}>Total</Text>
            </View>
            <View style={[styles.statItem, { backgroundColor: colors.background }]}>
              <Text style={[styles.statNumber, { color: '#3B82F6' }]}>{unreadCount}</Text>
              <Text style={[styles.statLabel, { color: colors.text }]}>Unread</Text>
            </View>
            <View style={[styles.statItem, { backgroundColor: colors.background }]}>
              <Text style={[styles.statNumber, { color: '#10B981' }]}>{notificationCount - unreadCount}</Text>
              <Text style={[styles.statLabel, { color: colors.text }]}>Read</Text>
            </View>
            <View style={[styles.statItem, { backgroundColor: colors.background }]}>
              <Text style={[styles.statNumber, { color: '#8B5CF6' }]}>
                {notificationCount > 0 ? Math.round((unreadCount / notificationCount) * 100) : 0}%
              </Text>
              <Text style={[styles.statLabel, { color: colors.text }]}>Unread Rate</Text>
            </View>
          </View>

          <View style={styles.statsDivider} />

          <Text style={[styles.statsSubtitle, { color: colors.text }]}>By Type</Text>
          <View style={styles.typeStats}>
            {['reminder', 'chat', 'task', 'system', 'alert', 'progress'].map(type => {
              const count = notifications.filter(n => n.type === type).length;
              if (count === 0) return null;
              return (
                <View key={type} style={[styles.typeStatRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.typeStatLabel, { color: colors.text }]}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </Text>
                  <View style={styles.typeStatBar}>
                    <View 
                      style={[
                        styles.typeStatFill, 
                        { 
                          width: `${(count / notificationCount) * 100}%`,
                          backgroundColor: type === 'reminder' ? '#F59E0B' :
                                         type === 'chat' ? '#10B981' :
                                         type === 'task' ? '#8B5CF6' :
                                         type === 'system' ? '#3B82F6' :
                                         type === 'alert' ? '#EF4444' : '#6366F1'
                        }
                      ]} 
                    />
                  </View>
                  <Text style={[styles.typeStatCount, { color: colors.muted }]}>{count}</Text>
                </View>
              );
            })}
          </View>

          <TouchableOpacity style={[styles.closeStatsBtn, { backgroundColor: '#FF6B9D' }]} onPress={() => setShowStats(false)}>
            <Text style={styles.closeStatsBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  // ─── MAIN RENDER ────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      {renderHeader()}

      <NotificationList
        notifications={filteredNotifications}
        loading={loading}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        onNotificationPress={handleNotificationPress}
        onNotificationDelete={(id) => {
          deleteNotification(id, user?.id);
          setNotifications(prev => prev.filter(n => n.id !== id));
          refreshBadge();
        }}
        onNotificationMarkRead={(id) => {
          markAsRead(id, user?.id);
          setNotifications(prev =>
            prev.map(n => n.id === id ? { ...n, read: true } : n)
          );
          refreshBadge();
        }}
        onMarkAllRead={handleMarkAllRead}
        onDeleteAll={handleDeleteAll}
        emptyMessage={searchQuery ? 'No matching notifications' : 'All caught up! ✨'}
        emptyIcon={searchQuery ? 'search-outline' : 'checkmark-circle-outline'}
        colors={colors}
      />

      {renderFAB()}

      {renderStatsModal()}

      {/* Action Sheet */}
      {selectedNotification && (
        <NotificationActionSheet
          visible={actionSheetVisible}
          notification={selectedNotification}
          options={getActionSheetOptions(selectedNotification)}
          onClose={() => {
            setActionSheetVisible(false);
            setSelectedNotification(null);
          }}
          colors={colors}
        />
      )}
    </View>
  );
}

// ─── STYLES ─────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backButton: {
    padding: 4,
    marginRight: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  headerBadge: {
    marginLeft: 4,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerButton: {
    padding: 4,
  },
  selectionHeader: {
    borderBottomWidth: 2,
    borderBottomColor: '#3B82F6',
  },
  selectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    color: '#1E40AF',
  },
  selectionActions: {
    flexDirection: 'row',
    gap: 16,
  },
  selectionAction: {
    padding: 4,
  },
  searchContainer: {
    paddingHorizontal: 16,
    overflow: 'hidden',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 8,
  },
  filterContainer: {
    borderBottomWidth: 1,
    paddingVertical: 8,
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  filterTabActive: {
    backgroundColor: '#FF6B9D',
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  filterLabelActive: {
    color: '#fff',
  },
  filterCount: {
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  filterCountActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  filterCountText: {
    fontSize: 10,
    fontWeight: '600',
  },
  filterCountTextActive: {
    color: '#fff',
  },
  statsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  statsBarText: {
    fontSize: 12,
  },
  clearAllText: {
    fontSize: 12,
    fontWeight: '600',
  },
  fabContainer: {
    position: 'absolute',
    right: 24,
    zIndex: 999,
    paddingBottom: 50,
  },
  fab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  statsOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  statsSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    maxHeight: '80%',
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statsTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    minWidth: '45%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  statsDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 12,
  },
  statsSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  typeStats: {
    marginBottom: 16,
  },
  typeStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  typeStatLabel: {
    fontSize: 13,
    fontWeight: '500',
    width: 70,
  },
  typeStatBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  typeStatFill: {
    height: '100%',
    borderRadius: 3,
  },
  typeStatCount: {
    fontSize: 12,
    fontWeight: '600',
    width: 30,
    textAlign: 'right',
  },
  closeStatsBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeStatsBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
