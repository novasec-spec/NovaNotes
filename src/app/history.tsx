import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
  Animated,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { router } from 'expo-router';
import { useTheme } from '../contexts/ThemeContext';
 import CallService, { Call } from '../services/CallService';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Types ───────────────────────────────────────────────────────────

interface CallHistoryItem extends Call {
  otherUser?: {
    id: string;
    username: string;
    avatar_url?: string;
    full_name?: string;
  };
}

interface GroupedCalls {
  title: string;
  data: CallHistoryItem[];
}

// ─── Avatar Cache ────────────────────────────────────────────────────

const AVATAR_CACHE_PREFIX = 'call_avatar_';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

const getCachedAvatar = async (userId: string): Promise<string | null> => {
  try {
    const cached = await AsyncStorage.getItem(`${AVATAR_CACHE_PREFIX}${userId}`);
    if (cached) {
      const { url, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_DURATION) {
        return url;
      }
    }
    return null;
  } catch {
    return null;
  }
};

const setCachedAvatar = async (userId: string, url: string) => {
  try {
    await AsyncStorage.setItem(
      `${AVATAR_CACHE_PREFIX}${userId}`,
      JSON.stringify({ url, timestamp: Date.now() })
    );
  } catch (error) {
    console.error('Avatar cache error:', error);
  }
};

// ─── Call Item Component ─────────────────────────────────────────────

const CallItem = ({ item, onPress }: { item: CallHistoryItem; onPress: () => void }) => {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadAvatar();
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, []);

  const loadAvatar = async () => {
    const userId = item.otherUser?.id;
    if (!userId) return;

    // Check cache
    const cached = await getCachedAvatar(userId);
    if (cached) {
      setAvatarUrl(cached);
      return;
    }

    // Use from item data
    if (item.otherUser?.avatar_url) {
      setAvatarUrl(item.otherUser.avatar_url);
      setCachedAvatar(userId, item.otherUser.avatar_url);
    }
  };

  const getStatusIcon = () => {
    const isOutgoing = item.caller_id === CallService.getCurrentUserId();
    
    switch (item.status) {
      case 'connected':
        return isOutgoing ? 'call' : 'call';
      case 'missed':
        return 'call';
      case 'declined':
        return 'call';
      case 'ended':
        return 'call';
      default:
        return 'call';
    }
  };

  const getStatusColor = () => {
    const isOutgoing = item.caller_id === CallService.getCurrentUserId();
    
    switch (item.status) {
      case 'connected':
        return '#22C55E';
      case 'missed':
        return isOutgoing ? '#EAB308' : '#EF4444';
      case 'declined':
        return '#6B7280';
      default:
        return '#6B7280';
    }
  };

  const getStatusText = () => {
    const isOutgoing = item.caller_id === CallService.getCurrentUserId();
    
    switch (item.status) {
      case 'connected':
        return `Call ended • ${formatDuration(item.duration)}`;
      case 'missed':
        return isOutgoing ? 'No answer' : 'Missed call';
      case 'declined':
        return 'Declined';
      case 'ended':
        return 'Call ended';
      default:
        return item.status;
    }
  };

  const formatDuration = (seconds: number): string => {
    if (!seconds) return '0s';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    // Today
    if (diff < 24 * 60 * 60 * 1000 && date.getDate() === now.getDate()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // Yesterday
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.getDate() === yesterday.getDate()) {
      return 'Yesterday';
    }
    
    // This week
    if (diff < 7 * 24 * 60 * 60 * 1000) {
      return date.toLocaleDateString([], { weekday: 'short' });
    }
    
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const displayName = item.otherUser?.full_name || item.otherUser?.username || 'Unknown';

  return (
    <Animated.View style={{ opacity: fadeAnim }}>
      <TouchableOpacity style={styles.callItem} onPress={onPress} activeOpacity={0.7}>
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarFallback, { backgroundColor: '#FF6B9D' }]}>
              <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={[styles.statusIconContainer, { backgroundColor: getStatusColor() }]}>
            <Icon 
              name={getStatusIcon()} 
              size={10} 
              color="#fff" 
              style={item.caller_id !== CallService.getCurrentUserId() && item.status === 'missed' ? {} : { transform: [{ rotate: '135deg' }] }}
            />
          </View>
        </View>

        {/* Info */}
        <View style={styles.callInfo}>
          <Text style={styles.callName}>{displayName}</Text>
          <View style={styles.callMeta}>
            <Icon 
              name={item.type === 'video' ? 'videocam' : 'call'} 
              size={12} 
              color="rgba(255,255,255,0.4)" 
            />
            <Text style={styles.callStatus}>{getStatusText()}</Text>
          </View>
        </View>

        {/* Time & Actions */}
        <View style={styles.callActions}>
          <Text style={styles.callTime}>{formatTime(item.created_at)}</Text>
          <TouchableOpacity 
            style={styles.callBackBtn}
            onPress={(e) => {
              e.stopPropagation();
              onPress();
            }}
          >
            <Icon name="call" size={18} color="#22C55E" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

// ─── Main Component ──────────────────────────────────────────────────

export default function CallHistoryScreen() {
  const { colors } = useTheme();
  const [calls, setCalls] = useState<CallHistoryItem[]>([]);
  const [filteredCalls, setFilteredCalls] = useState<CallHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadCallHistory();
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  // Filter calls when search changes
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredCalls(calls);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = calls.filter(call => 
      call.otherUser?.username?.toLowerCase().includes(query) ||
      call.otherUser?.full_name?.toLowerCase().includes(query)
    );
    setFilteredCalls(filtered);
  }, [searchQuery, calls]);

  const loadCallHistory = async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      setError(null);

      const history = await CallService.getCallHistory(100);
      
      // Enrich with other user data
      const enriched = history.map(call => {
        const currentUserId = CallService.getCurrentUserId();
        const other = call.caller_id === currentUserId ? call.callee : call.caller;
        return { ...call, otherUser: other };
      });

      setCalls(enriched);
      setFilteredCalls(enriched);
    } catch (error) {
      console.error('Load history error:', error);
      setError('Failed to load call history');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadCallHistory(true);
  };

  const handleCallPress = (item: CallHistoryItem) => {
    if (!item.otherUser?.id) return;

    Alert.alert(
      'Call Back?',
      `Call ${item.otherUser.username || 'this user'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call',
          onPress: () => {
            router.push({
              pathname: '/call/CallScreen',
              params: {
                calleeId: item.otherUser.id,
                calleeName: item.otherUser.username,
                calleeAvatar: item.otherUser.avatar_url || '',
                type: item.type,
                isCaller: 'true',
              },
            });
          },
        },
      ]
    );
  };

  const groupCallsByDate = (calls: CallHistoryItem[]): GroupedCalls[] => {
    const groups: Record<string, CallHistoryItem[]> = {};
    
    calls.forEach(call => {
      const date = new Date(call.created_at);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      
      let key: string;
      if (diff < 24 * 60 * 60 * 1000 && date.getDate() === now.getDate()) {
        key = 'Today';
      } else if (diff < 48 * 60 * 60 * 1000) {
        key = 'Yesterday';
      } else if (diff < 7 * 24 * 60 * 60 * 1000) {
        key = 'This Week';
      } else if (diff < 30 * 24 * 60 * 60 * 1000) {
        key = 'This Month';
      } else {
        key = 'Older';
      }
      
      if (!groups[key]) groups[key] = [];
      groups[key].push(call);
    });

    return Object.entries(groups).map(([title, data]) => ({ title, data }));
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Icon name="call-outline" size={60} color="rgba(255,255,255,0.1)" />
      <Text style={styles.emptyTitle}>No Calls Yet</Text>
      <Text style={styles.emptyText}>Your call history will appear here</Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B9D" />
          <Text style={styles.loadingText}>Loading history...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const groupedCalls = groupCallsByDate(filteredCalls);

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Call History</Text>
          <TouchableOpacity 
            style={styles.clearBtn}
            onPress={() => {
              Alert.alert('Clear History?', 'This will clear all call history.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Clear', style: 'destructive', onPress: () => setCalls([]) },
              ]);
            }}
          >
            <Text style={styles.clearText}>Clear</Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Icon name="search" size={18} color="rgba(255,255,255,0.4)" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search calls..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Icon name="close-circle" size={18} color="rgba(255,255,255,0.4)" />
            </TouchableOpacity>
          )}
        </View>

        {/* Call List */}
        <FlatList
          data={filteredCalls}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <CallItem item={item} onPress={() => handleCallPress(item)} />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#FF6B9D"
              colors={['#FF6B9D']}
            />
          }
          ListEmptyComponent={renderEmpty}
          showsVerticalScrollIndicator={false}
        />
      </Animated.View>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F1A',
  },
  content: {
    flex: 1,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'rgba(255,255,255,0.5)',
    marginTop: 12,
    fontSize: 16,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  clearBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  clearText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '500',
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginHorizontal: 20,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    paddingVertical: 4,
  },

  // List
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },

  // Call Item
  callItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginBottom: 4,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 14,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarFallback: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  statusIconContainer: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0F0F1A',
  },
  callInfo: {
    flex: 1,
  },
  callName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  callMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  callStatus: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
  },
  callActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  callTime: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
  },
  callBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(34,197,94,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Empty
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.3)',
    marginTop: 8,
  },
});
