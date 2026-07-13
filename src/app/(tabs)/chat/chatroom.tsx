// ─────────────────────────────────────────────────────────────────────────────
//  chatroom.tsx — main chat screen. Owns all state, data loading, realtime
//  subscriptions, and message actions; renders the pieces from chatHeader,
//  chatMessageList, chatInputArea, chatOverlays and chatWidgets.
// ─────────────────────────────────────────────────────────────────────────────
import React, {
  useState, useEffect, useCallback, useRef, useMemo, useReducer,
} from 'react';
import {
  FlatList, KeyboardAvoidingView, Platform,
  StatusBar, Clipboard,
} from 'react-native';
import { supabase } from '../../../config/supabase';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Location from 'expo-location';
import { Audio } from 'expo-av';
import { useTheme } from '../../../contexts/ThemeContext';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { sendChatNotification, registerPushToken } from './notification';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import ChatSettings from './ChatSettings';
import { useLocalSearchParams } from 'expo-router';


  
import {
  ChatMessage, User, msgReducer, uploadToStorage,
  TYPING_TIMEOUT_MS, NEAR_BOTTOM_THRESHOLD, MESSAGES_PER_PAGE, EDIT_WINDOW_MS, TAB_BAR_HEIGHT,
  genId, fmtTime, haptic,
} from './chatShared';
import { s } from './chatStyles';
import ChatHeader from './chatHeader';
import ChatMessageList from './chatMessageList';
import { AttachSheet, ReactionPicker, Lightbox } from './chatWidgets';
import {
  TypingIndicatorRow, ReplyPreviewBar, BlockedInputBar, RecordingBar, MessageInputBar,
} from './chatInputArea';
import {
  SeenTooltip, OfflineBanner, CachedBanner, BlockedBanner, SelectionHeader,
  SearchBar, SearchResultsList, StarredDrawer, ScrollFab, StarredButton,
} from './chatOverlays';
import ChatSkeleton from './chatSkeleton';
import ChatEditModal from './chatEditModal';
import { ChatAlertModal, showChatAlert } from './chatAlertModal';
import {
  cacheMessages, loadCachedMessages, getOutbox, addToOutbox,
  removeFromOutbox, bumpOutboxAttempt, subscribeNetwork,
} from './chatCache';

interface Props {
  user: User;
  otherUser: User;
  onBack: () => void;
}

export default function ChatRoom({ user, otherUser, onBack }: Props) {
 const { otherUserId } = useLocalSearchParams();
  const { colors, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  // ── State ──────────────────────────────────────────────────────────────────
  const [msgs, dispatch] = useReducer(msgReducer, []);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recDuration, setRecDuration] = useState(0);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [showAttach, setShowAttach] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const [otherTyping, setOtherTyping] = useState(false);
  const [isOnline, setIsOnline] = useState(otherUser.online);
  const [lightboxUri, setLightboxUri] = useState<string | null>(null);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [hasOlder, setHasOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [reactionTarget, setReactionTarget] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [showReadReceipts, setShowReadReceipts] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [disappTimer, setDisappTimer] = useState<number | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [seenTooltip, setSeenTooltip] = useState<string | null>(null);
  const [selectedMsgs, setSelectedMsgs] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [showStarred, setShowStarred] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [showScrollFab, setShowScrollFab] = useState(false);
  const [usingCache, setUsingCache] = useState(false);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const listRef = useRef<FlatList>(null);
  const typingChannel = useRef<any>(null);
  const recTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const isTypingRef = useRef(false);
  const chatIdRef = useRef<string | null>(null);
  chatIdRef.current = chatId;
  const isOfflineRef = useRef(false);
  isOfflineRef.current = isOffline;
  const doubleTapRef = useRef<{ id: string; ts: number } | null>(null);
  const outboxFlushing = useRef(false);
  const typingTimeout = useRef<NodeJS.Timeout | null>(null);
  const typingClearTimeout = useRef<NodeJS.Timeout | null>(null);

  // ── Typing Functions ────────────────────────────────────────────────────
  const TYPING_TIMEOUT_MS = 2000;

  // ── Queued (offline-pending) message count, for the offline banner ─────
  const queuedCount = useMemo(
    () => msgs.filter(m => m._sendStatus === 'queued').length,
    [msgs]
  );

  // ── Calculate bottom padding ──────────────────────────────────────────────
  const getBottomPadding = () => {
    return Platform.OS === 'ios'
      ? insets.bottom + TAB_BAR_HEIGHT + 10
      : TAB_BAR_HEIGHT + 16;
  };

  // ── getOrCreateChat ──────────────────────────────────────────────────────
  const getOrCreateChat = async () => {
    try {
      const { data: existing } = await supabase
        .from('chats')
        .select('*')
        .or(`and(user1_id.eq.${user.id},user2_id.eq.${otherUser.id}),and(user1_id.eq.${otherUser.id},user2_id.eq.${user.id})`)
        .maybeSingle();

      if (existing) {
        setChatId(existing.id);
        await loadChatSettings(existing.id);
        return existing.id;
      }

      const { data: created, error } = await supabase
        .from('chats')
        .insert({
          user1_id: user.id,
          user2_id: otherUser.id,
          last_message: '',
          last_message_time: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      setChatId(created.id);
      return created.id;
    } catch (e) {
      console.error('[Chat] getOrCreateChat:', e);
      showChatAlert('Error', 'Could not start chat');
      return null;
    }
  };

  const loadChatSettings = async (id: string) => {
    try {
      const { data } = await supabase
        .from('chat_settings')
        .select('*')
        .eq('chat_id', id)
        .maybeSingle();
      if (data) {
        setIsMuted(data.is_muted ?? false);
        setDisappTimer(data.disappearing_timer ?? null);
        setShowReadReceipts(data.show_read_receipts !== false);
      }
    } catch { /* no settings yet */ }
  };

  // ── loadMessages ──────────────────────────────────────────────────────────
  const loadMessages = async (id: string, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      const list = (data ?? []) as ChatMessage[];
      dispatch({ type: 'SET', payload: list });
      setHasOlder(list.length >= MESSAGES_PER_PAGE);
      setUsingCache(false);
      cacheMessages(id, list);
      await markRead(list, id);
    } catch (e) {
      console.error('[Chat] loadMessages:', e);
      // Offline / slow network — fall back to the last cached page so the
      // screen isn't just empty.
      const cached = await loadCachedMessages(id);
      if (cached.length > 0) {
        dispatch({ type: 'SET', payload: cached });
        setUsingCache(true);
      } else if (!isRefresh) {
        showChatAlert('Connection Error', "Couldn't load messages. Check your connection and try again.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ── loadEarlierMessages ──────────────────────────────────────────────────
  const loadEarlier = async () => {
    const id = chatIdRef.current;
    if (!id || loadingOlder || !hasOlder || msgs.length === 0) return;
    const oldest = msgs[0]?.created_at;
    if (!oldest) return;
    setLoadingOlder(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', id)
        .lt('created_at', oldest)
        .order('created_at', { ascending: false })
        .limit(MESSAGES_PER_PAGE);

      if (error) throw error;
      const older = (data ?? []).slice().reverse() as ChatMessage[];
      setHasOlder(older.length >= MESSAGES_PER_PAGE);
      dispatch({ type: 'PREPEND', payload: older });
    } catch (e) {
      console.error('[Chat] loadEarlier:', e);
    } finally {
      setLoadingOlder(false);
    }
  };

  const markRead = async (list: ChatMessage[], id: string) => {
    const unread = list.filter(m => m.sender_id === otherUser.id && !m.read_at);
    if (unread.length === 0) return;
    await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .in('id', unread.map(m => m.id));
  };

  // ── sendMessage ──────────────────────────────────────────────────────────
  const sendMessage = async (
    text: string,
    media?: { type: 'image' | 'audio' | 'video' | 'file'; uri: string; name?: string; dur?: number },
    replyMsg?: ChatMessage | null
  ) => {
    if (!text.trim() && !media) return;
    const id = chatIdRef.current;
    if (!id) return;
    if (isBlocked) {
      showChatAlert('Blocked', 'You cannot send messages to this contact.');
      return;
    }

    const oid = genId();
    const now = new Date().toISOString();

    const optimistic: ChatMessage = {
      id: oid,
      chat_id: id,
      sender_id: user.id,
      text: text.trim(),
      created_at: now,
      delivered_at: null,
      read_at: null,
      _localImageUri: media?.type === 'image' ? media.uri : undefined,
      _localAudioUri: media?.type === 'audio' ? media.uri : undefined,
      _localVideoUri: media?.type === 'video' ? media.uri : undefined,
      _optimisticId: oid,
      _sendStatus: isOfflineRef.current ? 'queued' : 'sending',
      reply_to_id: replyMsg?.id,
      replyTo: replyMsg ?? undefined,
    } as ChatMessage;

    dispatch({ type: 'ADD', payload: optimistic });
    setInputText('');
    setReplyTo(null);
    stopTyping();
    haptic('light');
    scrollToBottom();

    // Offline: skip the network attempt entirely, queue for later.
    if (isOfflineRef.current) {
      await addToOutbox(id, {
        localId: oid, text: text.trim(), media,
        replyToId: replyMsg?.id, createdAt: now, attempts: 0,
      });
      return;
    }

    setSending(true);
    try {
      await performSend(id, text, media, replyMsg?.id, oid);
    } catch (e) {
      console.error('[Chat] sendMessage:', e);
      haptic('error');
      // Most send failures here are connectivity blips — queue for
      // automatic retry rather than dead-ending the message as failed.
      await addToOutbox(id, {
        localId: oid, text: text.trim(), media,
        replyToId: replyMsg?.id, createdAt: now, attempts: 0,
      });
      dispatch({ type: 'UPDATE', payload: { id: oid, updates: { _sendStatus: 'queued' } } });
    } finally {
      setSending(false);
    }
  };

  // ── performSend ──────────────────────────────────────────────────────────
  // The actual network work behind sending a message: upload media (if
  // any), insert the row, update the chat preview, and fire a notification.
  // Shared by sendMessage (fresh sends) and flushOutbox/retryQueuedMessage
  // (queued sends), so outbox items go through exactly the same path.
  const performSend = async (
    id: string,
    text: string,
    media: { type: 'image' | 'audio' | 'video' | 'file'; uri: string; name?: string; dur?: number } | undefined,
    replyToId: string | undefined,
    oid: string
  ) => {
    const now = new Date().toISOString();
    let msgData: any = {
      chat_id: id,
      sender_id: user.id,
      text: text.trim(),
      created_at: now,
      reply_to_id: replyToId ?? null,
    };

    if (media) {
      let mime = 'application/octet-stream';
      if (media.type === 'image') mime = 'image/jpeg';
      else if (media.type === 'video') mime = 'video/mp4';
      else if (media.type === 'audio') mime = 'audio/m4a';

      const publicUrl = await uploadToStorage(media.uri, `chat_${id}/${media.type}s`, mime);

      if (!publicUrl) throw new Error('Upload failed');

      if (media.type === 'image') msgData.image_url = publicUrl;
      else if (media.type === 'video') msgData.video_url = publicUrl;
      else if (media.type === 'audio') {
        msgData.audio_url = publicUrl;
        if (media.dur) msgData.audio_duration = Math.round(media.dur);
      } else if (media.type === 'file') {
        msgData.file_url = publicUrl;
        msgData.file_name = media.name;
      }
    }

    const { data: inserted, error } = await supabase
      .from('messages')
      .insert(msgData)
      .select()
      .single();

    if (error) throw error;

    dispatch({
      type: 'REPLACE_OPTIMISTIC',
      payload: { oid, real: { ...inserted, _sendStatus: 'sent' } },
    });

    await supabase
      .from('chats')
      .update({
        last_message: text.trim() || (media ? media.type : ''),
        last_message_time: now,
      })
      .eq('id', id);

    await sendChatNotification(
      user.id,
      otherUser.id,
      user.username,
      text.trim() || (media?.type ?? 'media'),
      { chatId: id, senderId: user.id, messageId: inserted.id, type: 'chat_message' }
    );

    if (disappTimer) {
      setTimeout(async () => {
        await supabase
          .from('messages')
          .update({ deleted_for: ['all'] })
          .eq('id', inserted.id);
        dispatch({
          type: 'DELETE',
          payload: { id: inserted.id, forAll: true, uid: 'system' },
        });
      }, disappTimer * 3_600_000);
    }

    return inserted;
  };

  // ── flushOutbox ─────────────────────────────────────────────────────────
  // Replays every queued message for this chat, in order, once we're back
  // online. Runs at most one flush at a time.
  const flushOutbox = async () => {
    const id = chatIdRef.current;
    if (!id || outboxFlushing.current) return;
    outboxFlushing.current = true;
    try {
      const items = await getOutbox(id);
      for (const item of items) {
        dispatch({ type: 'UPDATE', payload: { id: item.localId, updates: { _sendStatus: 'sending' } } });
        try {
          await performSend(id, item.text, item.media, item.replyToId, item.localId);
          await removeFromOutbox(id, item.localId);
        } catch (e) {
          console.error('[Chat] flushOutbox item failed:', e);
          await bumpOutboxAttempt(id, item.localId);
          dispatch({ type: 'UPDATE', payload: { id: item.localId, updates: { _sendStatus: 'queued' } } });
        }
      }
    } finally {
      outboxFlushing.current = false;
    }
  };

  // ── retryQueuedMessage ──────────────────────────────────────────────────
  // Manual retry (tapping the clock/refresh icon on a queued or failed
  // message) — attempts that single message immediately.
  const retryQueuedMessage = async (msg: ChatMessage) => {
    const id = chatIdRef.current;
    if (!id) return;
    const oid = msg._optimisticId ?? msg.id;
    const media = msg._localImageUri
      ? { type: 'image' as const, uri: msg._localImageUri }
      : msg._localAudioUri
        ? { type: 'audio' as const, uri: msg._localAudioUri }
        : msg._localVideoUri
          ? { type: 'video' as const, uri: msg._localVideoUri }
          : undefined;

    dispatch({ type: 'UPDATE', payload: { id: oid, updates: { _sendStatus: 'sending' } } });
    try {
      await performSend(id, msg.text ?? '', media, (msg as any).reply_to_id, oid);
      await removeFromOutbox(id, oid);
    } catch (e) {
      console.error('[Chat] retryQueuedMessage:', e);
      await addToOutbox(id, {
        localId: oid, text: msg.text ?? '', media,
        replyToId: (msg as any).reply_to_id, createdAt: msg.created_at, attempts: 0,
      });
      dispatch({ type: 'UPDATE', payload: { id: oid, updates: { _sendStatus: 'queued' } } });
    }
  };

  // ── editMessage ──────────────────────────────────────────────────────────
  const editMessage = async (msgId: string, newText: string) => {
    const msg = msgs.find(m => m.id === msgId);
    if (!msg) return;
    if (Date.now() - new Date(msg.created_at).getTime() > EDIT_WINDOW_MS) {
      showChatAlert('Cannot Edit', 'Messages can only be edited within 15 minutes.');
      return;
    }
    try {
      await supabase
        .from('messages')
        .update({
          text: newText,
          is_edited: true,
          edited_at: new Date().toISOString(),
        })
        .eq('id', msgId);
      dispatch({
        type: 'UPDATE',
        payload: {
          id: msgId,
          updates: {
            text: newText,
            isEdited: true,
            editedAt: new Date().toISOString(),
          },
        },
      });
      haptic('light');
    } catch (e) {
      showChatAlert('Error', 'Could not edit message.');
    }
  };

  // ── deleteMessage ────────────────────────────────────────────────────────
  const deleteMessage = async (msgId: string, forAll: boolean) => {
    if (forAll) {
      const msg = msgs.find(m => m.id === msgId);
      if (msg && Date.now() - new Date(msg.created_at).getTime() > EDIT_WINDOW_MS) {
        showChatAlert('Cannot Delete', 'Delete for everyone only available within 15 minutes.');
        return;
      }
      await supabase
        .from('messages')
        .update({
          text: 'This message was deleted',
          image_url: null,
          audio_url: null,
          video_url: null,
          file_url: null,
          deleted_for: ['all'],
        })
        .eq('id', msgId);
    } else {
      const existing = msgs.find(m => m.id === msgId)?.deletedFor ?? [];
      await supabase
        .from('messages')
        .update({ deleted_for: [...existing, user.id] })
        .eq('id', msgId);
    }
    dispatch({
      type: 'DELETE',
      payload: { id: msgId, forAll, uid: user.id },
    });
    haptic('light');
  };

  // ── Bulk delete ──────────────────────────────────────────────────────────
  const bulkDelete = async () => {
    const ids = Array.from(selectedMsgs);
    showChatAlert(
      'Delete Messages',
      `Delete ${ids.length} message${ids.length > 1 ? 's' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await supabase
              .from('messages')
              .delete()
              .in('id', ids);
            dispatch({ type: 'BULK_DELETE', payload: ids });
            setSelectedMsgs(new Set());
            setSelectMode(false);
            haptic('error');
          },
        },
      ]
    );
  };

  // ── addReaction ──────────────────────────────────────────────────────────
  const addReaction = async (msgId: string, emoji: string) => {
    dispatch({
      type: 'REACT',
      payload: {
        messageId: msgId,
        reaction: {
          emoji,
          userId: user.id,
          timestamp: new Date().toISOString(),
        },
      },
    });
    haptic('medium');
    try {
      await supabase
        .from('message_reactions')
        .upsert({
          message_id: msgId,
          user_id: user.id,
          emoji,
          created_at: new Date().toISOString(),
        });
    } catch (e) { console.error('[Chat] addReaction:', e); }
  };

  // ── removeReaction ──────────────────────────────────────────────────────
  const removeReaction = async (msgId: string, emoji: string) => {
    dispatch({
      type: 'UNREACT',
      payload: { messageId: msgId, uid: user.id, emoji },
    });
    try {
      await supabase
        .from('message_reactions')
        .delete()
        .eq('message_id', msgId)
        .eq('user_id', user.id)
        .eq('emoji', emoji);
    } catch (e) { console.error('[Chat] removeReaction:', e); }
  };

  // ── toggleStar ──────────────────────────────────────────────────────────
  const toggleStar = async (msgId: string) => {
    const msg = msgs.find(m => m.id === msgId);
    const starred = !msg?.isStarred;
    dispatch({ type: 'STAR', payload: { id: msgId, starred } });
    haptic('light');
    try {
      await supabase
        .from('starred_messages')
        .upsert({
          message_id: msgId,
          user_id: user.id,
          created_at: starred ? new Date().toISOString() : null,
        });
    } catch (e) { console.error('[Chat] toggleStar:', e); }
  };

  // ── Typing handlers ──────────────────────────────────────────────────────


  const broadcastTyping = useCallback(async (isTyping: boolean) => {
    if (!typingChannel.current) return;
    
    try {
      await typingChannel.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: { 
          userId: user.id, 
          chatId: chatId, 
          isTyping 
        },
      });
    } catch (error) {
      console.error('❌ Failed to send typing event:', error);
    }
  }, [user.id, chatId]);


const stopTyping = useCallback(() => {
  // Clear timeout
  if (typingTimeout.current) {
    clearTimeout(typingTimeout.current);
    typingTimeout.current = null;
  }
  
  // Only send stop if currently typing
  if (isTypingRef.current) {
    isTypingRef.current = false;
    broadcastTyping(false);
  }
}, [broadcastTyping]);

const handleInput = useCallback((text: string) => {
  setInputText(text);
  
  if (typingTimeout.current) {
    clearTimeout(typingTimeout.current);
    typingTimeout.current = null;
  }
  
  const hasText = text.trim().length > 0;
  
  if (hasText && !isTypingRef.current) {
    isTypingRef.current = true;
    broadcastTyping(true);
  }
  
  typingTimeout.current = setTimeout(() => {
    if (isTypingRef.current) {
      isTypingRef.current = false;
      broadcastTyping(false);
    }
    typingTimeout.current = null;
  }, TYPING_TIMEOUT_MS);
  
  if (!hasText && isTypingRef.current) {
    isTypingRef.current = false;
    broadcastTyping(false);
  }
}, [broadcastTyping]);


  // ── Media pickers ──────────────────────────────────────────────────────
  const pickGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showChatAlert('Permission needed', 'Allow photo access.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      quality: 0.85,
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

  const pickCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      showChatAlert('Permission needed', 'Allow camera access.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      await sendMessage('', {
        type: 'image',
        uri: result.assets[0].uri,
      });
    }
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets[0]) {
      await sendMessage('', {
        type: 'file',
        uri: result.assets[0].uri,
        name: result.assets[0].name,
      });
    }
  };

  const shareLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      showChatAlert('Permission needed', 'Allow location access.');
      return;
    }
    const loc = await Location.getCurrentPositionAsync({});
    const url = `https://maps.google.com/maps?q=${loc.coords.latitude},${loc.coords.longitude}`;
    await sendMessage(url);
  };

  const handleAttachPick = async (type: 'gallery' | 'camera' | 'document' | 'location') => {
    if (type === 'gallery') await pickGallery();
    else if (type === 'camera') await pickCamera();
    else if (type === 'document') await pickDocument();
    else if (type === 'location') await shareLocation();
  };

  // ── Voice recording ──────────────────────────────────────────────────────
  const startRecording = async () => {
    if (isRecording || recording) {
      console.log('Recording already in progress');
      return;
    }

    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording: r } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(r);
      setIsRecording(true);
      setRecDuration(0);
      haptic('heavy');
      recTimer.current = setInterval(() => setRecDuration(p => p + 1), 1000);
    } catch (e) {
      console.error('Recording error:', e);
      showChatAlert('Error', 'Could not start recording.');
      setRecording(null);
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    if (recTimer.current) clearInterval(recTimer.current);
    setIsRecording(false);
    haptic('light');

    const dur = recDuration;

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      setRecDuration(0);

      if (uri && dur >= 1) {
        await sendMessage('', {
          type: 'audio',
          uri,
          name: 'voice.m4a',
          dur,
        });
      } else if (dur < 1) {
        showChatAlert('Too short', 'Hold to record a longer voice note.');
      }
    } catch (e) {
      console.error('Stop recording error:', e);
      setRecording(null);
      setRecDuration(0);
    }
  };

  // ── Scroll helpers ──────────────────────────────────────────────────────
  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  };

  const onScroll = (e: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const fromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
    setIsNearBottom(fromBottom < NEAR_BOTTOM_THRESHOLD);
    setShowScrollFab(fromBottom > 300);
  };

  // ── Double-tap to react ──────────────────────────────────────────────────
  const onBubbleTap = (msg: ChatMessage) => {
    if (selectMode) {
      toggleSelect(msg.id);
      return;
    }
    const now = Date.now();
    if (doubleTapRef.current?.id === msg.id && now - doubleTapRef.current.ts < 350) {
      doubleTapRef.current = null;
      setReactionTarget(msg.id);
    } else {
      doubleTapRef.current = { id: msg.id, ts: now };
    }
  };

  // ── Selection mode ──────────────────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelectedMsgs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      if (newSet.size === 0) setSelectMode(false);
      return newSet;
    });
  };

  // ── Context menu ──────────────────────────────────────────────────────
  const showContextMenu = (msg: ChatMessage) => {
    const isOwn = msg.sender_id === user.id;
    const isDeleted = msg.deletedFor?.includes('all');
    if (isDeleted) return;
    haptic('medium');

    const options: any[] = [];

    if (msg.text) {
      options.push({
        text: '📋 Copy',
        onPress: async () => {
          await Clipboard.setStringAsync(msg.text!);
          haptic('light');
          showChatAlert('Copied', 'Message copied to clipboard');
        },
      });
    }

    options.push({
      text: '↩️ Reply',
      onPress: () => setReplyTo(msg),
    });

    options.push({
      text: '😀 React',
      onPress: () => setReactionTarget(msg.id),
    });

    options.push({
      text: msg.isStarred ? '☆ Unstar' : '★ Star',
      onPress: () => toggleStar(msg.id),
    });

    options.push({
      text: '↗️ Forward',
      onPress: () => {
        showChatAlert('Forward', 'Forward functionality coming soon');
      },
    });

    if (isOwn) {
      const elapsed = Date.now() - new Date(msg.created_at).getTime();
      if (elapsed < EDIT_WINDOW_MS && msg.text) {
        options.push({
          text: '✏️ Edit',
          onPress: () => setEditingMessage(msg),
        });
      }
      options.push({
        text: '🗑 Delete for me',
        style: 'destructive',
        onPress: () => deleteMessage(msg.id, false),
      });
      if (Date.now() - new Date(msg.created_at).getTime() < EDIT_WINDOW_MS) {
        options.push({
          text: '🗑 Delete for everyone',
          style: 'destructive',
          onPress: () => {
            showChatAlert(
              'Delete for everyone?',
              'Both sides will lose this message.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => deleteMessage(msg.id, true),
                },
              ]
            );
          },
        });
      }
    }

    options.push({ text: 'Cancel', style: 'cancel' });
    showChatAlert('Message Options', undefined, options);
  };

  // ── Search ──────────────────────────────────────────────────────────────
  const searchResults = useMemo(() => {
    if (!searchQ.trim()) return [];
    return msgs.filter(m =>
      m.text?.toLowerCase().includes(searchQ.toLowerCase())
    );
  }, [searchQ, msgs]);

  // ── Starred messages ────────────────────────────────────────────────────
  const starredMessages = useMemo(() => {
    return msgs.filter(m => m.isStarred);
  }, [msgs]);

  // ── Jump to a message from search/starred, closing the overlay ─────────
  const jumpToMessage = (msg: ChatMessage, closeOverlay: () => void) => {
    const idx = msgs.findIndex(m => m.id === msg.id);
    if (idx > -1) {
      listRef.current?.scrollToIndex({ index: idx, animated: true });
      closeOverlay();
    }
  };

  // ── Init + subscriptions ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      const id = await getOrCreateChat();
      if (id && !cancelled) await loadMessages(id);
    };
    init();
    registerPushToken(user.id).catch(console.error);
    supabase
      .from('users')
      .update({ online: true, last_seen: new Date().toISOString() })
      .eq('id', user.id);

    return () => {
      cancelled = true;
      stopTyping();
      supabase
        .from('users')
        .update({ online: false, last_seen: new Date().toISOString() })
        .eq('id', user.id);
    };
  }, []);

  // ── Network status: drives the offline banner and auto-flushes the
  //    outbox the moment we're back online ─────────────────────────────
  useEffect(() => {
    if (otherUserId) {
      console.log('Open chat with:', otherUserId);

      // Example:
      // fetch user details
      // load messages
      // setOtherUser(...)
    }
  }, [otherUserId]);
 

 useEffect(() => {
    const unsubscribe = subscribeNetwork((online) => {
      setIsOffline(!online);
      if (online) flushOutbox();
    });
    return unsubscribe;
  }, [chatId]);

  useEffect(() => {
    if (!chatId) return;

    const tyCh = supabase
      .channel(`typing:${chatId}:${user.id}`)
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.userId === otherUser.id) setOtherTyping(payload.isTyping);
      })
      .subscribe(s => {
        if (s === 'SUBSCRIBED') typingChannel.current = tyCh;
      });

    const msgCh = supabase
      .channel(`messages:${chatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`,
        },
        async ({ new: incoming }) => {
          if ((incoming as ChatMessage).sender_id === user.id) return;
          dispatch({ type: 'ADD', payload: incoming as ChatMessage });
          setOtherTyping(false);
          haptic('success');
          if (isNearBottom) scrollToBottom();
          await supabase
            .from('messages')
            .update({ delivered_at: new Date().toISOString() })
            .eq('id', (incoming as any).id);
          if (showReadReceipts) {
            await supabase
              .from('messages')
              .update({ read_at: new Date().toISOString() })
              .eq('id', (incoming as any).id);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`,
        },
        ({ new: upd }) => {
          dispatch({
            type: 'UPDATE',
            payload: {
              id: (upd as any).id,
              updates: upd as Partial<ChatMessage>,
            },
          });
        }
      )
      .subscribe();

    return () => {
      typingChannel.current = null;
      supabase.removeChannel(tyCh);
      supabase.removeChannel(msgCh);
    };
  }, [chatId, otherUser.id, isNearBottom, showReadReceipts]);

  // ── Loading state ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <GestureHandlerRootView style={[s.root, { backgroundColor: colors.background }]}>
        <SafeAreaView style={[s.root, { backgroundColor: colors.background }]} edges={['top']}>
          <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
          <ChatHeader
            otherUser={otherUser}
            isOnline={isOnline}
            otherTyping={false}
            showSearch={false}
            onBack={onBack}
            onAvatarPress={() => {}}
            onToggleSearch={() => {}}
            onSettingsPress={() => {}}
          />
          <ChatSkeleton colors={colors} />
        </SafeAreaView>
        <ChatAlertModal colors={colors} />
      </GestureHandlerRootView>
    );
  }

  if (showSettings) {
    return (
      <ChatSettings
        user={user}
        otherUser={otherUser}
        chatId={chatId!}
        onBack={() => setShowSettings(false)}
        onMuteToggle={setIsMuted}
        onDisappearingTimerChange={setDisappTimer}
        onBlockToggle={setIsBlocked}
        onReadReceiptsToggle={setShowReadReceipts}
        isMuted={isMuted}
        disappearingTimer={disappTimer}
        isBlocked={isBlocked}
        showReadReceipts={showReadReceipts}
      />
    );
  }

  const bottomPadding = getBottomPadding();

  // ── Main render ──────────────────────────────────────────────────────────
  return (
    <GestureHandlerRootView style={[s.root, { backgroundColor: colors.background }]}>
      <SafeAreaView style={[s.root, { backgroundColor: colors.background }]} edges={['top']}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

        <ChatHeader
          otherUser={otherUser}
          isOnline={isOnline}
          otherTyping={otherTyping}
          showSearch={showSearch}
          onBack={onBack}
          onAvatarPress={() => setShowSettings(true)}
          onToggleSearch={() => setShowSearch(v => !v)}
          onSettingsPress={() => setShowSettings(true)}
        />

        {seenTooltip && <SeenTooltip text={seenTooltip} />}
        {isOffline && <OfflineBanner queuedCount={queuedCount} />}
        {!isOffline && usingCache && <CachedBanner />}
        {isBlocked && <BlockedBanner />}

        {selectMode && (
          <SelectionHeader
            count={selectedMsgs.size}
            colors={colors}
            onDelete={bulkDelete}
            onCancel={() => { setSelectedMsgs(new Set()); setSelectMode(false); }}
          />
        )}

        {showSearch && (
          <SearchBar
            colors={colors}
            searchQ={searchQ}
            onChangeText={setSearchQ}
            onClear={() => setSearchQ('')}
          />
        )}

        {showStarred && (
          <StarredDrawer
            starredMessages={starredMessages}
            colors={colors}
            onClose={() => setShowStarred(false)}
            onSelect={(msg) => jumpToMessage(msg, () => setShowStarred(false))}
          />
        )}

        {showSearch ? (
          <SearchResultsList
            results={searchResults}
            searchQ={searchQ}
            user={user}
            otherUser={otherUser}
            colors={colors}
            bottomPadding={bottomPadding}
            onSelect={(msg) => jumpToMessage(msg, () => setShowSearch(false))}
          />
        ) : (
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
          >
            <ChatMessageList
              ref={listRef}
              msgs={msgs}
              user={user}
              otherUser={otherUser}
              colors={colors}
              isOnline={isOnline}
              selectedMsgs={selectedMsgs}
              selectMode={selectMode}
              loadingOlder={loadingOlder}
              refreshing={refreshing}
              onRefresh={() => chatId && loadMessages(chatId, true)}
              onLoadEarlier={loadEarlier}
              onScroll={onScroll}
              onContentSizeChange={() => { if (isNearBottom) scrollToBottom(); }}
              onBubbleTap={onBubbleTap}
              onLongPress={showContextMenu}
              onSwipeReply={setReplyTo}
              onImagePress={setLightboxUri}
              onSeenPress={(msg) => msg.read_at && setSeenTooltip(`Seen ${fmtTime(msg.read_at)}`)}
              onResend={retryQueuedMessage}
              onReact={addReaction}
              onUnreact={removeReaction}
            />

            {otherTyping && <TypingIndicatorRow otherUser={otherUser} colors={colors} />}

            {replyTo && (
              <ReplyPreviewBar
                replyTo={replyTo}
                user={user}
                otherUser={otherUser}
                colors={colors}
                onCancel={() => setReplyTo(null)}
              />
            )}

            {isBlocked ? (
              <BlockedInputBar colors={colors} bottomPadding={bottomPadding} />
            ) : isRecording ? (
              <RecordingBar
                colors={colors}
                bottomPadding={bottomPadding}
                recDuration={recDuration}
                onStop={stopRecording}
              />
            ) : (
              <MessageInputBar
                colors={colors}
                isDarkMode={isDarkMode}
                bottomPadding={bottomPadding}
                inputText={inputText}
                sending={sending}
                onChangeText={handleInput}
                onAttachPress={() => setShowAttach(true)}
                onSend={() => sendMessage(inputText, undefined, replyTo)}
                onStartRecording={startRecording}
                    value={inputText}             
               />
            )}
          </KeyboardAvoidingView>
        )}

        {showScrollFab && !showSearch && msgs.length > 0 && (
          <ScrollFab onPress={scrollToBottom} />
        )}

        {!showSearch && msgs.length > 0 && (
          <StarredButton onPress={() => setShowStarred(true)} />
        )}

        <AttachSheet
          visible={showAttach}
          onClose={() => setShowAttach(false)}
          onPick={handleAttachPick}
        />

        {reactionTarget && (
          <ReactionPicker
            onSelect={e => addReaction(reactionTarget, e)}
            onClose={() => setReactionTarget(null)}
          />
        )}

        <Lightbox uri={lightboxUri} onClose={() => setLightboxUri(null)} />

        <ChatEditModal
          visible={!!editingMessage}
          initialText={editingMessage?.text ?? ''}
          colors={colors}
          onCancel={() => setEditingMessage(null)}
          onSave={(t) => {
            if (editingMessage) editMessage(editingMessage.id, t);
            setEditingMessage(null);
          }}
        />
      </SafeAreaView>
      <ChatAlertModal colors={colors} />
    </GestureHandlerRootView>
  );
}
