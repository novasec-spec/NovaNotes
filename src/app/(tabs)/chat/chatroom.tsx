// src/app/chat/chatroom.tsx
// Production build: gradient UI, typing indicator (per-chat scoped), real seen/
// delivered/sending receipts, haptic feedback, working image/video/audio sharing
// with local caching, in-app lightbox + audio playback, optimistic sends, and
// incremental realtime updates instead of full reloads.
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  RefreshControl,
  Animated,
  Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../../../config/supabase';
import Icon from 'react-native-vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Audio, ResizeMode, Video } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../../contexts/ThemeContext';
import { User, Message } from './types';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { sendChatNotification, registerPushToken } from './notification';

const { width: W } = Dimensions.get('window');

interface Props {
  user: User;
  otherUser: User;
  onBack: () => void;
}

// ── Design tokens ──────────────────────────────────────────────────────────────
const PINK = '#FF6B9D';
const PINK_DARK = '#E84F86';
const WHITE = '#FFFFFF';
const SUCCESS = '#22C55E';
const BLUE = '#3B82F6';
const DANGER = '#EF4444';
const GREY = '#999999';
const GRADIENT = [PINK, PINK_DARK] as const;

// ── Storage / cache config ─────────────────────────────────────────────────────
const LOCAL_CHAT_MEDIA_DIR = FileSystem.documentDirectory + 'chat_media_cache/';
const TYPING_TIMEOUT_MS = 3000;
const NEAR_BOTTOM_THRESHOLD = 120;
const CACHED_MESSAGES_PER_CHAT = 15; // how many recent messages stay cached locally per chat
const CHAT_CACHE_PREFIX = 'chat_cache_'; // + chatId → JSON array of the last N messages
const CHAT_CACHE_META_PREFIX = 'chat_cache_meta_'; // + chatId → { newestTimestamp }

// ── Local-only message extensions (optimistic UI; not persisted to Supabase) ──
// Add these as optional columns/fields in your `Message` type if you want them
// to survive across sessions — they're harmless to omit since they all default
// to undefined for messages loaded fresh from the server.
interface LocalMessageExtras {
  _optimisticId?: string;   // temp id while a send is in flight
  _sendStatus?: 'sending' | 'sent' | 'failed';
  _localImageUri?: string;  // cached local copy once downloaded
  _localAudioUri?: string;
  _localVideoUri?: string;
}
type ChatMessage = Message & LocalMessageExtras;

// ── Helpers ────────────────────────────────────────────────────────────────────
function generateLocalId(): string {
  return `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Something went wrong';
}

function formatMessageTime(time: string) {
  const date = new Date(time);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateSeparator(dateStr: string) {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'long', day: 'numeric', year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
}

function formatAudioDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

async function ensureLocalMediaDir() {
  try {
    const info = await FileSystem.getInfoAsync(LOCAL_CHAT_MEDIA_DIR);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(LOCAL_CHAT_MEDIA_DIR, { intermediates: true });
    }
  } catch (e) {
    console.error('ensureLocalMediaDir error:', e);
  }
}

// Downloads a remote chat media file to local cache once, and reuses it after.
async function getOrCacheLocalUri(remoteUrl: string, cacheKey: string): Promise<string | null> {
  try {
    await ensureLocalMediaDir();
    const ext = remoteUrl.split('.').pop()?.split('?')[0] || 'dat';
    const localPath = `${LOCAL_CHAT_MEDIA_DIR}${cacheKey}.${ext}`;
    const info = await FileSystem.getInfoAsync(localPath);
    if (info.exists) return localPath;

    const result = await FileSystem.downloadAsync(remoteUrl, localPath);
    return result.uri;
  } catch (e) {
    console.error('getOrCacheLocalUri error:', e);
    return null;
  }
}

function triggerHaptic(kind: 'send' | 'receive' | 'recordStart' | 'recordStop' | 'error') {
  try {
    switch (kind) {
      case 'send':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case 'receive':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case 'recordStart':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case 'recordStop':
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case 'error':
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        break;
    }
  } catch {
    // Haptics can throw on unsupported devices/web — never let this break UX.
  }
}

// ── Per-chat local message cache ───────────────────────────────────────────────
// Keeps only the last CACHED_MESSAGES_PER_CHAT messages per conversation in
// AsyncStorage. Opening a chat renders this instantly — no network wait, no
// re-downloading the whole history every time. A background fetch then pulls
// only what's new since the newest cached message and tops the cache back up.
async function readChatCache(chatId: string): Promise<ChatMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(CHAT_CACHE_PREFIX + chatId);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('readChatCache error:', e);
    return [];
  }
}

async function writeChatCache(chatId: string, messages: ChatMessage[]) {
  try {
    // Strip local-only fields before persisting — a "sending"/"failed" status
    // or a temp optimistic id should never survive into a fresh app session.
    const trimmed = messages
      .filter(m => m._sendStatus !== 'sending' && m._sendStatus !== 'failed')
      .slice(-CACHED_MESSAGES_PER_CHAT)
      .map(({ _optimisticId, _sendStatus, ...rest }) => rest);

    await AsyncStorage.setItem(CHAT_CACHE_PREFIX + chatId, JSON.stringify(trimmed));

    if (trimmed.length > 0) {
      await AsyncStorage.setItem(
        CHAT_CACHE_META_PREFIX + chatId,
        trimmed[trimmed.length - 1].created_at
      );
    }
  } catch (e) {
    console.error('writeChatCache error:', e);
  }
}

async function getChatCacheNewestTimestamp(chatId: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(CHAT_CACHE_META_PREFIX + chatId);
  } catch {
    return null;
  }
}

// Keeps a rolling index of which chats have been opened, most-recent first —
// lets you show "recent chats" instantly elsewhere in the app without a query.
const RECENT_CHATS_KEY = 'recent_chat_ids';
const MAX_RECENT_CHATS_TRACKED = 15;

async function touchRecentChat(chatId: string) {
  try {
    const raw = await AsyncStorage.getItem(RECENT_CHATS_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    const next = [chatId, ...list.filter(id => id !== chatId)].slice(0, MAX_RECENT_CHATS_TRACKED);
    await AsyncStorage.setItem(RECENT_CHATS_KEY, JSON.stringify(next));
  } catch (e) {
    console.error('touchRecentChat error:', e);
  }
}

// ── Voice message player (bubble-embedded playback) ───────────────────────────
function VoiceMessagePlayer({ uri, isOwn, accentColor }: { uri: string; isOwn: boolean; accentColor: string }) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return () => {
      if (sound) sound.unloadAsync();
    };
  }, [sound]);

  const togglePlay = async () => {
    if (isPlaying && sound) {
      await sound.pauseAsync();
      setIsPlaying(false);
      return;
    }

    if (sound) {
      await sound.playAsync();
      setIsPlaying(true);
      return;
    }

    try {
      setLoading(true);
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true },
        (status) => {
          if (!status.isLoaded) return;
          setPosition(status.positionMillis / 1000);
          setDuration((status.durationMillis ?? 0) / 1000);
          setIsPlaying(status.isPlaying);
          if (status.didJustFinish) {
            setIsPlaying(false);
            setPosition(0);
            newSound.setPositionAsync(0);
          }
        }
      );
      setSound(newSound);
    } catch (error) {
      console.error('Voice playback error:', error);
      Alert.alert('Playback error', 'Could not play this voice note.');
    } finally {
      setLoading(false);
    }
  };

  const progress = duration > 0 ? position / duration : 0;
  const iconColor = isOwn ? WHITE : accentColor;
  const trackColor = isOwn ? 'rgba(255,255,255,0.35)' : accentColor + '33';
  const fillColor = isOwn ? WHITE : accentColor;

  return (
    <TouchableOpacity style={styles.audioContainer} onPress={togglePlay} activeOpacity={0.8}>
      {loading ? (
        <ActivityIndicator size="small" color={iconColor} />
      ) : (
        <Icon name={isPlaying ? 'pause-circle' : 'play-circle'} size={30} color={iconColor} />
      )}
      <View style={{ flex: 1 }}>
        <View style={[styles.audioTrack, { backgroundColor: trackColor }]}>
          <View style={[styles.audioTrackFill, { width: `${progress * 100}%`, backgroundColor: fillColor }]} />
        </View>
        <Text style={[styles.audioText, { color: isOwn ? 'rgba(255,255,255,0.85)' : undefined }]}>
          {formatAudioDuration(duration > 0 ? duration : position)}
        </Text>
      </View>
      <Icon name="mic" size={14} color={isOwn ? 'rgba(255,255,255,0.6)' : accentColor + '88'} />
    </TouchableOpacity>
  );
}

// ── Media lightbox (full-screen image / video viewer) ─────────────────────────
function MediaLightbox({
  visible, mediaUri, mediaType, onClose,
}: {
  visible: boolean;
  mediaUri: string | null;
  mediaType: 'image' | 'video' | null;
  onClose: () => void;
}) {
  if (!visible || !mediaUri) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.lightboxOverlay}>
        <TouchableOpacity style={styles.lightboxClose} onPress={onClose}>
          <Icon name="close-circle" size={36} color={WHITE} />
        </TouchableOpacity>
        {mediaType === 'video' ? (
          <Video
            source={{ uri: mediaUri }}
            style={styles.lightboxMedia}
            resizeMode={ResizeMode.CONTAIN}
            useNativeControls
            shouldPlay
            isLooping
          />
        ) : (
          <Image source={{ uri: mediaUri }} style={styles.lightboxMedia} resizeMode="contain" />
        )}
      </View>
    </Modal>
  );
}

// ── Animated typing indicator (three bouncing dots) ───────────────────────────
function TypingDots({ color }: { color: string }) {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const bounce = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(dot, { toValue: 1, duration: 350, delay, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 350, useNativeDriver: true }),
        ])
      );

    const a1 = bounce(dot1, 0);
    const a2 = bounce(dot2, 120);
    const a3 = bounce(dot3, 240);
    a1.start(); a2.start(); a3.start();

    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, []);

  const dotStyle = (anim: Animated.Value) => ({
    opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }],
  });

  return (
    <View style={styles.typingDotsRow}>
      <Animated.View style={[styles.typingDot, { backgroundColor: color }, dotStyle(dot1)]} />
      <Animated.View style={[styles.typingDot, { backgroundColor: color }, dotStyle(dot2)]} />
      <Animated.View style={[styles.typingDot, { backgroundColor: color }, dotStyle(dot3)]} />
    </View>
  );
}

// ── Date separator pill ───────────────────────────────────────────────────────
function DateSeparator({ label, colors }: { label: string; colors: any }) {
  return (
    <View style={styles.dateSeparatorRow}>
      <View style={[styles.dateSeparatorPill, { backgroundColor: colors.card }]}>
        <Text style={[styles.dateSeparatorText, { color: colors.muted }]}>{label}</Text>
      </View>
    </View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
export default function ChatRoom({ user, otherUser, onBack }: Props) {
  const { colors, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [isOnline, setIsOnline] = useState(otherUser.online);
  const [lightbox, setLightbox] = useState<{ uri: string; type: 'image' | 'video' } | null>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const typingTimeout = useRef<NodeJS.Timeout | null>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const recordingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const isTypingRef = useRef(false);
  const chatIdRef = useRef<string | null>(null);
  chatIdRef.current = chatId;

  // ── Get or create chat ──────────────────────────────────────────────────────
  const getOrCreateChat = async () => {
    try {
      const { data: existingChat } = await supabase
        .from('chats')
        .select('*')
        .or(`and(user1_id.eq.${user.id},user2_id.eq.${otherUser.id}),and(user1_id.eq.${otherUser.id},user2_id.eq.${user.id})`)
        .single();

      if (existingChat) {
        setChatId(existingChat.id);
        return existingChat.id;
      }

      const { data: newChat, error: createError } = await supabase
        .from('chats')
        .insert({
          user1_id: user.id,
          user2_id: otherUser.id,
          last_message: 'Start chatting!',
          last_message_time: new Date().toISOString(),
        })
        .select()
        .single();

      if (createError) throw createError;
      setChatId(newChat.id);
      return newChat.id;
    } catch (error) {
      console.error('Error getting/creating chat:', error);
      Alert.alert('Error', 'Could not start chat');
      return null;
    }
  };

  // ── Load messages (full load — used on mount / pull-to-refresh only) ──────
  // ── Load messages — cache-first ──────────────────────────────────────────
  // 1. Render whatever's cached for this chat instantly (no network wait).
  // 2. In the background, fetch only messages newer than the cache's newest
  //    timestamp — never the full history again.
  // 3. Merge, persist the trimmed cache, mark as read.
  const loadMessages = async (id: string, { isRefresh = false }: { isRefresh?: boolean } = {}) => {
    try {
      const cached = await readChatCache(id);
      if (cached.length > 0 && !isRefresh) {
        setMessages(cached);
        setLoading(false);
        setHasMoreOlder(cached.length >= CACHED_MESSAGES_PER_CHAT);
      }

      const newestCachedAt = isRefresh ? null : await getChatCacheNewestTimestamp(id);

      let query = supabase
        .from('messages')
        .select('*')
        .eq('chat_id', id)
        .order('created_at', { ascending: true });

      if (newestCachedAt) {
        // Incremental sync — only pull what arrived after our newest cached message.
        query = query.gt('created_at', newestCachedAt);
      } else {
        // No cache yet (first-ever open, or pull-to-refresh): just grab the
        // most recent page, not the entire chat history.
        query = supabase
          .from('messages')
          .select('*')
          .eq('chat_id', id)
          .order('created_at', { ascending: false })
          .limit(CACHED_MESSAGES_PER_CHAT);
      }

      const { data, error } = await query;
      if (error) throw error;

      const freshBatch: ChatMessage[] = newestCachedAt ? (data || []) : (data || []).slice().reverse();

      const merged = newestCachedAt
        ? [...cached, ...freshBatch.filter(f => !cached.some(c => c.id === f.id))]
        : freshBatch;

      setMessages(merged);
      setHasMoreOlder(!newestCachedAt && freshBatch.length >= CACHED_MESSAGES_PER_CHAT);
      await writeChatCache(id, merged);
      await touchRecentChat(id);
      await markMessagesAsRead(merged, id);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  // ── Load earlier messages (pagination on scroll-up) ─────────────────────
  // Only hits the network when the user actually scrolls back past what's
  // cached/loaded — the initial open never pays this cost.
  const loadEarlierMessages = async () => {
    const id = chatIdRef.current;
    if (!id || loadingOlder || !hasMoreOlder || messages.length === 0) return;

    const oldestLoaded = messages[0]?.created_at;
    if (!oldestLoaded) return;

    setLoadingOlder(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', id)
        .lt('created_at', oldestLoaded)
        .order('created_at', { ascending: false })
        .limit(CACHED_MESSAGES_PER_CHAT);

      if (error) throw error;

      const older = (data || []).slice().reverse();
      setHasMoreOlder(older.length >= CACHED_MESSAGES_PER_CHAT);
      setMessages(prev => [...older.filter(o => !prev.some(p => p.id === o.id)), ...prev]);
    } catch (error) {
      console.error('Error loading earlier messages:', error);
    } finally {
      setLoadingOlder(false);
    }
  };

  // ── Mark messages as read ──────────────────────────────────────────────────
  const markMessagesAsRead = async (messagesList: ChatMessage[], id: string) => {
    const unreadMessages = messagesList.filter(
      m => m.sender_id === otherUser.id && !m.read_at
    );
    if (unreadMessages.length === 0) return;

    try {
      await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .in('id', unreadMessages.map(m => m.id));
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  // ── Send message — optimistic: appears instantly, syncs in background ─────
  const sendMessage = async (text: string, media?: { type: 'image' | 'video' | 'audio' | 'file'; uri: string; name?: string; durationSeconds?: number }) => {
    if (!text.trim() && !media) return;
    const id = chatIdRef.current;
    if (!id) return;

    const optimisticId = generateLocalId();
    const nowIso = new Date().toISOString();

    const optimisticMessage: ChatMessage = {
      id: optimisticId,
      chat_id: id,
      sender_id: user.id,
      text: text.trim() || '',
      created_at: nowIso,
      delivered_at: null,
      read_at: null,
      image_url: media?.type === 'image' ? media.uri : undefined,
      video_url: media?.type === 'video' ? media.uri : undefined,
      audio_url: media?.type === 'audio' ? media.uri : undefined,
      file_url: media?.type === 'file' ? media.uri : undefined,
      file_name: media?.type === 'file' ? media.name : undefined,
      _optimisticId: optimisticId,
      _sendStatus: 'sending',
    } as ChatMessage;

    setMessages(prev => [...prev, optimisticMessage]);
    setInputText('');
    stopTypingBroadcast();
    triggerHaptic('send');
    scrollToBottomSoon();
    setSending(true);

    try {
      let messageData: any = {
        chat_id: id,
        sender_id: user.id,
        text: text.trim() || '',
        created_at: nowIso,
        delivered_at: null,
        read_at: null,
      };

      if (media) {
        const fileName = `${Date.now()}_${media.name || 'file'}`;
        const filePath = `chat_media/${id}/${fileName}`;

        const base64 = await FileSystem.readAsStringAsync(media.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const { error: uploadError } = await supabase.storage
          .from('chat_media')
          .upload(filePath, base64, {
            contentType: media.type === 'image' ? 'image/jpeg' : media.type === 'video' ? 'video/mp4' : 'audio/m4a',
          });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from('chat_media').getPublicUrl(filePath);

        if (media.type === 'image') messageData.image_url = urlData.publicUrl;
        else if (media.type === 'video') messageData.video_url = urlData.publicUrl;
        else if (media.type === 'audio') {
          messageData.audio_url = urlData.publicUrl;
          if (media.durationSeconds) messageData.audio_duration = Math.round(media.durationSeconds);
        } else if (media.type === 'file') {
          messageData.file_url = urlData.publicUrl;
          messageData.file_name = media.name;
        }
      }

      const { data: insertedMessage, error } = await supabase
        .from('messages')
        .insert(messageData)
        .select()
        .single();

      if (error) throw error;

      // Replace the optimistic placeholder with the real row.
      setMessages(prev => prev.map(m => m._optimisticId === optimisticId ? { ...insertedMessage, _sendStatus: 'sent' } : m));

      await supabase
        .from('chats')
        .update({
          last_message: text.trim() || (media ? mediaLabel(media.type) : ''),
          last_message_time: new Date().toISOString(),
        })
        .eq('id', id);

      const notificationBody = text.trim() || (media ? mediaLabel(media.type) : '');
      await sendChatNotification(
        user.id,
        otherUser.id,
        user.username,
        notificationBody,
        { chatId: id, senderId: user.id, messageId: insertedMessage.id, type: 'chat_message' }
      );
    } catch (error) {
      console.error('Error sending message:', error);
      triggerHaptic('error');
      setMessages(prev => prev.map(m => m._optimisticId === optimisticId ? { ...m, _sendStatus: 'failed' } : m));
    } finally {
      setSending(false);
    }
  };

  const mediaLabel = (type: 'image' | 'video' | 'audio' | 'file') => {
    switch (type) {
      case 'image': return 'Photo';
      case 'video': return 'Video';
      case 'audio': return 'Voice note';
      case 'file': return 'File';
    }
  };

  // ── Retry a failed optimistic send ─────────────────────────────────────────
  const retrySend = (msg: ChatMessage) => {
    setMessages(prev => prev.filter(m => m._optimisticId !== msg._optimisticId));
    const mediaType = msg.image_url ? 'image' : msg.video_url ? 'video' : msg.audio_url ? 'audio' : msg.file_url ? 'file' : undefined;
    const mediaUri = msg.image_url || msg.video_url || msg.audio_url || msg.file_url;
    sendMessage(msg.text, mediaType && mediaUri ? { type: mediaType, uri: mediaUri, name: msg.file_name } : undefined);
  };

  // ── Typing indicator — scoped per chat, with guaranteed stop-on-unmount ────
  const typingChannelName = (id: string) => `typing_${id}`;

  // IMPORTANT: supabase.channel(name) creates a *new* channel object every call.
  // Calling .send() on a channel that was never .subscribe()'d silently drops
  // the broadcast — it never reaches the other device. We must send on the
  // same channel instance that's already joined (see the subscription effect
  // below, which populates typingChannelRef.current).
  const broadcastTyping = (id: string, typing: boolean) => {
    const channel = typingChannelRef.current;
    if (!channel) return; // not subscribed yet — nothing to send on
    channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: user.id, isTyping: typing },
    });
  };

  const stopTypingBroadcast = () => {
    if (typingTimeout.current) {
      clearTimeout(typingTimeout.current);
      typingTimeout.current = null;
    }
    if (isTypingRef.current && chatIdRef.current) {
      isTypingRef.current = false;
      broadcastTyping(chatIdRef.current, false);
    }
  };

  const handleTyping = (text: string) => {
    setInputText(text);
    const id = chatIdRef.current;
    if (!id) return;

    if (typingTimeout.current) clearTimeout(typingTimeout.current);

    if (text.length > 0 && !isTypingRef.current) {
      isTypingRef.current = true;
      broadcastTyping(id, true);
    }

    typingTimeout.current = setTimeout(() => {
      if (isTypingRef.current) {
        isTypingRef.current = false;
        broadcastTyping(id, false);
      }
    }, TYPING_TIMEOUT_MS);
  };

  // ── Pick image / video ──────────────────────────────────────────────────────
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const type = asset.type || (asset.uri.endsWith('.mp4') ? 'video' : 'image');
      await sendMessage('', {
        type: type as 'image' | 'video',
        uri: asset.uri,
        name: asset.fileName || 'media',
      });
    }
  };

  // ── Record audio (with haptics + live duration) ────────────────────────────
  const startRecording = async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      setIsRecording(true);
      setRecordingDuration(0);
      triggerHaptic('recordStart');

      recordingTimer.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Could not start recording');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    if (recordingTimer.current) clearInterval(recordingTimer.current);
    setIsRecording(false);
    triggerHaptic('recordStop');

    const finalDuration = recordingDuration;
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    setRecording(null);
    setRecordingDuration(0);

    if (uri) {
      if (finalDuration < 1) {
        Alert.alert('Too short', 'Hold the mic button to record a longer voice note.');
        return;
      }
      await sendMessage('', {
        type: 'audio',
        uri,
        name: 'voice_note.m4a',
        durationSeconds: finalDuration,
      });
    }
  };

  // ── Scroll handling — only auto-scroll if user is already near the bottom ──
  const scrollToBottomSoon = () => {
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    });
  };

  const handleScroll = (e: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
    setIsNearBottom(distanceFromBottom < NEAR_BOTTOM_THRESHOLD);
  };

  // ── Delete own message ──────────────────────────────────────────────────────
  const deleteMessage = async (msg: ChatMessage) => {
    Alert.alert('Delete message', 'This will delete the message for both of you.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setMessages(prev => prev.filter(m => m.id !== msg.id));
          try {
            await supabase.from('messages').delete().eq('id', msg.id);
          } catch (error) {
            console.error('Delete message error:', error);
          }
        },
      },
    ]);
  };

  const copyMessageText = (msg: ChatMessage) => {
    if (!msg.text) return;
    // Clipboard API requires expo-clipboard; omitted here to avoid a silent new
    // dependency — wire this to `Clipboard.setStringAsync(msg.text)` if you add it.
    Alert.alert('Copy', 'Add expo-clipboard to enable copying message text.');
  };

  const onMessageLongPress = (msg: ChatMessage) => {
    const isOwn = msg.sender_id === user.id;
    const options: any[] = [];
    if (msg.text) options.push({ text: 'Copy text', onPress: () => copyMessageText(msg) });
    if (isOwn) options.push({ text: 'Delete', style: 'destructive', onPress: () => deleteMessage(msg) });
    options.push({ text: 'Cancel', style: 'cancel' });
    if (options.length > 1) {
      Alert.alert('Message options', undefined, options);
    }
  };

  // ── Initialize chat + subscriptions ────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const initChat = async () => {
      const id = await getOrCreateChat();
      if (id && !cancelled) {
        await loadMessages(id);
      }
    };
    initChat();
    registerPushToken(user.id).catch((e: unknown) => console.error('registerPushToken error:', e));

    const updateStatus = async () => {
      await supabase
        .from('users')
        .update({ online: true, last_seen: new Date().toISOString() })
        .eq('id', user.id);
    };
    updateStatus();

    return () => {
      cancelled = true;
      stopTypingBroadcast();
      supabase
        .from('users')
        .update({ online: false, last_seen: new Date().toISOString() })
        .eq('id', user.id);
    };
  }, []);

  // Subscriptions that depend on chatId — only created once it's known, and
  // torn down cleanly whenever it changes or the screen unmounts.
  useEffect(() => {
    if (!chatId) return;

    const typingSubscription = supabase
      .channel(typingChannelName(chatId))
      .on('broadcast', { event: 'typing' }, (payload) => {
        const { userId, isTyping } = payload.payload as { userId: string; isTyping: boolean };
        if (userId === otherUser.id) {
          setOtherUserTyping(isTyping);
        }
      })
      .subscribe((status) => {
        // Only usable for sending once the join actually succeeds.
        if (status === 'SUBSCRIBED') {
          typingChannelRef.current = typingSubscription;
        }
      });

    const messageSubscription = supabase
      .channel(`messages_${chatId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
        (payload) => {
          const incoming = payload.new as ChatMessage;
          if (incoming.sender_id === user.id) return; // our own inserts are handled optimistically

          setMessages(prev => {
            if (prev.some(m => m.id === incoming.id)) return prev;
            return [...prev, incoming];
          });
          setOtherUserTyping(false);
          triggerHaptic('receive');
          if (isNearBottom) scrollToBottomSoon();

          // Mark as delivered immediately, then read shortly after (chat is open).
          supabase.from('messages').update({ delivered_at: new Date().toISOString() }).eq('id', incoming.id)
            .then(() => supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('id', incoming.id));
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
        (payload) => {
          const updated = payload.new as ChatMessage;
          setMessages(prev => prev.map(m => m.id === updated.id ? { ...m, ...updated } : m));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
        (payload) => {
          const deletedId = (payload.old as any)?.id;
          if (deletedId) setMessages(prev => prev.filter(m => m.id !== deletedId));
        }
      )
      .subscribe();

    return () => {
      typingChannelRef.current = null;
      typingSubscription.unsubscribe();
      messageSubscription.unsubscribe();
    };
  }, [chatId, otherUser.id, isNearBottom]);

  // ── Keep the local cache in sync with whatever's on screen ─────────────────
  // One place, not scattered after every setMessages call — debounced so a
  // burst of updates (e.g. realtime + optimistic swap) only writes once.
  useEffect(() => {
    if (!chatId || messages.length === 0) return;
    const handle = setTimeout(() => {
      writeChatCache(chatId, messages);
    }, 250);
    return () => clearTimeout(handle);
  }, [chatId, messages]);

  // ── Status icon helpers ─────────────────────────────────────────────────────
  const getMessageStatus = (message: ChatMessage): { icon: string; color: string } | null => {
    if (message.sender_id !== user.id) return null;
    if (message._sendStatus === 'failed') return { icon: 'alert-circle', color: DANGER };
    if (message._sendStatus === 'sending') return { icon: 'time-outline', color: GREY };
    if (message.read_at) return { icon: 'checkmark-done', color: SUCCESS };
    if (message.delivered_at) return { icon: 'checkmark-done', color: GREY };
    return { icon: 'checkmark', color: GREY };
  };

  // ── Render a single message bubble ─────────────────────────────────────────
  const renderMessage = ({ item, index }: { item: ChatMessage; index: number }) => {
    const isOwn = item.sender_id === user.id;
    const status = getMessageStatus(item);
    const prevItem = messages[index - 1];
    const showDateSeparator = !prevItem || new Date(prevItem.created_at).toDateString() !== new Date(item.created_at).toDateString();
    const isFailed = item._sendStatus === 'failed';

    const innerContent = (
      <>
        {item.image_url && (
          <TouchableOpacity onPress={() => setLightbox({ uri: item._localImageUri || item.image_url!, type: 'image' })}>
            <Image source={{ uri: item._localImageUri || item.image_url }} style={styles.messageImage} resizeMode="cover" />
          </TouchableOpacity>
        )}
        {item.video_url && (
          <TouchableOpacity
            style={styles.videoContainer}
            onPress={() => setLightbox({ uri: item._localVideoUri || item.video_url!, type: 'video' })}
          >
            <Video
              source={{ uri: item._localVideoUri || item.video_url }}
              style={styles.messageImage}
              resizeMode={ResizeMode.COVER}
              shouldPlay={false}
              isMuted
            />
            <Icon name="play-circle" size={50} color={WHITE} style={styles.playIcon} />
          </TouchableOpacity>
        )}
        {item.audio_url && (
          <VoiceMessagePlayer
            uri={item._localAudioUri || item.audio_url}
            isOwn={isOwn}
            accentColor={PINK}
          />
        )}
        {item.file_url && !item.image_url && !item.video_url && !item.audio_url && (
          <TouchableOpacity style={[styles.fileContainer, { backgroundColor: isOwn ? 'rgba(255,255,255,0.18)' : colors.input }]}>
            <Icon name="document-attach" size={22} color={isOwn ? WHITE : PINK} />
            <Text style={[styles.fileText, isOwn ? { color: WHITE } : { color: colors.text }]} numberOfLines={1}>
              {item.file_name || 'File'}
            </Text>
          </TouchableOpacity>
        )}
        {item.text ? (
          <Text style={[styles.messageText, isOwn ? styles.ownText : { color: colors.text }]}>
            {item.text}
          </Text>
        ) : null}
        <View style={styles.messageFooter}>
          {isFailed && (
            <TouchableOpacity onPress={() => retrySend(item)} style={styles.retryRow}>
              <Icon name="refresh" size={11} color={DANGER} />
              <Text style={styles.retryText}>Tap to retry</Text>
            </TouchableOpacity>
          )}
          <Text style={[styles.messageTime, isOwn ? styles.ownTime : { color: colors.muted }]}>
            {formatMessageTime(item.created_at)}
          </Text>
          {status && (
            <Icon name={status.icon as any} size={14} color={status.color} style={styles.statusIcon} />
          )}
        </View>
      </>
    );

    return (
      <>
        {showDateSeparator && <DateSeparator label={formatDateSeparator(item.created_at)} colors={colors} />}
        <View style={[styles.messageRow, isOwn ? styles.ownMessage : styles.otherMessage]}>
          {!isOwn && (
            <Image source={{ uri: otherUser.avatar_url }} style={styles.messageAvatar} />
          )}
          <TouchableOpacity
            activeOpacity={0.85}
            onLongPress={() => onMessageLongPress(item)}
            disabled={item._sendStatus === 'sending'}
            style={isFailed && styles.failedBubble}
          >
            {isOwn ? (
              <LinearGradient
                colors={isFailed ? ['#FCA5A5', '#EF4444'] : GRADIENT}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.messageBubble, styles.ownBubble, styles.gradientBubble]}
              >
                {innerContent}
              </LinearGradient>
            ) : (
              <View style={[styles.messageBubble, styles.otherBubble, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {innerContent}
              </View>
            )}
          </TouchableOpacity>
        </View>
      </>
    );
  };

  // ── Header status text ──────────────────────────────────────────────────────
  const headerStatusText = otherUserTyping ? 'typing...' : isOnline ? 'Online' : 'Offline';

  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={PINK} />
      </View>
    );
  }

  return (
  <SafeAreaProvider>
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      
      {/* Header */}
      <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={WHITE} />
        </TouchableOpacity>
        <Image source={{ uri: otherUser.avatar_url }} style={styles.headerAvatar} />
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{otherUser.username}</Text>
          <View style={styles.headerStatusRow}>
            {isOnline && !otherUserTyping && <View style={styles.onlineDot} />}
            <Text style={styles.headerStatus}>{headerStatusText}</Text>
          </View>
        </View>
      </LinearGradient>

      {/* ✅ KeyboardAvoidingView now wraps BOTH the FlatList and the Input */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesContainer}
          onContentSizeChange={() => { if (isNearBottom) flatListRef.current?.scrollToEnd({ animated: true }); }}
          onScroll={handleScroll}
          scrollEventThrottle={100}
          onStartReached={loadEarlierMessages}
          onStartReachedThreshold={0.3}
          ListHeaderComponent={
            loadingOlder ? (
              <View style={styles.loadingOlderRow}>
                <ActivityIndicator size="small" color={PINK} />
              </View>
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={() => chatId && loadMessages(chatId, { isRefresh: true })}
              tintColor={PINK}
            />
          }          style={{ flex: 1 }}
        />

        {otherUserTyping && (
          <View style={[styles.typingContainer, { backgroundColor: colors.background }]}>
            <Image source={{ uri: otherUser.avatar_url }} style={styles.typingAvatar} />
            <View style={[styles.typingBubble, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TypingDots color={PINK} />
            </View>
          </View>
        )}

        {/* Input / Recording Area */}
        {isRecording ? (
          <View style={[styles.recordingBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
            <View style={styles.recordingPulseDot} />
            <Text style={[styles.recordingText, { color: colors.text }]}>
              Recording... {formatAudioDuration(recordingDuration)}
            </Text>
            <TouchableOpacity onPress={stopRecording} style={styles.stopRecordingBtn}>
              <Icon name="stop-circle" size={32} color={DANGER} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[
            styles.inputContainer,
            {
              backgroundColor: colors.card,
              borderTopColor: colors.border,
              paddingBottom: Platform.OS === 'ios' ? 12 : (insets.bottom || 12),
            }
          ]}>
            <TouchableOpacity style={styles.inputButton} onPress={() => setShowImagePicker(true)}>
              <Icon name="add-circle" size={28} color={PINK} />
            </TouchableOpacity>

            <TextInput
              style={[styles.input, { backgroundColor: colors.input, color: colors.text }]}
              placeholder="Type a message..."
              placeholderTextColor={colors.muted}
              value={inputText}
              onChangeText={handleTyping}
              multiline
              maxLength={1000}
            />

            {inputText.trim() ? (
              <TouchableOpacity onPress={() => sendMessage(inputText)} disabled={sending}>
                <LinearGradient colors={GRADIENT} style={styles.sendButton}>
                  <Icon name="send" size={22} color={WHITE} />                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPressIn={startRecording} disabled={isRecording}>
                <LinearGradient colors={['#4CAF50', '#2E9E4F']} style={styles.sendButton}>
                  <Icon name="mic" size={22} color={WHITE} />
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Modals and Lightbox stay outside */}
      <Modal visible={showImagePicker} transparent animationType="slide" onRequestClose={() => setShowImagePicker(false)}>
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: colors.text }]}>Share</Text>
            <View style={styles.modalOptions}>
              <TouchableOpacity style={styles.modalOption} onPress={() => { setShowImagePicker(false); pickImage(); }}>
                <View style={[styles.modalIconWrap, { backgroundColor: PINK + '18' }]}>
                  <Icon name="images" size={32} color={PINK} />
                </View>
                <Text style={[styles.modalOptionText, { color: colors.text }]}>Photos & Videos</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalOption} onPress={() => { setShowImagePicker(false); startRecording(); }}>
                <View style={[styles.modalIconWrap, { backgroundColor: '#4CAF5018' }]}>
                  <Icon name="mic" size={32} color="#4CAF50" />
                </View>
                <Text style={[styles.modalOptionText, { color: colors.text }]}>Voice Note</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={[styles.modalClose, { backgroundColor: colors.input }]} onPress={() => setShowImagePicker(false)}>
              <Text style={[styles.modalCloseText, { color: colors.muted }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <MediaLightbox
        visible={!!lightbox}
        mediaUri={lightbox?.uri ?? null}
        mediaType={lightbox?.type ?? null}
        onClose={() => setLightbox(null)}
      />
    </SafeAreaView>
  </SafeAreaProvider>
);
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  paddingBottom: 100
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 16,
  },
  backButton: {
    padding: 4,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginLeft: 12,
  },
  headerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '600',
    color: WHITE,
  },
  headerStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#4ADE80',
  },
  headerStatus: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
  },
  messagesContainer: {
    padding: 16,
    paddingBottom: 8,
  },
  loadingOlderRow: {
    paddingVertical: 12,
    alignItems: 'center',
  },

  // Date separator
  dateSeparatorRow: {
    alignItems: 'center',
    marginVertical: 12,
  },
  dateSeparatorPill: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 12,
  },
  dateSeparatorText: {
    fontSize: 11,
    fontWeight: '600',
  },

  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  ownMessage: {
    justifyContent: 'flex-end',
  },
  otherMessage: {
    justifyContent: 'flex-start',
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  messageBubble: {
    maxWidth: W * 0.75,
    padding: 12,
    borderRadius: 16,
  },
  gradientBubble: {
    // LinearGradient needs borderRadius set on itself too, in addition to the
    // shared messageBubble/ownBubble values, to clip its colored fill.
    overflow: 'hidden',
  },
  ownBubble: {
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  failedBubble: {
    opacity: 0.85,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  ownText: {
    color: WHITE,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
    gap: 4,
  },
  messageTime: {
    fontSize: 10,
  },
  ownTime: {
    color: 'rgba(255,255,255,0.7)',
  },
  statusIcon: {
    marginLeft: 2,
  },
  retryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginRight: 6,
  },
  retryText: {
    fontSize: 10,
    fontWeight: '700',
    color: DANGER,
  },
  messageImage: {
    width: 200,
    height: 150,
    borderRadius: 12,
    marginBottom: 8,
  },
  videoContainer: {
    position: 'relative',
  },
  playIcon: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -25,
    marginLeft: -25,
  },
  audioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    gap: 10,
    marginBottom: 8,
    minWidth: 180,
  },
  audioTrack: {
    height: 4,
    borderRadius: 2,
    marginBottom: 4,
    overflow: 'hidden',
  },
  audioTrackFill: {
    height: 4,
    borderRadius: 2,
  },
  audioText: {
    fontSize: 12,
  },
  fileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  fileText: {
    fontSize: 13,
    flex: 1,
  },

  // Typing indicator
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 8,
  },
  typingAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  typingBubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },
  typingDotsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  // Recording bar
  recordingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    gap: 12,
  },
  recordingPulseDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: DANGER,
  },
  recordingText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  stopRecordingBtn: {
    padding: 2,
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    gap: 8,
  },
  inputButton: {
    padding: 4,
  },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Lightbox
  lightboxOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightboxClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
  },
  lightboxMedia: {
    width: '100%',
    height: '80%',
  },

  // Media picker modal
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#00000022',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  modalOption: {
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    minWidth: 120,
    gap: 4,
  },
  modalIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOptionText: {
    fontSize: 14,
    marginTop: 8,
  },
  modalClose: {
    marginTop: 20,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
