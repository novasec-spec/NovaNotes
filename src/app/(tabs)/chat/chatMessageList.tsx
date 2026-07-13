// ─────────────────────────────────────────────────────────────────────────────
//  chatMessageList.tsx — the scrollable message list: bubbles, date
//  separators, swipe-to-reply, reactions row, seen receipts, empty state.
// ─────────────────────────────────────────────────────────────────────────────
import React, { forwardRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, ActivityIndicator,
  RefreshControl, StyleSheet,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Swipeable } from 'react-native-gesture-handler';
import { ChatAvatar, DateSep, BubbleContent } from './chatWidgets';
import {
  ChatMessage, User, GRADIENT, PINK, WHITE, SUCCESS, DANGER, GREY,
  fmtTime, fmtDateSep, haptic,
} from './chatShared';
import { s } from './chatStyles';

interface Props {
  msgs: ChatMessage[];
  user: User;
  otherUser: User;
  colors: any;
  isOnline: boolean;
  selectedMsgs: Set<string>;
  selectMode: boolean;
  loadingOlder: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onLoadEarlier: () => void;
  onScroll: (e: any) => void;
  onContentSizeChange: () => void;
  onBubbleTap: (msg: ChatMessage) => void;
  onLongPress: (msg: ChatMessage) => void;
  onSwipeReply: (msg: ChatMessage) => void;
  onImagePress: (uri: string) => void;
  onSeenPress: (msg: ChatMessage) => void;
  onResend: (msg: ChatMessage) => void;
  onReact: (msgId: string, emoji: string) => void;
  onUnreact: (msgId: string, emoji: string) => void;
}

const ChatMessageList = forwardRef<FlatList, Props>(function ChatMessageList({
  msgs, user, otherUser, colors, isOnline, selectedMsgs, selectMode,
  loadingOlder, refreshing, onRefresh, onLoadEarlier, onScroll, onContentSizeChange,
  onBubbleTap, onLongPress, onSwipeReply, onImagePress, onSeenPress, onResend,
  onReact, onUnreact,
}, listRef) {

  const renderMsg = useCallback(({ item: msg, index }: { item: ChatMessage; index: number }) => {
    const isOwn = msg.sender_id === user.id;
    const isDeleted = msg.deletedFor?.includes('all');
    const isDelMe = msg.deletedFor?.includes(user.id) && !isDeleted;
    if (isDelMe) return null;

    const prev = index > 0 ? msgs[index - 1] : null;
    const showDate = !prev || new Date(prev.created_at).toDateString() !== new Date(msg.created_at).toDateString();
    const showAvatar = !isOwn && (!prev || prev.sender_id !== msg.sender_id);
    const isFailed = msg._sendStatus === 'failed';
    const reactions = msg.reactions ?? [];
    const replyMsg = msg.replyTo ?? msgs.find(m => m.id === (msg as any).reply_to_id);
    const isSelected = selectedMsgs.has(msg.id);

    const bubbleBg = isOwn
      ? undefined
      : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth };

    return (
      <View>
        {showDate && <DateSep label={fmtDateSep(msg.created_at)} colors={colors} />}

        <Swipeable
          renderLeftActions={() => (
            <View style={s.swipeAction}>
              <Icon name="arrow-undo" size={20} color={WHITE} />
              <Text style={{ color: WHITE, fontSize: 11, marginTop: 2 }}>Reply</Text>
            </View>
          )}
          onSwipeableWillOpen={() => { onSwipeReply(msg); haptic('light'); }}
          overshootFriction={8}
          leftThreshold={60}
        >
          <View style={[s.msgRow, isOwn ? s.ownRow : s.otherRow]}>
            {/* Avatar */}
            {!isOwn && (
              showAvatar ? (
                <ChatAvatar
                  uri={otherUser.avatar_url}
                  name={otherUser.username}
                  userId={otherUser.id}
                  size={36}
                  online={isOnline}
                />
              ) : (
                <View style={{ width: 36 }} />
              )
            )}

            {/* Bubble */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => onBubbleTap(msg)}
              onLongPress={() => onLongPress(msg)}
              style={[
                s.bubbleWrap,
                isOwn ? { alignItems: 'flex-end' } : { alignItems: 'flex-start' },
              ]}
            >
              {isOwn ? (
                <LinearGradient
                  colors={isFailed ? ['#FCA5A5', '#EF4444'] : msg._sendStatus === 'queued' ? ['#CBD5E1', '#94A3B8'] : GRADIENT}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[
                    s.bubble,
                    s.ownBubble,
                    isSelected && { borderWidth: 2, borderColor: '#3B82F6' },
                  ]}
                >
                  <BubbleContent
                    msg={msg}
                    isOwn={isOwn}
                    isDeleted={!!isDeleted}
                    replyMsg={replyMsg}
                    colors={colors}
                    user={user}
                    otherUser={otherUser}
                    onImagePress={onImagePress}
                  />
                </LinearGradient>
              ) : (
                <View style={[
                  s.bubble,
                  s.otherBubble,
                  bubbleBg,
                  isSelected && { borderWidth: 2, borderColor: '#3B82F6' },
                ]}>
                  <BubbleContent
                    msg={msg}
                    isOwn={isOwn}
                    isDeleted={!!isDeleted}
                    replyMsg={replyMsg}
                    colors={colors}
                    user={user}
                    otherUser={otherUser}
                    onImagePress={onImagePress}
                  />
                </View>
              )}

              {/* Footer */}
              {!isDeleted && (
                <View style={[s.msgFooter, isOwn ? s.ownFooter : s.otherFooter]}>
                  {msg.isEdited && (
                    <Text style={[s.editedTxt, { color: colors.muted }]}>Edited · </Text>
                  )}
                  <Text style={[s.timeTxt, { color: isOwn ? 'rgba(255,255,255,0.7)' : colors.muted }]}>
                    {fmtTime(msg.created_at)}
                  </Text>
                  {isOwn && (
                    <TouchableOpacity
                      onPress={() => msg.read_at && onSeenPress(msg)}
                      activeOpacity={0.7}
                    >
                      {msg._sendStatus === 'sending' ? (
                        <ActivityIndicator size={12} color={GREY} style={{ marginLeft: 4 }} />
                      ) : msg._sendStatus === 'queued' ? (
                        <Icon name="time-outline" size={14} color={GREY} style={{ marginLeft: 4 }} />
                      ) : (
                        <Icon
                          name={msg.read_at ? 'checkmark-done' : msg.delivered_at ? 'checkmark-done' : 'checkmark'}
                          size={14}
                          color={msg.read_at ? SUCCESS : GREY}
                          style={{ marginLeft: 4 }}
                        />
                      )}
                    </TouchableOpacity>
                  )}
                  {isFailed && (
                    <TouchableOpacity
                      onPress={() => onResend(msg)}
                      style={{ marginLeft: 6 }}
                    >
                      <Icon name="refresh" size={14} color={DANGER} />
                    </TouchableOpacity>
                  )}
                  {msg._sendStatus === 'queued' && (
                    <TouchableOpacity
                      onPress={() => onResend(msg)}
                      style={{ marginLeft: 6 }}
                    >
                      <Icon name="refresh" size={14} color={GREY} />
                    </TouchableOpacity>
                  )}
                  {msg.isStarred && (
                    <Icon name="star" size={12} color="#F59E0B" style={{ marginLeft: 4 }} />
                  )}
                </View>
              )}

              {/* Reactions */}
              {reactions.length > 0 && (
                <View style={s.reactionsRow}>
                  {Object.entries(
                    reactions.reduce((acc, r) => {
                      acc[r.emoji] = (acc[r.emoji] ?? 0) + 1;
                      return acc;
                    }, {} as Record<string, number>)
                  ).map(([e, c]) => {
                    const isMine = reactions.some(r => r.userId === user.id && r.emoji === e);
                    return (
                      <TouchableOpacity
                        key={e}
                        style={[
                          s.reactionBadge,
                          {
                            backgroundColor: isMine ? PINK + '33' : colors.card,
                            borderColor: isMine ? PINK : colors.border,
                          },
                        ]}
                        onPress={() => isMine ? onUnreact(msg.id, e) : onReact(msg.id, e)}
                      >
                        <Text style={{ fontSize: 14 }}>{e}</Text>
                        {c > 1 && (
                          <Text style={{ fontSize: 11, color: colors.muted, fontWeight: '600' }}>
                            {c}
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </TouchableOpacity>
          </View>
        </Swipeable>
      </View>
    );
  }, [msgs, colors, isOnline, selectedMsgs, selectMode, user, otherUser]);

  return (
    <FlatList
      ref={listRef}
      data={msgs}
      keyExtractor={m => m.id}
      renderItem={renderMsg}
      contentContainerStyle={[s.msgList, msgs.length === 0 && s.emptyList]}
      onContentSizeChange={onContentSizeChange}
      onScroll={onScroll}
      scrollEventThrottle={80}
      onStartReached={onLoadEarlier}
      onStartReachedThreshold={0.25}
      ListHeaderComponent={
        loadingOlder ? (
          <View style={{ paddingVertical: 12, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={PINK} />
          </View>
        ) : null
      }
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={PINK}
          colors={[PINK]}
        />
      }
      ListEmptyComponent={
        <View style={s.emptyWrap}>
          <View style={s.lockCircle}>
            <Icon name="lock-closed" size={34} color={PINK} />
          </View>
          <Text style={[s.emptyTitle, { color: colors.text }]}>
            No messages yet
          </Text>
          <Text style={[s.emptySubtitle, { color: colors.muted }]}>
            Start the conversation with {otherUser.username}
          </Text>
          <Text style={[s.emptyEncryption, { color: colors.muted }]}>
            🔒 End-to-end encrypted
          </Text>
        </View>
      }
    />
  );
});

export default ChatMessageList;
