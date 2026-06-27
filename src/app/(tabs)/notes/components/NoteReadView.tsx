// components/NoteReadView.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, ImageBackground, Platform } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NOTE_THEMES, MOOD_OPTIONS, STICKER_OPTIONS, WHITE, TEXT_MID } from '../utils/constants';
import { smartDate, wordCount } from '../utils/helpers';
import { VoicePlayer } from './VoicePlayer';

interface NoteReadViewProps {
  note: any;
  onClose: () => void;
  onEdit: () => void;
  onShare: () => void;
  colors: any;
}

export function NoteReadView({ note, onClose, onEdit, onShare, colors }: NoteReadViewProps) {
  const theme = NOTE_THEMES[note.themeIndex ?? 0];
  const mood = note.moodIndex != null ? MOOD_OPTIONS[note.moodIndex] : null;
  const sticker = note.stickerIndex != null ? STICKER_OPTIONS[note.stickerIndex] : null;

  const Content = (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <View style={[styles.topBar, { marginTop: Platform.OS === 'ios' ? 0 : 8 }]}>
        <TouchableOpacity onPress={onClose} style={[styles.btn, { backgroundColor: colors.card }]}>
          <Icon name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.topRight}>
          {sticker && <MCIcon name={sticker.name} size={24} color={sticker.color} />}
          <TouchableOpacity onPress={onShare} style={[styles.btn, { backgroundColor: colors.card }]}>
            <Icon name="share-outline" size={19} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onEdit} style={[styles.saveBtn, { backgroundColor: theme.accent }]}>
            <Icon name="pencil" size={15} color={WHITE} />
            <Text style={styles.saveTxt}>Edit</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {note.title ? <Text style={[styles.title, { color: theme.accent }]}>{note.title}</Text> : null}

        <View style={styles.metaRow}>
          {mood && <Icon name={mood.icon} size={18} color={mood.color} />}
          {mood && <Text style={[styles.metaTxt, { color: mood.color }]}>{mood.label}</Text>}
          <Text style={[styles.metaTxt, { color: colors.text }]}>{smartDate(note.updatedAt ?? note.createdAt)}</Text>
        </View>

        <View style={styles.chipRow}>
          {note.place ? (
            <View style={[styles.chip, { backgroundColor: theme.accent + '22' }]}>
              <Icon name="location-outline" size={12} color={theme.accent} />
              <Text style={[styles.chipText, { color: theme.accent }]}>{note.place}</Text>
            </View>
          ) : null}
          {note.event ? (
            <View style={[styles.chip, { backgroundColor: theme.accent + '22' }]}>
              <Icon name="calendar-outline" size={12} color={theme.accent} />
              <Text style={[styles.chipText, { color: theme.accent }]}>{note.event}</Text>
            </View>
          ) : null}
          {(note.tags ?? []).map((tag: string) => (
            <View key={tag} style={[styles.chip, { backgroundColor: theme.accent + '22' }]}>
              <Icon name="pricetag-outline" size={12} color={theme.accent} />
              <Text style={[styles.chipText, { color: theme.accent }]}>{tag}</Text>
            </View>
          ))}
        </View>

        {note.photoUri && <Image source={{ uri: note.photoUri }} style={styles.photo} resizeMode="cover" />}

        {note.voiceNote && (
          <View style={[styles.voiceContainer, { borderColor: theme.accent + '44', backgroundColor: colors.card }]}>
            <View style={styles.voiceLabelRow}>
              <Icon name="mic-outline" size={16} color={TEXT_MID} />
              <Text style={[styles.voiceLabel, { color: colors.text }]}>Voice Note</Text>
            </View>
            <VoicePlayer voiceNote={note.voiceNote} themeAccent={theme.accent} colors={colors} />
          </View>
        )}

        <Text style={[styles.body, { color: colors.text }]}>{note.text}</Text>
        <Text style={[styles.wordCount, { color: colors.text }]}>{wordCount(note.text)} words</Text>
      </ScrollView>
    </SafeAreaView>
  );

  if (note.bgPhotoUri) {
    return (
      <View style={StyleSheet.absoluteFillObject}>
        <ImageBackground source={{ uri: note.bgPhotoUri }} style={{ flex: 1 }} imageStyle={{ opacity: 0.3 }}>
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.background + 'CC' }]} />
          {Content}
        </ImageBackground>
      </View>
    );
  }

  return <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.background }]}>{Content}</View>;
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  btn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20 },
  saveTxt: { color: WHITE, fontWeight: '800', fontSize: 14 },
  scroll: { paddingHorizontal: 24, paddingBottom: 60 },
  title: { fontSize: 28, fontWeight: '900', marginBottom: 10, lineHeight: 34 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  metaTxt: { fontSize: 13, fontWeight: '600' },
  chipRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  chipText: { fontSize: 11, fontWeight: '700' },
  photo: { width: '100%', height: 200, borderRadius: 20, marginBottom: 20 },
  voiceContainer: { borderWidth: 1.5, borderRadius: 16, padding: 12, marginBottom: 20 },
  voiceLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  voiceLabel: { fontSize: 12, fontWeight: '700' },
  body: { fontSize: 17, lineHeight: 28, marginBottom: 16 },
  wordCount: { fontSize: 12, marginBottom: 20 },
});
