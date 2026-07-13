// ─────────────────────────────────────────────────────────────────────────────
//  chatOverlays.tsx — banners and overlays that float above/around the
//  message list: seen tooltip, offline/blocked banners, multi-select header,
//  search bar + results, starred messages drawer, scroll-to-bottom FAB,
//  starred-messages button.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import ReAnimated, { FadeIn, FadeOut, SlideInRight, SlideOutLeft, ZoomIn, ZoomOut } from 'react-native-reanimated';
import { ChatMessage, GRADIENT, PINK, WHITE, DANGER, ORANGE, fmtTime } from './chatShared';
import { s } from './chatStyles';

// ── Seen tooltip ────────────────────────────────────────────────────────────
export function SeenTooltip({ text }: { text: string }) {
  return (
    <ReAnimated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={s.seenTooltip}>
      <Text style={{ color: WHITE, fontSize: 13, fontWeight: '600' }}>{text}</Text>
    </ReAnimated.View>
  );
}

// ── Offline banner ──────────────────────────────────────────────────────────
export function OfflineBanner({ queuedCount = 0 }: { queuedCount?: number }) {
  return (
    <View style={[s.offlineBanner, { backgroundColor: ORANGE + '15' }]}>
      <Icon name="cloud-offline-outline" size={16} color={ORANGE} />
      <Text style={{ color: ORANGE, fontSize: 13, fontWeight: '600' }}>
        {queuedCount > 0
          ? `You're offline — ${queuedCount} message${queuedCount > 1 ? 's' : ''} queued`
          : "You're offline — messages will send when connected"}
      </Text>
    </View>
  );
}

// ── Cached-messages banner (shown when a fresh load failed and we fell
//    back to the last cached page of messages) ──────────────────────────────
export function CachedBanner() {
  return (
    <View style={[s.offlineBanner, { backgroundColor: '#64748B15' }]}>
      <Icon name="time-outline" size={16} color="#64748B" />
      <Text style={{ color: '#64748B', fontSize: 13, fontWeight: '600' }}>
        Showing cached messages
      </Text>
    </View>
  );
}

// ── Blocked banner (top banner; distinct from the bottom "blocked" input) ──
export function BlockedBanner() {
  return (
    <View style={[s.blockedBanner, { backgroundColor: DANGER + '15' }]}>
      <Icon name="ban" size={16} color={DANGER} />
      <Text style={{ color: DANGER, fontSize: 13, fontWeight: '600' }}>
        You can't send messages to this contact
      </Text>
    </View>
  );
}

// ── Selection mode header ───────────────────────────────────────────────────
export function SelectionHeader({ count, colors, onDelete, onCancel }: {
  count: number; colors: any; onDelete: () => void; onCancel: () => void;
}) {
  return (
    <ReAnimated.View
      entering={FadeIn.duration(200)}
      style={[s.selectionHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
    >
      <Text style={[s.selectionText, { color: colors.text }]}>{count} selected</Text>
      <View style={{ flexDirection: 'row', gap: 16 }}>
        <TouchableOpacity onPress={onDelete}>
          <Icon name="trash-outline" size={22} color={DANGER} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onCancel}>
          <Icon name="close" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>
    </ReAnimated.View>
  );
}

// ── Search bar ───────────────────────────────────────────────────────────
export function SearchBar({ colors, searchQ, onChangeText, onClear }: {
  colors: any; searchQ: string; onChangeText: (t: string) => void; onClear: () => void;
}) {
  return (
    <ReAnimated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
      style={[s.searchBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
    >
      <Icon name="search" size={20} color={colors.muted} />
      <TextInput
        style={[s.searchInput, { color: colors.text }]}
        placeholder="Search messages..."
        placeholderTextColor={colors.muted}
        value={searchQ}
        onChangeText={onChangeText}
        autoFocus
      />
      {searchQ.length > 0 && (
        <TouchableOpacity onPress={onClear}>
          <Icon name="close-circle" size={20} color={colors.muted} />
        </TouchableOpacity>
      )}
    </ReAnimated.View>
  );
}

// ── Search results list ─────────────────────────────────────────────────
export function SearchResultsList({ results, searchQ, user, otherUser, colors, bottomPadding, onSelect }: {
  results: ChatMessage[]; searchQ: string; user: any; otherUser: any; colors: any;
  bottomPadding: number; onSelect: (msg: ChatMessage) => void;
}) {
  return (
    <FlatList
      data={results}
      keyExtractor={m => m.id}
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 16, paddingBottom: bottomPadding + 20 }}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={[s.searchResult, { backgroundColor: colors.card }]}
          onPress={() => onSelect(item)}
        >
          <Text style={[s.searchResultSender, { color: item.sender_id === user.id ? PINK : colors.text }]}>
            {item.sender_id === user.id ? 'You' : otherUser.username}
          </Text>
          <Text style={[s.searchResultText, { color: colors.text }]} numberOfLines={2}>
            {item.text || 'Media message'}
          </Text>
          <Text style={[s.searchResultTime, { color: colors.muted }]}>
            {fmtTime(item.created_at)}
          </Text>
        </TouchableOpacity>
      )}
      ListEmptyComponent={
        <View style={s.searchEmpty}>
          <Icon name="search" size={48} color={colors.muted} />
          <Text style={[s.searchEmptyText, { color: colors.muted }]}>
            {searchQ ? 'No messages found' : 'Type to search messages'}
          </Text>
        </View>
      }
    />
  );
}

// ── Starred messages drawer ─────────────────────────────────────────────
export function StarredDrawer({ starredMessages, colors, onClose, onSelect }: {
  starredMessages: ChatMessage[]; colors: any; onClose: () => void; onSelect: (msg: ChatMessage) => void;
}) {
  return (
    <ReAnimated.View
      entering={SlideInRight.duration(300)}
      exiting={SlideOutLeft.duration(300)}
      style={[s.starredDrawer, { backgroundColor: colors.card }]}
    >
      <View style={s.starredHeader}>
        <Text style={[s.starredTitle, { color: colors.text }]}>⭐ Starred Messages</Text>
        <TouchableOpacity onPress={onClose}>
          <Icon name="close" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>
      <FlatList
        data={starredMessages}
        keyExtractor={m => m.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[s.starredItem, { borderBottomColor: colors.border }]}
            onPress={() => onSelect(item)}
          >
            <Text style={[s.starredMsg, { color: colors.text }]} numberOfLines={2}>
              {item.text || 'Media message'}
            </Text>
            <Text style={[s.starredTime, { color: colors.muted }]}>
              {fmtTime(item.created_at)}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={[s.starredEmpty, { color: colors.muted }]}>
            No starred messages yet
          </Text>
        }
      />
    </ReAnimated.View>
  );
}

// ── Scroll-to-bottom FAB ──────────────────────────────────────────────────
export function ScrollFab({ onPress }: { onPress: () => void }) {
  return (
    <ReAnimated.View entering={ZoomIn.duration(300)} exiting={ZoomOut.duration(300)} style={s.scrollFab}>
      <TouchableOpacity onPress={onPress} style={s.scrollFabTouch}>
        <LinearGradient colors={GRADIENT} style={s.scrollFabGrad}>
          <Icon name="chevron-down" size={24} color={WHITE} />
        </LinearGradient>
      </TouchableOpacity>
    </ReAnimated.View>
  );
}

// ── Starred-messages button ──────────────────────────────────────────────
export function StarredButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={s.starredBtn} onPress={onPress}>
      <Icon name="star" size={22} color="#F59E0B" />
    </TouchableOpacity>
  );
}
