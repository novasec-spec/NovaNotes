// components/NoteCard.tsx
import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Image,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Note } from '../types';
import { NOTE_THEMES, MOOD_OPTIONS, STICKER_OPTIONS, WHITE, DANGER, WARNING, TEXT_MID } from '../utils/constants';
import { smartDate, getReadTime } from '../utils/helpers';
import { VoicePlayer } from './VoicePlayer';

interface NoteCardProps {
  item: Note;
  index: number;
  onEdit: (note: Note) => void;
  onDelete: (id: string) => void;
  onPin: (id: string) => void;
  onFav: (id: string) => void;
  onArchive: (id: string) => void;
  onReminder: (note: Note) => void;
  onRead: (note: Note) => void;
  onShare: (note: Note) => void;
  onQuickAction?: (id: string, action: string) => void;
  colors: any;
}

export function NoteCard({
  item,
  index,
  onEdit,
  onDelete,
  onPin,
  onFav,
  onArchive,
  onReminder,
  onRead,
  onShare,
  onQuickAction,
  colors,
}: NoteCardProps) {
  const slideAnim = useRef(new Animated.Value(50)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 360, delay: Math.min(index * 55, 400), useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 360, delay: Math.min(index * 55, 400), useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 7, tension: 80, delay: Math.min(index * 55, 400), useNativeDriver: true }),
    ]).start();
  }, []);

  const theme = NOTE_THEMES[item.themeIndex ?? 0];
  const mood = item.moodIndex != null ? MOOD_OPTIONS[item.moodIndex] : null;
  const sticker = item.stickerIndex != null ? STICKER_OPTIONS[item.stickerIndex] : null;
  const hasVoiceNote = item.voiceNote?.uri;
  const readTime = item.readTime || getReadTime(item.text);

  const handleLongPress = () => {
    Alert.alert(
      'Note Actions',
      `"${item.title || 'Untitled'}"`,
      [
        { text: '📌 Pin', onPress: () => { onPin(item.id); onQuickAction?.(item.id, 'pin'); } },
        { text: '❤️ Favorite', onPress: () => { onFav(item.id); onQuickAction?.(item.id, 'heart'); } },
        { text: '📦 Archive', onPress: () => { onArchive(item.id); onQuickAction?.(item.id, 'archive'); } },
        { text: '📤 Share', onPress: () => onShare(item) },
        { text: '🗑️ Delete', style: 'destructive', onPress: () => { onDelete(item.id); onQuickAction?.(item.id, 'trash'); } },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const CardInner = (
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: theme.accent + '55',
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
        },
      ]}>
      {item.pinned && (
        <View style={[styles.pinBadge, { backgroundColor: theme.accent }]}>
          <Icon name="pin" size={11} color={WHITE} />
        </View>
      )}

      <View style={styles.topRightWrap}>
        {!item._synced && <View style={[styles.syncDot, { backgroundColor: WARNING }]} />}
        {sticker && <MCIcon name={sticker.name} size={22} color={sticker.color} />}
      </View>

      {item.title ? (
        <Text style={[styles.title, { color: theme.accent }]} numberOfLines={1}>{item.title}</Text>
      ) : null}

      <Text style={[styles.text, { color: colors.text }]} numberOfLines={3}>{item.text}</Text>

      <View style={styles.readTimeBadge}>
        <Icon name="time-outline" size={12} color={TEXT_MID} />
        <Text style={[styles.readTimeText, { color: TEXT_MID }]}>{readTime} min read</Text>
      </View>

      {item.photoUri && (
        <Image source={{ uri: item.photoUri }} style={styles.photoThumb} resizeMode="cover" />
      )}

      {hasVoiceNote && (
        <VoicePlayer voiceNote={item.voiceNote} themeAccent={theme.accent} colors={colors} />
      )}

      {item.hasDoodle && (
        <View style={[styles.doodleBadge, { backgroundColor: theme.accent + '22' }]}>
          <MCIcon name="brush" size={12} color={theme.accent} />
          <Text style={[styles.doodleBadgeText, { color: theme.accent }]}>Doodle</Text>
        </View>
      )}

      {item.location && (
        <View style={[styles.locationBadge, { backgroundColor: theme.accent + '22' }]}>
          <Icon name="location-outline" size={12} color={theme.accent} />
          <Text style={[styles.locationBadgeText, { color: theme.accent }]} numberOfLines={1}>
            {item.location.placeName || item.location.city || 'Location'}
          </Text>
        </View>
      )}

      {item.weather && (
        <View style={[styles.weatherBadge, { backgroundColor: theme.accent + '22' }]}>
          <Icon name="partly-sunny-outline" size={12} color={theme.accent} />
          <Text style={[styles.weatherBadgeText, { color: theme.accent }]}>
            {Math.round(item.weather.temperature)}°C
          </Text>
        </View>
      )}

      <View style={styles.chipRow}>
        {item.place ? (
          <View style={[styles.chip, { backgroundColor: theme.accent + '18' }]}>
            <Icon name="location-outline" size={11} color={theme.accent} />
            <Text style={[styles.chipText, { color: theme.accent }]}>{item.place}</Text>
          </View>
        ) : null}
        {item.event ? (
          <View style={[styles.chip, { backgroundColor: theme.accent + '18' }]}>
            <Icon name="calendar-outline" size={11} color={theme.accent} />
            <Text style={[styles.chipText, { color: theme.accent }]}>{item.event}</Text>
          </View>
        ) : null}
        {(item.tags ?? []).slice(0, 3).map((tag: string) => (
          <View key={tag} style={[styles.chip, { backgroundColor: theme.accent + '18' }]}>
            <Icon name="pricetag-outline" size={11} color={theme.accent} />
            <Text style={[styles.chipText, { color: theme.accent }]}>{tag}</Text>
          </View>
        ))}
      </View>

      <View style={styles.footer}>
        <View style={styles.meta}>
          {mood && <Icon name={mood.icon} size={16} color={mood.color} />}
          <Text style={[styles.date, { color: colors.text }]}>{smartDate(item.updatedAt ?? item.createdAt)}</Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity onPress={() => onFav(item.id)} style={styles.actionBtn}>
            <Icon name={item.fav ? 'heart' : 'heart-outline'} size={17} color={item.fav ? DANGER : theme.accent} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onReminder(item)} style={styles.actionBtn}>
            <Icon name="alarm-outline" size={17} color={theme.accent} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onPin(item.id)} style={styles.actionBtn}>
            <Icon name={item.pinned ? 'pin' : 'pin-outline'} size={17} color={theme.accent} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onArchive(item.id)} style={styles.actionBtn}>
            <Icon name="archive-outline" size={17} color={theme.accent} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onEdit(item)} style={styles.actionBtn}>
            <Icon name="pencil" size={17} color={theme.accent} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onDelete(item.id)} style={styles.actionBtn}>
            <Icon name="trash-outline" size={17} color={theme.accent} />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );

  return (
    <TouchableOpacity activeOpacity={0.92} onPress={() => onRead(item)} onLongPress={handleLongPress} delayLongPress={300}>
      {CardInner}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 22, padding: 16, marginBottom: 14, borderWidth: 1.5, shadowColor: '#FF6B9D', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 12, elevation: 4, position: 'relative' },
  pinBadge: { position: 'absolute', top: -8, right: 14, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3 },
  topRightWrap: { position: 'absolute', top: 12, right: 14, flexDirection: 'row', alignItems: 'center', gap: 6 },
  syncDot: { width: 7, height: 7, borderRadius: 4 },
  title: { fontSize: 16, fontWeight: '800', marginBottom: 4, paddingRight: 32 },
  text: { fontSize: 14, lineHeight: 21, marginBottom: 6, paddingRight: 28 },
  readTimeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  readTimeText: { fontSize: 11, fontWeight: '600' },
  photoThumb: { width: '100%', height: 120, borderRadius: 14, marginBottom: 10 },
  doodleBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, gap: 4, marginBottom: 8 },
  doodleBadgeText: { fontSize: 11, fontWeight: '700' },
  locationBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, gap: 4, marginBottom: 8 },
  locationBadgeText: { fontSize: 11, fontWeight: '700', maxWidth: 120 },
  weatherBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, gap: 4, marginBottom: 8 },
  weatherBadgeText: { fontSize: 11, fontWeight: '700' },
  chipRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  chipText: { fontSize: 11, fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  date: { fontSize: 11 },
  actions: { flexDirection: 'row', gap: 2 },
  actionBtn: { padding: 6 },
});
