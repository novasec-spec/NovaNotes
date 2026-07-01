// src/app/chat/NotificationBanner.tsx
// Mount this ONCE near your app root (e.g. in your root layout, above the
// navigator/stack) so it can show on top of any screen:
//
//   <NotificationBanner currentUserId={user.id} onOpenChat={(chatId) => router.push(`/chat/${chatId}`)} />
//
// It listens to InAppNotificationEmitter (see notifications.ts) for incoming
// chat notifications while the app is foregrounded, and renders an iOS-style
// top banner with Reply and Mark as Read actions. Tapping Reply expands a
// real TextInput right in the banner — no native text-input bugs, no
// navigation required to respond.
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Image,
  Platform,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../contexts/ThemeContext';
import {
  InAppNotificationEmitter,
  ChatNotificationData,
  markChatMessageRead,
  sendQuickReply,
} from './notification';
import { NotificationStore } from './notifications/NotificationStore';

const PINK = '#FF6B9D';
const PINK_DARK = '#E84F86';
const WHITE = '#FFFFFF';
const SUCCESS = '#22C55E';
const GREY = '#9CA3AF';

const AUTO_DISMISS_MS = 6000;

interface Props {
  currentUserId: string;
  onOpenChat?: (chatId: string, data: ChatNotificationData) => void;
}

interface BannerState {
  data: ChatNotificationData;
  visible: boolean;
  mode: 'collapsed' | 'replying';
  sending: boolean;
  marked: boolean;
}

export default function NotificationBanner({ currentUserId, onOpenChat }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [banner, setBanner] = useState<BannerState | null>(null);
  const [replyText, setReplyText] = useState('');

  const translateY = useRef(new Animated.Value(-140)).current;
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);

  // ── Subscribe to incoming notifications ───────────────────────────────────
  useEffect(() => {
    const unsubscribe = InAppNotificationEmitter.subscribe((event) => {
      if (event.type === 'received') {
        showBanner(event.data);
      }
      // 'reply' / 'markRead' / 'open' events originate from native category
      // actions (lock screen etc) — if the banner happens to be showing the
      // same notification when one of those fires, dismiss it so we don't
      // show stale state.
      if (event.type !== 'received' && banner?.data.messageId === event.data.messageId) {
        dismiss();
      }
    });
    return unsubscribe;
  }, [banner]);

  const showBanner = (data: ChatNotificationData) => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    setReplyText('');
    setBanner({ data, visible: true, mode: 'collapsed', sending: false, marked: false });

    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}

    Animated.spring(translateY, {
      toValue: 0,
      friction: 9,
      tension: 80,
      useNativeDriver: true,
    }).start();

    armAutoDismiss();
  };

  const armAutoDismiss = () => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    dismissTimer.current = setTimeout(() => {
      dismiss();
    }, AUTO_DISMISS_MS);
  };

  const dismiss = () => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    Keyboard.dismiss();
    Animated.timing(translateY, {
      toValue: -140,
      duration: 220,
      useNativeDriver: true,
    }).start(() => setBanner(null));
  };

  const handleOpen = () => {
    if (!banner) return;
    onOpenChat?.(banner.data.chatId, banner.data);
    dismiss();
  };

  const markStoreEntryRead = async (messageId?: string) => {
    if (!messageId) return;
    try {
      const all = await NotificationStore.getAll();
      const match = all.find(n => n.messageId === messageId);
      if (match) await NotificationStore.markRead(match.id);
    } catch (e) {
      console.error('markStoreEntryRead error:', e);
    }
  };

  const handleMarkRead = async () => {
    if (!banner) return;
    setBanner(b => b ? { ...b, marked: true } : b);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    await markChatMessageRead(banner.data);
    await markStoreEntryRead(banner.data.messageId);
    setTimeout(dismiss, 500); // brief "marked as read" confirmation before it slides away
  };

  const handleReplyTap = () => {
    if (!banner) return;
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    setBanner(b => b ? { ...b, mode: 'replying' } : b);
    setTimeout(() => inputRef.current?.focus(), 80);
  };

  const handleSendReply = async () => {
    if (!banner || !replyText.trim()) return;
    setBanner(b => b ? { ...b, sending: true } : b);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    const ok = await sendQuickReply(currentUserId, banner.data, replyText);
    if (ok) {
      await markStoreEntryRead(banner.data.messageId);
      setReplyText('');
      dismiss();
    } else {
      setBanner(b => b ? { ...b, sending: false } : b);
    }
  };

  if (!banner) return null;

  const { data, mode, sending, marked } = banner;

  return (
    <Animated.View
      style={[
        styles.wrapper,
        { top: insets.top, transform: [{ translateY }] },
      ]}
      pointerEvents="box-none"
    >
      <View style={[styles.card, { backgroundColor: colors.card ?? WHITE }]}>
        <TouchableOpacity
          style={styles.topRow}
          onPress={mode === 'collapsed' ? handleOpen : undefined}
          activeOpacity={mode === 'collapsed' ? 0.85 : 1}
        >
          {data.senderAvatar ? (
            <Image source={{ uri: data.senderAvatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Icon name="person" size={18} color={WHITE} />
            </View>
          )}

          <View style={styles.textCol}>
            <Text style={[styles.senderName, { color: colors.text ?? '#1A1A1A' }]} numberOfLines={1}>
              {data.senderName || 'New message'}
            </Text>
            {marked ? (
              <View style={styles.markedRow}>
                <Icon name="checkmark-circle" size={13} color={SUCCESS} />
                <Text style={[styles.markedText, { color: SUCCESS }]}>Marked as read</Text>
              </View>
            ) : (
              <Text style={[styles.preview, { color: colors.muted ?? GREY }]} numberOfLines={2}>
                {data.preview || 'Sent you a message'}
              </Text>
            )}
          </View>

          <TouchableOpacity onPress={dismiss} style={styles.closeBtn}>
            <Icon name="close" size={16} color={colors.muted ?? GREY} />
          </TouchableOpacity>
        </TouchableOpacity>

        {mode === 'collapsed' && !marked && (
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.actionBtn} onPress={handleReplyTap}>
              <Icon name="arrow-undo-outline" size={15} color={PINK} />
              <Text style={[styles.actionText, { color: PINK }]}>Reply</Text>
            </TouchableOpacity>
            <View style={styles.actionDivider} />
            <TouchableOpacity style={styles.actionBtn} onPress={handleMarkRead}>
              <Icon name="checkmark-done-outline" size={15} color={colors.text ?? '#1A1A1A'} />
              <Text style={[styles.actionText, { color: colors.text ?? '#1A1A1A' }]}>Mark as read</Text>
            </TouchableOpacity>
          </View>
        )}

        {mode === 'replying' && (
          <View style={styles.replyRow}>
            <TextInput
              ref={inputRef}
              style={[styles.replyInput, { backgroundColor: colors.input ?? '#F3F4F6', color: colors.text ?? '#1A1A1A' }]}
              placeholder="Type a reply..."
              placeholderTextColor={GREY}
              value={replyText}
              onChangeText={setReplyText}
              onSubmitEditing={handleSendReply}
              returnKeyType="send"
              autoFocus
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[styles.sendBtn, !replyText.trim() && styles.sendBtnDisabled]}
              onPress={handleSendReply}
              disabled={!replyText.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color={WHITE} />
              ) : (
                <Icon name="send" size={16} color={WHITE} />
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 10,
    right: 10,
    zIndex: 9999,
    elevation: 20,
  },
  card: {
    borderRadius: 18,
    paddingTop: 12,
    paddingHorizontal: 12,
    paddingBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  avatarFallback: {
    backgroundColor: PINK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
    paddingTop: 1,
  },
  senderName: {
    fontSize: 14,
    fontWeight: '700',
  },
  preview: {
    fontSize: 13,
    marginTop: 2,
    lineHeight: 17,
  },
  markedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  markedText: {
    fontSize: 12,
    fontWeight: '600',
  },
  closeBtn: {
    padding: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  actionDivider: {
    width: 1,
    height: 18,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  actionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  replyRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  replyInput: {
    flex: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    maxHeight: 80,
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: PINK_DARK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: GREY,
  },
});
