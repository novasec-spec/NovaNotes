// src/screens/notification/NotificationScreen.tsx

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
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

type FilterType = 'all' | 'unread' | 'read' | NotificationType;

export default function NotificationScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
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

  // Animation values
  const searchAnim = useRef(new Animated.Value(0)).current;
  const headerAnim = useRef(new Animated.Value(1)).current;
  const fabAnim = useRef(new Animated.Value(0)).current;

  // Load notifications
  const loadNotifications = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      const data = await getAll(user.id);
      setNotifications(data);
      applyFilters(data, selectedFilter, searchQuery);
    } catch (error) {
      console.error('Error loading notifications:', error);
      Alert.alert('Error', 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [user?.id, getAll, selectedFilter, searchQuery]);

  // Apply filters
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

    setFilteredNotifications(filtered);
  }, []);

  // Real-time subscription
  useEffect(() => {
    if (!user?.id) return;

    const sub = subscribe(user.id, (payload) => {
      console.log('📡 New notification:', payload.new);
      setNotifications(prev => [payload.new, ...prev]);
      applyFilters([payload.new, ...notifications], selectedFilter, searchQuery);
      refreshBadge();
    });

    return () => unsubscribe(user.id);
  }, [user?.id, subscribe, unsubscribe, selectedFilter, searchQuery]);

  // Load on focus
  useFocusEffect(
    useCallback(() => {
      loadNotifications();
      // Animate FAB in
      Animated.spring(fabAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }).start();
    }, [loadNotifications])
  );

  // Handle filter change
  const handleFilterChange = useCallback((filter: FilterType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedFilter(filter);
    applyFilters(notifications, filter, searchQuery);
  }, [notifications, searchQuery, applyFilters]);

  // Handle search
  const handleSearch = useCallback((text: string) => {
    setSearchQuery(text);
    applyFilters(notifications, selectedFilter, text);
  }, [notifications, selectedFilter, applyFilters]);

  // Toggle search
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

  // Handle notification press
  const handleNotificationPress = useCallback((notification: AppNotification) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
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
      // Navigate to screen with params
      router.push({
        pathname: `/${screen}`,
        params: params,
      } as any);
    } else {
      // Show action sheet
      setSelectedNotification(notification);
      setActionSheetVisible(true);
    }
  }, [user?.id, markAsRead, refreshBadge]);

  // Handle long press for selection
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

  // Handle bulk actions
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

  // Handle mark all read
  const handleMarkAllRead = useCallback(async () => {
    if (notifications.filter(n => !n.read).length === 0) {
      Alert.alert('All Read', 'You have no unread notifications');
      return;
    }

    Alert.alert(
      'Mark All as Read',
      'Mark all notifications as read?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark All',
          onPress: async () => {
            await markAllRead(user?.id);
            setNotifications(prev =>
              prev.map(n => ({ ...n, read: true }))
            );
            refreshBadge();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  }, [notifications, user?.id, markAllRead, refreshBadge]);

  // Handle delete all
  const handleDeleteAll = useCallback(async () => {
    if (notifications.length === 0) {
      Alert.alert('Empty', 'No notifications to delete');
      return;
    }

    Alert.alert(
      'Delete All',
      'Delete all notifications? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            await deleteAll(user?.id);
            setNotifications([]);
            setFilteredNotifications([]);
            refreshBadge();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          },
        },
      ]
    );
  }, [notifications, user?.id, deleteAll, refreshBadge]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  }, [loadNotifications]);

  // Get filter options
  const getFilterOptions = useCallback((): Array<{ id: FilterType; label: string; count?: number }> => {
    const summary = getNotificationSummary(notifications);
    const options: Array<{ id: FilterType; label: string; count?: number }> = [
      { id: 'all', label: 'All', count: summary.total },
      { id: 'unread', label: 'Unread', count: summary.unread },
      { id: 'read', label: 'Read', count: summary.total - summary.unread },
    ];

    // Add type counts
    const typeCounts: { [key in NotificationType]?: number } = {};
    for (const n of notifications) {
      typeCounts[n.type] = (typeCounts[n.type] || 0) + 1;
    }

    // Add types with count > 0
    const types: NotificationType[] = ['reminder', 'system', 'chat', 'task', 'progress', 'alert'];
    for (const type of types) {
      if (typeCounts[type] && typeCounts[type]! > 0) {
        options.push({ id: type, label: type.charAt(0).toUpperCase() + type.slice(1), count: typeCounts[type] });
      }
    }

    return options;
  }, [notifications]);

  const filterOptions = getFilterOptions();

  // Get action sheet options
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

  // Render header
  const renderHeader = () => {
    if (isSelectionMode) {
      return (
        <View style={[styles.header, styles.selectionHeader]}>
          <TouchableOpacity onPress={() => {
            setSelectedIds(new Set());
            setIsSelectionMode(false);
          }}>
            <Ionicons name="close" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.selectionTitle}>
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
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#111827" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Notifications</Text>
            {badgeCount > 0 && (
              <View style={styles.headerBadge}>
                <NotificationBadge count={badgeCount} size="small" />
              </View>
            )}
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity onPress={toggleSearch} style={styles.headerButton}>
              <Ionicons name={showSearch ? 'close-outline' : 'search-outline'} size={22} color="#6B7280" />
            </TouchableOpacity>
            {notifications.length > 0 && (
              <TouchableOpacity onPress={handleMarkAllRead} style={styles.headerButton}>
                <Ionicons name="checkmark-done-circle-outline" size={22} color="#3B82F6" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Search Bar */}
        <Animated.View style={[
          styles.searchContainer,
          {
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
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={20} color="#9CA3AF" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search notifications..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={handleSearch}
              autoFocus={showSearch}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => handleSearch('')}>
                <Ionicons name="close-circle" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>

        {/* Filter Tabs */}
        <View style={styles.filterContainer}>
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
                ]}
                onPress={() => handleFilterChange(option.id)}
              >
                <Text style={[
                  styles.filterLabel,
                  selectedFilter === option.id && styles.filterLabelActive,
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
                    ]}>
                      {option.count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </>
    );
  };

  // Render FAB
  const renderFAB = () => {
    if (isSelectionMode || loading || notifications.length === 0) return null;

    return (
      <Animated.View style={[
        styles.fabContainer,
        {
          transform: [{ scale: fabAnim }],
          bottom: insets.bottom + 24,
        },
      ]}>
        <TouchableOpacity
          style={styles.fab}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            // Scroll to top
            // You'd need a ref to the FlatList for this
          }}
        >
          <Ionicons name="chevron-up" size={24} color="#fff" />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />

      {renderHeader()}

      {/* Main Content */}
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
        emptyMessage={searchQuery ? 'No matching notifications' : 'All caught up!'}
        emptyIcon={searchQuery ? 'search-outline' : 'checkmark-circle-outline'}
      />

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
        />
      )}

      {/* FAB */}
      {renderFAB()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
   paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
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
    color: '#111827',
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
    backgroundColor: '#EFF6FF',
    borderBottomColor: '#93C5FD',
  },
  selectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E40AF',
    flex: 1,
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
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    paddingVertical: 8,
  },
  filterContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
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
    backgroundColor: '#F3F4F6',
  },
  filterTabActive: {
    backgroundColor: '#3B82F6',
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  filterLabelActive: {
    color: '#fff',
  },
  filterCount: {
    backgroundColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  filterCountActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  filterCountText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6B7280',
  },
  filterCountTextActive: {
    color: '#fff',
  },
  fabContainer: {
paddingBottom: 50,
    position: 'absolute',
    right: 24,
    zIndex: 999,
  },
  fab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
});
