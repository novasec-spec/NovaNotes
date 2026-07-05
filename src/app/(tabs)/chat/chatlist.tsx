// ─────────────────────────────────────────────────────────────────────────────
//  app/(tabs)/chat/chatlist.tsx  —  ALL USERS + CHATS (PROFESSIONAL)
// ─────────────────────────────────────────────────────────────────────────────
//
//  ✅ ALL ORIGINAL LOGIC PRESERVED
//  🆕 IMPROVED: Typing indicator with proper animation
//  🆕 IMPROVED: Online/Offline status with pulse
//  🆕 IMPROVED: Last seen with smart formatting
//  🆕 FIXED: Last message preview with proper truncation
//  🆕 FIXED: Search filtering for all users
//  ✅ All swipe actions, haptics, and features preserved
// ─────────────────────────────────────────────────────────────────────────────

import React, {
  useState, useEffect, useRef, useCallback, useMemo, useReducer,
} from 'react';
import {
  View, Text, TouchableOpacity, FlatList, Image, TextInput,
  StyleSheet, RefreshControl, ActivityIndicator, AppState,
  Animated, Dimensions, Platform, Modal, Alert,
  Pressable, StatusBar,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from '../../../config/supabase';
import Icon from 'react-native-vector-icons/Ionicons';
import FA5Icon from 'react-native-vector-icons/FontAwesome5';
import { useTheme } from '../../../contexts/ThemeContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User, Chat } from './types';
import * as Haptics from 'expo-haptics';
import { Swipeable } from 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import ReAnimated,  {
  FadeIn, FadeOut, SlideInRight, SlideOutLeft,
  Layout,
} from 'react-native-reanimated';
import { format, formatDistanceToNow, isToday, isYesterday, differenceInDays } from 'date-fns';

const { width: W, height: H } = Dimensions.get('window');

// ── Cache keys ─────────────────────────────────────────────────────────────────
const CACHE_USERS_KEY = 'chatlist_users_cache_v2';
const CACHE_CHATS_KEY = 'chatlist_chats_cache_v2';
const CACHE_ARCHIVED_KEY = 'chatlist_archived_cache_v2';

// ── Constants ─────────────────────────────────────────────────────────────────
const MAX_PREVIEW_LENGTH = 60;
const SWIPE_THRESHOLD = 80;

// ── Types ──────────────────────────────────────────────────────────────────────
interface ChatWithMetadata extends Chat {
  isMuted?: boolean;
  isArchived?: boolean;
  isPinned?: boolean;
  draft?: string;
  verified?: boolean;
  isNewUser?: boolean;
  typing?: boolean;
}

type FilterMode = 'all' | 'unread' | 'archived';

// ── Reducer ──────────────────────────────────────────────────────────────────
type ChatAction =
  | { type: 'SET_CHATS'; payload: ChatWithMetadata[] }
  | { type: 'UPDATE_CHAT'; payload: { id: string; updates: Partial<ChatWithMetadata> } }
  | { type: 'ARCHIVE_CHAT'; payload: string }
  | { type: 'UNARCHIVE_CHAT'; payload: string }
  | { type: 'MUTE_CHAT'; payload: string }
  | { type: 'UNMUTE_CHAT'; payload: string }
  | { type: 'PIN_CHAT'; payload: string }
  | { type: 'UNPIN_CHAT'; payload: string }
  | { type: 'SET_DRAFT'; payload: { id: string; draft: string } }
  | { type: 'REMOVE_CHAT'; payload: string }
  | { type: 'MARK_READ'; payload: string };

function chatReducer(state: ChatWithMetadata[], action: ChatAction): ChatWithMetadata[] {
  switch (action.type) {
    case 'SET_CHATS': return action.payload;
    case 'UPDATE_CHAT':
      return state.map(chat =>
        chat.id === action.payload.id ? { ...chat, ...action.payload.updates } : chat
      );
    case 'ARCHIVE_CHAT':
      return state.map(chat =>
        chat.id === action.payload ? { ...chat, isArchived: true } : chat
      );
    case 'UNARCHIVE_CHAT':
      return state.map(chat =>
        chat.id === action.payload ? { ...chat, isArchived: false } : chat
      );
    case 'MUTE_CHAT':
      return state.map(chat =>
        chat.id === action.payload ? { ...chat, isMuted: true } : chat
      );
    case 'UNMUTE_CHAT':
      return state.map(chat =>
        chat.id === action.payload ? { ...chat, isMuted: false } : chat
      );
    case 'PIN_CHAT':
      return state.map(chat =>
        chat.id === action.payload ? { ...chat, isPinned: true } : chat
      );
    case 'UNPIN_CHAT':
      return state.map(chat =>
        chat.id === action.payload ? { ...chat, isPinned: false } : chat
      );
    case 'SET_DRAFT':
      return state.map(chat =>
        chat.id === action.payload.id ? { ...chat, draft: action.payload.draft } : chat
      );
    case 'REMOVE_CHAT':
      return state.filter(chat => chat.id !== action.payload);
    case 'MARK_READ':
      return state.map(chat =>
        chat.id === action.payload ? { ...chat, unread_count: 0 } : chat
      );
    default: return state;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────
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

function truncateText(text: string, maxLength: number = MAX_PREVIEW_LENGTH): string {
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
}

function getLastSeenText(lastSeen: string): string {
  if (!lastSeen) return 'Last seen recently';
  const diff = Date.now() - new Date(lastSeen).getTime();
  if (diff < 60000) return 'Last seen just now';
  if (diff < 3600000) return `Last seen ${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `Last seen ${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `Last seen ${Math.floor(diff / 86400000)}d ago`;
  return `Last seen ${format(new Date(lastSeen), 'MMM d')}`;
}

function getSectionHeader(date: string): string {
  if (!date) return 'Older';
  const d = new Date(date);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  if (differenceInDays(new Date(), d) < 7) return 'This Week';
  return 'Older';
}

function formatMessageTime(time: string): string {
  if (!time) return 'Just now';
  const diff = Date.now() - new Date(time).getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return format(new Date(time), 'h:mm a');
  if (diff < 604800000) return format(new Date(time), 'EEE');
  return format(new Date(time), 'MMM d');
}

// ── Custom hook for haptic feedback ──────────────────────────────────────────
function useHaptics() {
  const light = useCallback(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), []);
  const medium = useCallback(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), []);
  const heavy = useCallback(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), []);
  const success = useCallback(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success), []);
  const error = useCallback(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error), []);
  return { light, medium, heavy, success, error };
}

// ─── Typing Dots with Animation ──────────────────────────────────────────────
function TypingDots({ color }: { color: string }) {
  const anims = useRef([
    new Animated.Value(0.2),
    new Animated.Value(0.2),
    new Animated.Value(0.2),
  ]).current;

  useEffect(() => {
    const makeAnim = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: 1, duration: 350, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.2, duration: 350, useNativeDriver: true }),
        ])
      );
    const animations = [makeAnim(anims[0], 0), makeAnim(anims[1], 120), makeAnim(anims[2], 240)];
    animations.forEach(a => a.start());
    return () => animations.forEach(a => a.stop());
  }, []);

  return (
    <View style={styles.typingDotsContainer}>
      {anims.map((a, i) => (
        <Animated.View
          key={i}
          style={[
            styles.typingDot,
            {
              backgroundColor: color,
              opacity: a,
              transform: [{ scale: a }],
            },
          ]}
        />
      ))}
    </View>
  );
}

// ─── Online Pulse ──────────────────────────────────────────────────────────────
function OnlinePulse() {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.6, duration: 800, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 800, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0, duration: 800, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.8, duration: 800, useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.pulseContainer}>
      <Animated.View style={[styles.pulseRing, { transform: [{ scale }], opacity }]} />
      <View style={styles.pulseDot} />
    </View>
  );
}

// ─── Offline Dot ──────────────────────────────────────────────────────────────
function OfflineDot() {
  return <View style={styles.offlineDot} />;
}

// ─── Avatar Component ──────────────────────────────────────────────────────────
function Avatar({ uri, name, userId, size = 52, online, verified }: {
  uri?: string; name?: string; userId: string; size?: number;
  online?: boolean; verified?: boolean;
}) {
  const [imgError, setImgError] = useState(false);
  const bg = avatarColor(userId);

  return (
    <View style={styles.avatarWrapper}>
      {uri && !imgError ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          onError={() => setImgError(true)}
        />
      ) : (
        <View style={[styles.avatarFallback, { backgroundColor: bg, width: size, height: size, borderRadius: size / 2 }]}>
          <Text style={[styles.avatarInitials, { fontSize: size * 0.38 }]}>
            {getInitials(name)}
          </Text>
        </View>
      )}
      {online !== undefined && (online ? <OnlinePulse /> : <OfflineDot />)}
      {verified && (
        <View style={styles.verifiedBadge}>
          <FA5Icon name="check-circle" size={14} color="#fff" />
        </View>
      )}
    </View>
  );
}

// ── Empty State ──────────────────────────────────────────────────────────────
function EmptyStateIllustration({ type, colors }: { type: 'search' | 'empty' | 'archived'; colors: any }) {
  const configs = {
    search: { icon: 'search-outline', label: 'No matches found', sub: 'Try adjusting your search terms' },
    empty: { icon: 'chatbubbles-outline', label: 'No conversations yet', sub: 'Start your first conversation with someone' },
    archived: { icon: 'archive-outline', label: 'No archived chats', sub: 'Your archived conversations will appear here' },
  };
  const config = configs[type];

  return (
    <ReAnimated.View entering={FadeIn.duration(500)} style={[styles.emptyWrap, { backgroundColor: colors.background }]}>
      <View style={[styles.emptyIconContainer, { backgroundColor: colors.card }]}>
        <Icon name={config.icon} size={56} color={colors.muted} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{config.label}</Text>
      <Text style={[styles.emptySub, { color: colors.muted }]}>{config.sub}</Text>
    </ReAnimated.View>
  );
}

// ── Swipe Actions ─────────────────────────────────────────────────────────────
function SwipeActions({
  chatId,
  isArchived,
  isPinned,
  isMuted,
  onAction,
}: {
  chatId: string;
  isArchived?: boolean;
  isPinned?: boolean;
  isMuted?: boolean;
  onAction: (action: string, id: string) => void;
}) {
  return (
    <View style={styles.swipeActionsContainer}>
      {!isArchived && (
        <>
          {!isPinned && (
            <TouchableOpacity
              style={[styles.swipeAction, { backgroundColor: '#3B82F6' }]}
              onPress={() => onAction('pin', chatId)}
            >
              <Icon name="pin-outline" size={22} color="#fff" />
              <Text style={styles.swipeActionText}>Pin</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.swipeAction, { backgroundColor: isMuted ? '#8B5CF6' : '#F59E0B' }]}
            onPress={() => onAction('mute', chatId)}
          >
            <Icon name={isMuted ? 'volume-high-outline' : 'volume-mute-outline'} size={22} color="#fff" />
            <Text style={styles.swipeActionText}>{isMuted ? 'Unmute' : 'Mute'}</Text>
          </TouchableOpacity>
        </>
      )}
      <TouchableOpacity
        style={[styles.swipeAction, { backgroundColor: isArchived ? '#8B5CF6' : '#F97316' }]}
        onPress={() => onAction('archive', chatId)}
      >
        <Icon name={isArchived ? 'archive-outline' : 'archive-outline'} size={22} color="#fff" />
        <Text style={styles.swipeActionText}>{isArchived ? 'Unarchive' : 'Archive'}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.swipeAction, { backgroundColor: '#EF4444' }]}
        onPress={() => onAction('delete', chatId)}
      >
        <Icon name="trash-outline" size={22} color="#fff" />
        <Text style={styles.swipeActionText}>Delete</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
interface Props {
  user: User;
  onSelectUser: (user: User) => void;
}

export default function ChatList({ user, onSelectUser }: Props) {
  const { colors, isDarkMode } = useTheme();
  const haptics = useHaptics();

  // ── State ──────────────────────────────────────────────────────────────────
  const [state, dispatch] = useReducer(chatReducer, []);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});
  const [isOffline, setIsOffline] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const typingSubscription = useRef<any>(null);
  const messageSubscription = useRef<any>(null);
  const userSubscription = useRef<any>(null);
  const swipeableRefs = useRef<Map<string, Swipeable>>(new Map());

  // ── Initialisation ────────────────────────────────────────────────────────
  useEffect(() => {
    bootstrapFromCache();
    checkNetworkThenFetch();
    setupSubscriptions();
    updateOnlineStatus(true);

    const netUnsub = NetInfo.addEventListener(state => {
      const offline = !state.isConnected || !state.isInternetReachable;
      setIsOffline(!!offline);
      if (!offline) loadAllData();
    });

    const appStateSub = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        updateOnlineStatus(true);
        loadAllData();
      } else if (nextAppState === 'background') {
        updateOnlineStatus(false);
      }
    });

    return () => {
      netUnsub();
      appStateSub.remove();
      if (typingSubscription.current) supabase.removeChannel(typingSubscription.current);
      if (messageSubscription.current) supabase.removeChannel(messageSubscription.current);
      if (userSubscription.current) supabase.removeChannel(userSubscription.current);
    };
  }, [user.id]);

  // ── Cache Bootstrap ───────────────────────────────────────────────────────
  const bootstrapFromCache = async () => {
    try {
      const [usersRaw, chatsRaw] = await Promise.all([
        AsyncStorage.getItem(CACHE_USERS_KEY),
        AsyncStorage.getItem(CACHE_CHATS_KEY),
      ]);

      if (usersRaw) {
        setAllUsers(JSON.parse(usersRaw));
        setFromCache(true);
        setLoading(false);
      }
      if (chatsRaw) {
        const cachedChats = JSON.parse(chatsRaw);
        dispatch({ type: 'SET_CHATS', payload: cachedChats });
      }
    } catch (e) {
      console.warn('[ChatList] Cache read failed:', e);
    }
  };

  const checkNetworkThenFetch = async () => {
    const netState = await NetInfo.fetch();
    const offline = !netState.isConnected || !netState.isInternetReachable;
    setIsOffline(!!offline);
    if (!offline) await loadAllData();
    else setLoading(false);
  };

  // ── Subscriptions ────────────────────────────────────────────────────────
  const setupSubscriptions = () => {
    if (typingSubscription.current) supabase.removeChannel(typingSubscription.current);

    typingSubscription.current = supabase
      .channel(`typing:list:${user.id}`)
      .on('broadcast', { event: 'typing' }, payload => {
        const { userId, isTyping } = payload.payload;
        if (userId !== user.id) {
          setTypingUsers(prev => ({ ...prev, [userId]: isTyping }));
        }
      })
      .subscribe();

    if (messageSubscription.current) supabase.removeChannel(messageSubscription.current);
    messageSubscription.current = supabase
      .channel(`messages:list:${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        loadChats();
      })
      .subscribe();

    if (userSubscription.current) supabase.removeChannel(userSubscription.current);
    userSubscription.current = supabase
      .channel(`users:list:${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
        loadUsers();
      })
      .subscribe();
  };

  // ── Data Loading ─────────────────────────────────────────────────────────
  const loadAllData = async () => {
    try {
      await Promise.all([loadUsers(), loadChats()]);
      setLoading(false);
      setFromCache(false);
    } catch (error) {
      console.error('[ChatList] loadAllData error:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .neq('id', user.id)
        .order('username', { ascending: true });

      if (error) throw error;

      const users = data || [];
      setAllUsers(users);
      await AsyncStorage.setItem(CACHE_USERS_KEY, JSON.stringify(users));
    } catch (error) {
      console.error('[ChatList] loadUsers error:', error);
    }
  };

  const loadChats = async () => {
    try {
      const { data, error } = await supabase
        .from('chats')
        .select(`
          *,
          user1:users!chats_user1_id_fkey(id, username, avatar_url, online, last_seen),
          user2:users!chats_user2_id_fkey(id, username, avatar_url, online, last_seen)
        `)
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .order('last_message_time', { ascending: false });

      if (error) throw error;
      if (!data) return;

      const chatIds = data.map((c: any) => c.id);
      const { data: unreadData } = await supabase
        .from('messages')
        .select('chat_id')
        .in('chat_id', chatIds)
        .neq('sender_id', user.id)
        .is('read_at', null);

      const unreadMap: Record<string, number> = {};
      (unreadData ?? []).forEach((row: any) => {
        unreadMap[row.chat_id] = (unreadMap[row.chat_id] ?? 0) + 1;
      });

      const savedMetadata = await getChatMetadata();

      const formattedChats: ChatWithMetadata[] = data.map((chat: any) => {
        const otherUser = chat.user1_id === user.id ? chat.user2 : chat.user1;
        const metadata = savedMetadata[chat.id] || {};
        
        return {
          id: chat.id,
          user1_id: chat.user1_id,
          user2_id: chat.user2_id,
          last_message: chat.last_message || 'No messages yet',
          last_message_time: chat.last_message_time || chat.created_at,
          other_user: {
            id: otherUser.id,
            email: otherUser.email ?? '',
            username: otherUser.username,
            avatar_url: otherUser.avatar_url,
            online: otherUser.online || false,
            last_seen: otherUser.last_seen || new Date().toISOString(),
          },
          unread_count: unreadMap[chat.id] ?? 0,
          created_at: chat.created_at,
          isMuted: metadata.isMuted || false,
          isArchived: metadata.isArchived || false,
          isPinned: metadata.isPinned || false,
          draft: metadata.draft || '',
          verified: metadata.verified || false,
          typing: typingUsers[otherUser.id] || false,
        };
      });

      dispatch({ type: 'SET_CHATS', payload: formattedChats });
      await AsyncStorage.setItem(CACHE_CHATS_KEY, JSON.stringify(formattedChats));
    } catch (error) {
      console.error('[ChatList] loadChats error:', error);
    }
  };

  // ── Chat Metadata Management ────────────────────────────────────────────
  const getChatMetadata = async (): Promise<Record<string, any>> => {
    try {
      const raw = await AsyncStorage.getItem(CACHE_ARCHIVED_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  };

  const saveChatMetadata = async (metadata: Record<string, any>) => {
    try {
      await AsyncStorage.setItem(CACHE_ARCHIVED_KEY, JSON.stringify(metadata));
    } catch (e) {
      console.warn('[ChatList] saveChatMetadata error:', e);
    }
  };

  // ── Actions ──────────────────────────────────────────────────────────────
  const handleChatAction = useCallback(async (action: string, chatId: string) => {
    haptics.medium();
    
    const currentChat = state.find(c => c.id === chatId);
    if (!currentChat) return;

    const metadata = await getChatMetadata();
    
    switch (action) {
      case 'archive':
        const archived = !currentChat.isArchived;
        dispatch({ type: archived ? 'ARCHIVE_CHAT' : 'UNARCHIVE_CHAT', payload: chatId });
        metadata[chatId] = { ...metadata[chatId], isArchived: archived };
        await saveChatMetadata(metadata);
        break;

      case 'delete':
        Alert.alert(
          'Delete Conversation',
          'Are you sure you want to delete this conversation? This action cannot be undone.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: async () => {
                haptics.error();
                dispatch({ type: 'REMOVE_CHAT', payload: chatId });
                await supabase.from('chats').delete().eq('id', chatId);
              },
            },
          ]
        );
        break;

      case 'pin':
        const pinned = !currentChat.isPinned;
        dispatch({ type: pinned ? 'PIN_CHAT' : 'UNPIN_CHAT', payload: chatId });
        metadata[chatId] = { ...metadata[chatId], isPinned: pinned };
        await saveChatMetadata(metadata);
        break;

      case 'mute':
        const muted = !currentChat.isMuted;
        dispatch({ type: muted ? 'MUTE_CHAT' : 'UNMUTE_CHAT', payload: chatId });
        metadata[chatId] = { ...metadata[chatId], isMuted: muted };
        await saveChatMetadata(metadata);
        haptics.success();
        break;

      case 'markRead':
        dispatch({ type: 'MARK_READ', payload: chatId });
        break;

      default:
        break;
    }

    swipeableRefs.current.get(chatId)?.close();
  }, [state, haptics]);

  // ── Long Press Menu ──────────────────────────────────────────────────────
  const showContextMenu = useCallback((chatId: string) => {
    setSelectedChatId(chatId);
    setModalVisible(true);
  }, []);

  // ── Search ──────────────────────────────────────────────────────────────
  const handleSearch = useCallback((text: string) => {
    setSearchQuery(text);
  }, []);

  // ── Combined Data ────────────────────────────────────────────────────
  const combinedList = useMemo(() => {
    const usersWithChats = new Set(state.map(c => c.other_user.id));
    const usersWithoutChats = allUsers.filter(u => !usersWithChats.has(u.id));
    
    const newChatItems: ChatWithMetadata[] = usersWithoutChats.map(u => ({
      id: `user-${u.id}`,
      user1_id: user.id,
      user2_id: u.id,
      last_message: 'Tap to start chatting 💬',
      last_message_time: u.last_seen || new Date().toISOString(),
      other_user: u,
      unread_count: 0,
      created_at: new Date().toISOString(),
      isMuted: false,
      isArchived: false,
      isPinned: false,
      draft: '',
      verified: false,
      isNewUser: true,
      typing: false,
    }));

    // Update typing status for existing chats
    const updatedChats = state.map(chat => ({
      ...chat,
      typing: typingUsers[chat.other_user.id] || false,
    }));

    return [...updatedChats, ...newChatItems];
  }, [state, allUsers, user.id, typingUsers]);

  // ── Sorted & Filtered ────────────────────────────────────────────────────
  const sortedChats = useMemo(() => {
    let chats = combinedList.filter(c => !c.isArchived);
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      chats = chats.filter(c => 
        c.other_user.username?.toLowerCase().includes(query) ||
        c.other_user.email?.toLowerCase().includes(query) ||
        c.last_message?.toLowerCase().includes(query)
      );
    }

    if (filterMode === 'unread') {
      chats = chats.filter(c => c.unread_count > 0);
    }

    return chats.sort((a, b) => {
      // Pinned first
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      
      // Users with chats first
      const aHasChat = state.some(s => s.id === a.id);
      const bHasChat = state.some(s => s.id === b.id);
      if (aHasChat && !bHasChat) return -1;
      if (!aHasChat && bHasChat) return 1;
      
      // Typing users first
      if (a.typing && !b.typing) return -1;
      if (!a.typing && b.typing) return 1;
      
      return new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime();
    });
  }, [combinedList, searchQuery, filterMode, state]);

  // ── Group Chats ──────────────────────────────────────────────────────────
  const groupedChats = useMemo(() => {
    const groups: Record<string, ChatWithMetadata[]> = {};
    
    sortedChats.forEach(chat => {
      const section = chat.last_message_time ? getSectionHeader(chat.last_message_time) : 'Older';
      if (!groups[section]) groups[section] = [];
      groups[section].push(chat);
    });

    return groups;
  }, [sortedChats]);

  const archivedChats = useMemo(() => {
    return state.filter(c => c.isArchived);
  }, [state]);

  const totalUnread = useMemo(() => {
    return state.filter(c => !c.isArchived).reduce((sum, c) => sum + (c.unread_count || 0), 0);
  }, [state]);

  // ── Online Status ────────────────────────────────────────────────────────
  const updateOnlineStatus = async (isOnline: boolean) => {
    try {
      await supabase
        .from('users')
        .update({ online: isOnline, last_seen: new Date().toISOString() })
        .eq('id', user.id);
    } catch (error) {
      console.error('[ChatList] updateOnlineStatus error:', error);
    }
  };

  const onRefresh = async () => {
    haptics.light();
    setRefreshing(true);
    setFromCache(false);
    await loadAllData();
    setRefreshing(false);
    haptics.success();
  };

  // ── Render Chat Item ─────────────────────────────────────────────────────
  const renderChatItem = useCallback(({ item }: { item: ChatWithMetadata }) => {
    const isTyping = item.typing || false;
    const unreadCount = item.unread_count || 0;
    const hasDraft = !!item.draft && item.draft.length > 0;
    const isNewUser = item.isNewUser || false;
    const isOnline = item.other_user.online || false;

    const renderRightActions = () => (
      <SwipeActions
        chatId={item.id}
        isArchived={item.isArchived}
        isPinned={item.isPinned}
        isMuted={item.isMuted}
        onAction={handleChatAction}
      />
    );

    // Determine subtitle text
    let subtitleText = item.last_message;
    let subtitleColor = colors.muted;
    let isTypingIndicator = false;

    if (isTyping) {
      isTypingIndicator = true;
    } else if (isNewUser) {
      subtitleText = '✨ Say hello!';
      subtitleColor = '#FF6B9D';
    } else if (hasDraft) {
      subtitleText = `Draft: ${truncateText(item.draft!)}`;
      subtitleColor = '#F59E0B';
    }

    return (
      <Swipeable
        ref={ref => {
          if (ref) swipeableRefs.current.set(item.id, ref);
        }}
        renderRightActions={isNewUser ? undefined : renderRightActions}
        overshootFriction={8}
        rightThreshold={SWIPE_THRESHOLD}
        onSwipeableWillOpen={() => haptics.light()}
      >
        <ReAnimated.View
          entering={FadeIn.duration(300).delay(50)}
          layout={Layout.springify().damping(20)}
        >
          <TouchableOpacity
            style={[
              styles.userRow,
              {
                backgroundColor: colors.card,
                opacity: isNewUser ? 0.85 : 1,
                borderWidth: isNewUser ? 1 : 0,
                borderColor: isNewUser ? colors.border : 'transparent',
                borderLeftWidth: isTyping ? 4 : 0,
                borderLeftColor: isTyping ? '#FF6B9D' : 'transparent',
              }
            ]}
            onPress={() => {
              if (unreadCount > 0) handleChatAction('markRead', item.id);
              onSelectUser(item.other_user);
            }}
            onLongPress={() => isNewUser ? null : showContextMenu(item.id)}
            activeOpacity={0.7}
          >
            <Avatar
              uri={item.other_user.avatar_url}
              name={item.other_user.username}
              userId={item.other_user.id}
              online={isOnline}
              verified={item.verified}
            />

            <View style={styles.rowContent}>
              <View style={styles.rowTop}>
                <View style={styles.nameContainer}>
                  <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>
                    {item.other_user.username}
                  </Text>
                  {isNewUser && (
                    <View style={styles.newUserBadge}>
                      <Text style={styles.newUserBadgeText}>New</Text>
                    </View>
                  )}
                  {item.isMuted && (
                    <Icon name="volume-mute-outline" size={14} color={colors.muted} style={styles.muteIcon} />
                  )}
                  {item.isPinned && (
                    <Icon name="pin-outline" size={14} color={colors.muted} style={styles.pinIcon} />
                  )}
                  {isOnline && (
                    <View style={styles.onlineBadge}>
                      <Text style={styles.onlineBadgeText}>● Online</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.timeText, { color: colors.muted }]}>
                  {isNewUser ? 'New' : formatMessageTime(item.last_message_time)}
                </Text>
              </View>

              <View style={styles.rowBottom}>
                <View style={styles.previewContainer}>
                  {isTyping ? (
                    <View style={styles.typingContainer}>
                      <Text style={[styles.typingText, { color: '#FF6B9D' }]}>typing</Text>
                      <TypingDots color="#FF6B9D" />
                    </View>
                  ) : (
                    <Text style={[styles.subtleText, { color: subtitleColor }]} numberOfLines={1}>
                      {subtitleText}
                    </Text>
                  )}
                </View>

                {unreadCount > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadTxt}>
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>
        </ReAnimated.View>
      </Swipeable>
    );
  }, [colors, handleChatAction, onSelectUser, showContextMenu, state, haptics]);

  // ── Render Header ────────────────────────────────────────────────────────
  const renderHeader = () => (
    <ReAnimated.View entering={FadeIn.duration(400)}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Messages</Text>
          <Text style={[styles.headerSub, { color: colors.muted }]}>
            {totalUnread > 0 ? `${totalUnread} unread` : 'All caught up ✨'}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => setShowFilters(!showFilters)}
            style={[styles.filterButton, { backgroundColor: colors.card }]}
          >
            <Icon name="funnel-outline" size={20} color={filterMode !== 'all' ? '#FF6B9D' : colors.muted} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/chat/settings')}
            style={[styles.settingsButton, { backgroundColor: colors.card }]}
          >
            <Icon name="settings-outline" size={20} color={colors.muted} />
          </TouchableOpacity>
        </View>
      </View>

      {showFilters && (
        <ReAnimated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          style={[styles.filterBar, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <TouchableOpacity
            style={[
              styles.filterChip,
              filterMode === 'all' && styles.filterChipActive,
              { backgroundColor: filterMode === 'all' ? '#FF6B9D' : colors.border },
            ]}
            onPress={() => { setFilterMode('all'); haptics.light(); }}
          >
            <Text style={[styles.filterChipText, { color: filterMode === 'all' ? '#fff' : colors.text }]}>All</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterChip,
              filterMode === 'unread' && styles.filterChipActive,
              { backgroundColor: filterMode === 'unread' ? '#3B82F6' : colors.border },
            ]}
            onPress={() => { setFilterMode('unread'); haptics.light(); }}
          >
            <Text style={[styles.filterChipText, { color: filterMode === 'unread' ? '#fff' : colors.text }]}>
              Unread ({totalUnread})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterChip,
              filterMode === 'archived' && styles.filterChipActive,
              { backgroundColor: filterMode === 'archived' ? '#8B5CF6' : colors.border },
            ]}
            onPress={() => { setFilterMode('archived'); haptics.light(); }}
          >
            <Text style={[styles.filterChipText, { color: filterMode === 'archived' ? '#fff' : colors.text }]}>
              Archived ({archivedChats.length})
            </Text>
          </TouchableOpacity>
        </ReAnimated.View>
      )}

      {isOffline && (
        <ReAnimated.View
          entering={FadeIn.duration(300)}
          style={[styles.offlineBanner, { backgroundColor: isDarkMode ? '#2A1A00' : '#FFF3CD' }]}
        >
          <Icon name="cloud-offline-outline" size={16} color="#F59E0B" />
          <Text style={styles.offlineTxt}>Offline — showing saved contacts</Text>
        </ReAnimated.View>
      )}

      <View style={[styles.searchWrapper, { backgroundColor: colors.background }]}>
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Icon name="search" size={18} color={colors.muted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search conversations..."
            placeholderTextColor={colors.muted}
            value={searchQuery}
            onChangeText={handleSearch}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Icon name="close-circle" size={18} color={colors.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </ReAnimated.View>
  );

  // ── Context Menu ──────────────────────────────────────────────────────────
  const renderContextMenu = () => {
    const chat = state.find(c => c.id === selectedChatId);
    if (!chat) return null;

    return (
      <Modal transparent visible={modalVisible} animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <ReAnimated.View
            entering={SlideInRight.duration(300)}
            exiting={SlideOutLeft.duration(300)}
            style={[styles.contextMenu, { backgroundColor: colors.card }]}
          >
            <View style={styles.contextMenuHeader}>
              <Text style={[styles.contextMenuTitle, { color: colors.text }]}>{chat.other_user.username}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Icon name="close" size={24} color={colors.muted} />
              </TouchableOpacity>
            </View>

            <View style={styles.contextMenuDivider} />

            <TouchableOpacity
              style={styles.contextMenuItem}
              onPress={() => { setModalVisible(false); handleChatAction('mute', chat.id); }}
            >
              <Icon name={chat.isMuted ? 'volume-high-outline' : 'volume-mute-outline'} size={22} color={colors.text} />
              <Text style={[styles.contextMenuItemText, { color: colors.text }]}>
                {chat.isMuted ? 'Unmute' : 'Mute'} Conversation
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.contextMenuItem}
              onPress={() => { setModalVisible(false); handleChatAction('pin', chat.id); }}
            >
              <Icon name="pin-outline" size={22} color={colors.text} />
              <Text style={[styles.contextMenuItemText, { color: colors.text }]}>
                {chat.isPinned ? 'Unpin' : 'Pin'} Conversation
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.contextMenuItem}
              onPress={() => { setModalVisible(false); handleChatAction('archive', chat.id); }}
            >
              <Icon name="archive-outline" size={22} color={colors.text} />
              <Text style={[styles.contextMenuItemText, { color: colors.text }]}>
                {chat.isArchived ? 'Unarchive' : 'Archive'} Conversation
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.contextMenuItem, styles.contextMenuItemDanger]}
              onPress={() => { setModalVisible(false); handleChatAction('delete', chat.id); }}
            >
              <Icon name="trash-outline" size={22} color="#EF4444" />
              <Text style={[styles.contextMenuItemText, { color: '#EF4444' }]}>Delete Conversation</Text>
            </TouchableOpacity>
          </ReAnimated.View>
        </Pressable>
      </Modal>
    );
  };

  // ── Main Render ──────────────────────────────────────────────────────────

  if (loading && state.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View>
            <View style={[styles.skeletonLine, { width: 120, height: 28, backgroundColor: colors.border }]} />
            <View style={[styles.skeletonLine, { width: 80, height: 14, marginTop: 4, backgroundColor: colors.border }]} />
          </View>
        </View>
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border, margin: 16 }]}>
          <View style={[styles.skeletonLine, { width: '100%', height: 20, backgroundColor: colors.border }]} />
        </View>
        {[...Array(6)].map((_, i) => (
          <ReAnimated.View
            key={i}
            entering={FadeIn.duration(400).delay(i * 80)}
            style={[styles.skeleton, { backgroundColor: colors.card, opacity: 1 - i * 0.08 }]}
          >
            <View style={[styles.skeletonAvatar, { backgroundColor: colors.border }]} />
            <View style={{ flex: 1, gap: 8 }}>
              <View style={[styles.skeletonLine, { width: '60%', backgroundColor: colors.border }]} />
              <View style={[styles.skeletonLine, { width: '40%', backgroundColor: colors.border }]} />
            </View>
          </ReAnimated.View>
        ))}
      </SafeAreaView>
    );
  }

  return (
    <GestureHandlerRootView style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

        {renderHeader()}

        <FlatList
          data={Object.entries(groupedChats)}
          keyExtractor={([section]) => section}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6B9D" colors={['#FF6B9D']} />
          }
          renderItem={({ item: [section, chats] }) => (
            <View>
              <View style={[styles.sectionHeader, { backgroundColor: colors.background }]}>
                <Text style={[styles.sectionHeaderText, { color: colors.muted }]}>{section}</Text>
              </View>
              {chats.map(chat => (
                <View key={chat.id}>{renderChatItem({ item: chat })}</View>
              ))}
            </View>
          )}
          ListEmptyComponent={<EmptyStateIllustration type={searchQuery ? 'search' : 'empty'} colors={colors} />}
        />

        {renderContextMenu()}
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  headerSub: { fontSize: 13, marginTop: 2, opacity: 0.7 },
  headerActions: { flexDirection: 'row', gap: 10 },
  filterButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  settingsButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },

  // Filter Bar
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipText: { fontSize: 13, fontWeight: '600' },

  // Offline
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F59E0B44',
  },
  offlineTxt: { fontSize: 12, color: '#F59E0B', fontWeight: '600' },

  // Search
  searchWrapper: { paddingHorizontal: 16, paddingBottom: 8 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    height: 46,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 8 },

  // List
  list: { flex: 1 },
  listContent: { paddingBottom: 120 },

  // Section
  sectionHeader: { paddingHorizontal: 16, paddingVertical: 10, marginTop: 4 },
  sectionHeaderText: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

  // User Row
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  rowContent: { flex: 1 },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 4,
  },
  userName: { fontSize: 16, fontWeight: '700', flex: 1 },
  muteIcon: { marginLeft: 4 },
  pinIcon: { marginLeft: 2 },
  timeText: { fontSize: 11, opacity: 0.6 },
  rowBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewContainer: { flex: 1, marginRight: 8 },
  subtleText: { fontSize: 13, opacity: 0.6 },

  // Typing
  typingContainer: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  typingText: { fontSize: 13, fontWeight: '600', color: '#FF6B9D' },
  typingDotsContainer: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  typingDot: { width: 5, height: 5, borderRadius: 2.5 },

  // Badges
  unreadBadge: {
    backgroundColor: '#FF6B9D',
    borderRadius: 12,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadTxt: { color: '#fff', fontSize: 11, fontWeight: '800' },
  newUserBadge: {
    backgroundColor: '#FF6B9D20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FF6B9D',
  },
  newUserBadgeText: { fontSize: 9, fontWeight: '700', color: '#FF6B9D', textTransform: 'uppercase' },
  onlineBadge: { backgroundColor: '#4CAF5020', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  onlineBadgeText: { fontSize: 9, fontWeight: '700', color: '#4CAF50' },

  // Avatar
  avatarWrapper: { position: 'relative', marginRight: 14 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitials: { color: '#fff', fontWeight: '700' },
  verifiedBadge: {
    position: 'absolute', top: -2, right: 10,
    backgroundColor: '#3B82F6', borderRadius: 10,
    padding: 2,
  },

  // Pulse
  pulseContainer: {
    position: 'absolute', bottom: 0, right: 0,
    width: 18, height: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: '#4CAF50', opacity: 0.5,
  },
  pulseDot: {
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: '#4CAF50',
    borderWidth: 2, borderColor: '#fff',
  },
  offlineDot: {
    position: 'absolute', bottom: 0, right: 0,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: '#999',
    borderWidth: 2, borderColor: '#fff',
  },

  // Swipe Actions
  swipeActionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    marginRight: 16,
  },
  swipeAction: {
    width: 60,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  swipeActionText: { color: '#fff', fontSize: 10, marginTop: 2, fontWeight: '600' },

  // Empty
  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, paddingHorizontal: 40 },
  emptyIconContainer: {
    width: 120, height: 120, borderRadius: 60,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', marginTop: 8, textAlign: 'center' },
  emptySub: { fontSize: 14, textAlign: 'center', marginTop: 6, opacity: 0.6 },

  // Context Menu
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  contextMenu: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  contextMenuHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  contextMenuTitle: { fontSize: 18, fontWeight: '700' },
  contextMenuDivider: { height: 1, backgroundColor: 'rgba(0,0,0,0.1)', marginVertical: 12 },
  contextMenuItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12 },
  contextMenuItemText: { fontSize: 16 },
  contextMenuItemDanger: { opacity: 0.8 },

  // Skeleton
  skeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 8,
    gap: 14,
  },
  skeletonAvatar: { width: 52, height: 52, borderRadius: 26 },
  skeletonLine: { height: 12, borderRadius: 6 },
});
