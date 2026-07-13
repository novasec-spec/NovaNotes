// src/app/(tabs)/faith/praise.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  RefreshControl,
  Alert,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../contexts/ThemeContext';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FaithApiService } from './services/faithApi';

interface PraiseReport {
  id: string;
  title: string;
  description: string;
  date: string;
  category: 'answered-prayer' | 'blessing' | 'testimony' | 'miracle' | 'healing' | 'provision';
  mood: string;
  song?: string;
}

interface WorshipSong {
  id: string;
  title: string;
  artist: string;
  lyrics: string;
  chords?: string;
}

const PRAISE_CATEGORIES = [
  { key: 'all', label: 'All', icon: 'apps' },
  { key: 'answered-prayer', label: 'Answered Prayer', icon: 'hands-pray' },
  { key: 'blessing', label: 'Blessing', icon: 'star' },
  { key: 'testimony', label: 'Testimony', icon: 'message-text' },
  { key: 'miracle', label: 'Miracle', icon: 'lightning-bolt' },
  { key: 'healing', label: 'Healing', icon: 'heart-pulse' },
  { key: 'provision', label: 'Provision', icon: 'food' },
];

const PRAISE_MOODS = [
  { emoji: '🎉', label: 'Celebrating' },
  { emoji: '🙏', label: 'Grateful' },
  { emoji: '😊', label: 'Joyful' },
  { emoji: '🥹', label: 'Overwhelmed' },
  { emoji: '💪', label: 'Strengthened' },
  { emoji: '❤️', label: 'Loved' },
];

export default function PraiseScreen() {
  const { colors, isDarkMode } = useTheme();
  const [praises, setPraises] = useState<PraiseReport[]>([]);
  const [worshipSongs, setWorshipSongs] = useState<WorshipSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [editingPraise, setEditingPraise] = useState<PraiseReport | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'answered-prayer' as PraiseReport['category'],
    mood: '😊',
    song: '',
  });
  const [showLyricsModal, setShowLyricsModal] = useState(false);
  const [selectedSong, setSelectedSong] = useState<WorshipSong | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load praises
      const saved = await AsyncStorage.getItem('faith_praises');
      if (saved) {
        setPraises(JSON.parse(saved));
      } else {
        // Add sample praises
        const sample: PraiseReport[] = [
          {
            id: Date.now().toString(),
            title: 'Healing of my grandmother',
            description: 'God healed my grandmother from a serious illness. The doctors were amazed!',
            date: new Date().toISOString(),
            category: 'healing',
            mood: '🎉',
          },
          {
            id: (Date.now() + 1).toString(),
            title: 'Job provision',
            description: 'After months of praying, I got a job that perfectly fits my skills and schedule.',
            date: new Date().toISOString(),
            category: 'provision',
            mood: '🙏',
          },
        ];
        setPraises(sample);
        await AsyncStorage.setItem('faith_praises', JSON.stringify(sample));
      }

      // Load worship songs from API
      const songs = await FaithApiService.getWorshipSongs();
      if (songs) {
        setWorshipSongs(songs);
      }
    } catch (error) {
      console.error('Error loading praise data:', error);
    } finally {
      setLoading(false);
    }
  };

  const savePraises = async (newPraises: PraiseReport[]) => {
    setPraises(newPraises);
    await AsyncStorage.setItem('faith_praises', JSON.stringify(newPraises));
  };

  const addPraise = () => {
    if (!formData.title.trim() || !formData.description.trim()) {
      Alert.alert('Error', 'Please enter both title and description');
      return;
    }

    const newPraise: PraiseReport = {
      id: Date.now().toString(),
      title: formData.title.trim(),
      description: formData.description.trim(),
      date: new Date().toISOString(),
      category: formData.category,
      mood: formData.mood,
      song: formData.song.trim() || undefined,
    };

    savePraises([newPraise, ...praises]);
    resetForm();
    setShowModal(false);
  };

  const deletePraise = (id: string) => {
    Alert.alert('Delete Praise', 'Are you sure you want to delete this praise report?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => savePraises(praises.filter(p => p.id !== id)) },
    ]);
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      category: 'answered-prayer',
      mood: '😊',
      song: '',
    });
    setEditingPraise(null);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const getMoodEmoji = (mood: string) => {
    const found = PRAISE_MOODS.find(m => m.emoji === mood);
    return found ? found.emoji : '😊';
  };

  const filteredPraises = praises.filter(
    p => selectedCategory === 'all' || p.category === selectedCategory
  );

  const renderPraiseCard = ({ item }: { item: PraiseReport }) => (
    <View style={[styles.praiseCard, { backgroundColor: colors.card }]}>
      <View style={styles.praiseHeader}>
        <View style={styles.praiseTitleContainer}>
          <Text style={styles.praiseMood}>{getMoodEmoji(item.mood)}</Text>
          <Text style={[styles.praiseTitle, { color: colors.text }]}>{item.title}</Text>
        </View>
        <View style={styles.praiseActions}>
          <TouchableOpacity onPress={() => deletePraise(item.id)}>
            <Icon name="trash-outline" size={18} color={colors.muted} />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={[styles.praiseDesc, { color: colors.muted }]}>{item.description}</Text>

      <View style={styles.praiseFooter}>
        <View style={[styles.praiseBadge, { backgroundColor: '#22C55E20' }]}>
          <Text style={[styles.praiseBadgeText, { color: '#22C55E' }]}>
            {item.category.replace('-', ' ')}
          </Text>
        </View>
        <Text style={[styles.praiseDate, { color: colors.muted }]}>
          {new Date(item.date).toLocaleDateString()}
        </Text>
      </View>

      {item.song && (
        <TouchableOpacity
          style={[styles.songButton, { backgroundColor: '#8B5CF610', borderColor: '#8B5CF6' }]}
          onPress={() => {
            const song = worshipSongs.find(s => s.title.toLowerCase().includes(item.song!.toLowerCase()));
            if (song) {
              setSelectedSong(song);
              setShowLyricsModal(true);
            } else {
              Alert.alert('🎵 Song', item.song);
            }
          }}
        >
          <Icon name="musical-notes" size={16} color="#8B5CF6" />
          <Text style={[styles.songButtonText, { color: '#8B5CF6' }]}>🎵 {item.song}</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Icon name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>✨ Praise Reports</Text>
        <TouchableOpacity
          onPress={() => {
            resetForm();
            setShowModal(true);
          }}
          style={[styles.addBtn, { backgroundColor: '#22C55E' }]}
        >
          <Icon name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Categories */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
        {PRAISE_CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.key}
            style={[
              styles.categoryChip,
              selectedCategory === cat.key && styles.categoryChipActive,
              { backgroundColor: selectedCategory === cat.key ? '#22C55E' : colors.border },
            ]}
            onPress={() => setSelectedCategory(cat.key)}
          >
            <MaterialCommunityIcons
              name={cat.icon}
              size={14}
              color={selectedCategory === cat.key ? '#fff' : colors.muted}
            />
            <Text
              style={[
                styles.categoryChipText,
                { color: selectedCategory === cat.key ? '#fff' : colors.muted },
              ]}
            >
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Praise List */}
      <FlatList
        data={filteredPraises}
        keyExtractor={item => item.id}
        renderItem={renderPraiseCard}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22C55E" />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="star" size={48} color={colors.muted} />
            <Text style={[styles.emptyText, { color: colors.text }]}>No praise reports yet</Text>
            <Text style={[styles.emptySub, { color: colors.muted }]}>
              Share what God has done in your life
            </Text>
          </View>
        }
      />

      {/* Add Praise Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editingPraise ? 'Edit Praise' : 'New Praise Report'}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Icon name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.modalInput, { color: colors.text, borderColor: colors.border }]}
              placeholder="Praise title *"
              placeholderTextColor={colors.muted}
              value={formData.title}
              onChangeText={text => setFormData({ ...formData, title: text })}
            />

            <TextInput
              style={[styles.modalInput, styles.modalTextArea, { color: colors.text, borderColor: colors.border }]}
              placeholder="What did God do? *"
              placeholderTextColor={colors.muted}
              value={formData.description}
              onChangeText={text => setFormData({ ...formData, description: text })}
              multiline
            />

            <TextInput
              style={[styles.modalInput, { color: colors.text, borderColor: colors.border }]}
              placeholder="Song related to this praise (optional)"
              placeholderTextColor={colors.muted}
              value={formData.song}
              onChangeText={text => setFormData({ ...formData, song: text })}
            />

            <View style={styles.moodContainer}>
              <Text style={[styles.moodLabel, { color: colors.muted }]}>How are you feeling?</Text>
              <View style={styles.moodRow}>
                {PRAISE_MOODS.map((mood) => (
                  <TouchableOpacity
                    key={mood.label}
                    style={[
                      styles.moodOption,
                      formData.mood === mood.emoji && styles.moodOptionActive,
                      { borderColor: formData.mood === mood.emoji ? '#22C55E' : colors.border },
                    ]}
                    onPress={() => setFormData({ ...formData, mood: mood.emoji })}
                  >
                    <Text style={styles.moodEmoji}>{mood.emoji}</Text>
                    <Text
                      style={[
                        styles.moodLabelText,
                        { color: formData.mood === mood.emoji ? '#22C55E' : colors.muted },
                      ]}
                    >
                      {mood.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.categorySelector}>
              <Text style={[styles.categoryLabel, { color: colors.muted }]}>Category:</Text>
              <View style={styles.categoryOptions}>
                {PRAISE_CATEGORIES.filter(c => c.key !== 'all').map(cat => (
                  <TouchableOpacity
                    key={cat.key}
                    style={[
                      styles.categoryOption,
                      formData.category === cat.key && styles.categoryOptionActive,
                      { borderColor: formData.category === cat.key ? '#22C55E' : colors.border },
                    ]}
                    onPress={() => setFormData({ ...formData, category: cat.key as any })}
                  >
                    <Text
                      style={[
                        styles.categoryOptionText,
                        { color: formData.category === cat.key ? '#22C55E' : colors.muted },
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: '#22C55E' }]}
              onPress={addPraise}
            >
              <Text style={styles.saveBtnText}>Share Praise 🎉</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Lyrics Modal */}
      <Modal visible={showLyricsModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.lyricsModalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {selectedSong?.title || 'Song Lyrics'}
              </Text>
              <TouchableOpacity onPress={() => setShowLyricsModal(false)}>
                <Icon name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {selectedSong?.artist && (
                <Text style={[styles.lyricsArtist, { color: colors.muted }]}>
                  {selectedSong.artist}
                </Text>
              )}
              <Text style={[styles.lyricsText, { color: colors.text }]}>
                {selectedSong?.lyrics || 'Lyrics not available'}
              </Text>
              {selectedSong?.chords && (
                <View style={[styles.chordsContainer, { backgroundColor: colors.background }]}>
                  <Text style={[styles.chordsTitle, { color: colors.muted }]}>🎸 Chords</Text>
                  <Text style={[styles.chordsText, { color: colors.text }]}>
                    {selectedSong.chords}
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Categories
  categoryScroll: { paddingHorizontal: 16, paddingVertical: 12 },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  categoryChipActive: { backgroundColor: '#22C55E' },
  categoryChipText: { fontSize: 12, fontWeight: '600' },

  // Praise Card
  praiseCard: {
    padding: 16,
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  praiseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  praiseTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  praiseMood: { fontSize: 20 },
  praiseTitle: { fontSize: 15, fontWeight: '600', flex: 1 },
  praiseActions: { flexDirection: 'row', gap: 12 },
  praiseDesc: { fontSize: 14, marginTop: 4, marginBottom: 10, lineHeight: 20 },
  praiseFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  praiseBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  praiseBadgeText: { fontSize: 10, fontWeight: '600', textTransform: 'capitalize' },
  praiseDate: { fontSize: 11, opacity: 0.6 },

  // Song Button
  songButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  songButtonText: { fontSize: 13, fontWeight: '500' },

  // List
  listContent: { paddingBottom: 20 },
  emptyContainer: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptySub: { fontSize: 14, marginTop: 4, opacity: 0.6 },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: '700' },
  modalInput: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 14,
    marginBottom: 12,
  },
  modalTextArea: { height: 80, textAlignVertical: 'top' },

  // Mood
  moodContainer: { marginBottom: 16 },
  moodLabel: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  moodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  moodOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  moodOptionActive: { backgroundColor: '#22C55E10' },
  moodEmoji: { fontSize: 16 },
  moodLabelText: { fontSize: 12, fontWeight: '500' },

  // Category
  categorySelector: { marginBottom: 16 },
  categoryLabel: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  categoryOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryOption: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  categoryOptionActive: { backgroundColor: '#22C55E10' },
  categoryOptionText: { fontSize: 12, fontWeight: '500' },

  saveBtn: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  // Lyrics Modal
  lyricsModalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  lyricsArtist: { fontSize: 14, marginBottom: 12 },
  lyricsText: { fontSize: 16, lineHeight: 28 },
  chordsContainer: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
  },
  chordsTitle: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  chordsText: { fontSize: 14, fontFamily: 'monospace', lineHeight: 24 },
});
