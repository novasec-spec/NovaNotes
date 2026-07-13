// ─────────────────────────────────────────────────────────────────────────────
//  chatInputArea.tsx — everything below the message list: typing indicator,
//  reply preview, the text input bar, the voice-recording bar, and the
//  "you're blocked" bar.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import ReAnimated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { ChatAvatar, TypingDots } from './chatWidgets';
import { ChatMessage, User, GRADIENT, PINK, WHITE, DANGER, fmtDur } from './chatShared';
import { s } from './chatStyles';

// ── Typing indicator row (shown above the input, under the message list) ──
export function TypingIndicatorRow({ otherUser, colors }: { otherUser: User; colors: any }) {
  return (
    <ReAnimated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
      style={[s.typingWrap, { backgroundColor: colors.background }]}
    >
      <ChatAvatar
        uri={otherUser.avatar_url}
        name={otherUser.username}
        userId={otherUser.id}
        size={28}
        online={false}
      />
      <View style={[s.typingBubble, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TypingDots color={PINK} />
      </View>
    </ReAnimated.View>
  );
}

// ── Reply preview bar ──────────────────────────────────────────────────────
export function ReplyPreviewBar({ replyTo, user, otherUser, colors, onCancel }: {
  replyTo: ChatMessage; user: User; otherUser: User; colors: any; onCancel: () => void;
}) {
  return (
    <ReAnimated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
      style={[s.replyBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}
    >
      <View style={[s.replyLine, { backgroundColor: PINK }]} />
      <View style={{ flex: 1 }}>
        <Text style={[s.replyUser, { color: PINK }]}>
          {replyTo.sender_id === user.id ? 'You' : otherUser.username}
        </Text>
        <Text style={[s.replyPreview, { color: colors.muted }]} numberOfLines={1}>
          {replyTo.text || 'Media'}
        </Text>
      </View>
      <TouchableOpacity onPress={onCancel} style={{ padding: 6 }}>
        <Icon name="close" size={20} color={colors.muted} />
      </TouchableOpacity>
    </ReAnimated.View>
  );
}

// ── Blocked bar (shown instead of the input when the contact is blocked) ──
export function BlockedInputBar({ colors, bottomPadding }: { colors: any; bottomPadding: number }) {
  return (
    <View style={[s.blockedInput, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: bottomPadding }]}>
      <Text style={{ color: colors.muted, textAlign: 'center', fontSize: 14 }}>
        You can't send messages to this contact
      </Text>
    </View>
  );
}

// ── Recording bar (shown instead of the input while recording a voice note) ──
export function RecordingBar({ colors, bottomPadding, recDuration, onStop }: {
  colors: any; bottomPadding: number; recDuration: number; onStop: () => void;
}) {
  return (
    <View style={[s.recBar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: bottomPadding }]}>
      <View style={s.recDot} />
      <Text style={[s.recTxt, { color: colors.text }]}>
        Recording {fmtDur(recDuration)}
      </Text>
      <TouchableOpacity onPress={onStop} style={s.recStop}>
        <Icon name="stop-circle" size={38} color={DANGER} />
      </TouchableOpacity>
    </View>
  );
}

// ── Main text input bar: attach button, text field, send/mic button ──────
export function MessageInputBar({
  colors, isDarkMode, bottomPadding, inputText, sending,
  onChangeText, onAttachPress, onSend, onStartRecording,
}: {
  colors: any; isDarkMode: boolean; bottomPadding: number;
  inputText: string; sending: boolean;
  onChangeText: (t: string) => void;
  onAttachPress: () => void;
  onSend: () => void;
  onStartRecording: () => void;
}) {
  return (
    <View style={[s.inputBar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: bottomPadding }]}>
      {/* Attach button */}
      <TouchableOpacity
        onPress={onAttachPress}
        style={s.inputIconBtn}
        activeOpacity={0.7}
      >
        <Icon name="add-circle" size={30} color={PINK} />
      </TouchableOpacity>

      {/* Input pill */}
      <View style={[s.inputPill, {
        backgroundColor: isDarkMode ? '#2A1A2E' : '#F8F0F5',
        borderColor: colors.border,
      }]}>
        <TextInput
          style={[s.input, { color: colors.text }]}
          placeholder="Message..."
          placeholderTextColor={colors.muted}
          value={inputText}
          onChangeText={onChangeText}
          multiline
          maxLength={2000}
        />
        {inputText.length > 1800 && (
          <Text style={{ fontSize: 10, color: DANGER, paddingRight: 8, alignSelf: 'flex-end' }}>
            {2000 - inputText.length}
          </Text>
        )}
      </View>

      {/* Send / Voice button */}
      {inputText.trim() ? (
        <TouchableOpacity
          onPress={onSend}
          disabled={sending}
          style={s.sendBtn}
          activeOpacity={0.7}
        >
          <LinearGradient colors={GRADIENT} style={s.sendGrad}>
            {sending ? (
              <ActivityIndicator size={18} color={WHITE} />
            ) : (
              <Icon name="send" size={20} color={WHITE} />
            )}
          </LinearGradient>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          onPressIn={onStartRecording}
          style={s.sendBtn}
          activeOpacity={0.7}
        >
          <LinearGradient colors={['#22C55E', '#16A34A']} style={s.sendGrad}>
            <Icon name="mic" size={20} color={WHITE} />
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );
}
