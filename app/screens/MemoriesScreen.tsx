// screens/MemoriesScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, FlatList, Image, TouchableOpacity, StyleSheet,
  Modal, TextInput, Alert, ScrollView, Animated, Dimensions,
  KeyboardAvoidingView, Platform, SafeAreaView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';

const { width: W } = Dimensions.get('window');

// ── Design tokens ─────────────────────────────────────────────────────────────
const PINK    = '#FF6B9D';
const BG      = '#FFF5F7';
const WHITE   = '#FFFFFF';
const DARK    = '#2D1B25';
const MID     = '#9A7090';
const SOFT    = '#C4A0B8';

// ── Mood / category config ────────────────────────────────────────────────────
const MOODS = [
  { key: 'love',      label: 'Love',      icon: 'heart',          color: '#EF4444', bg: '#FFF0F0' },
  { key: 'adventure', label: 'Adventure', icon: 'compass',        color: '#F97316', bg: '#FFF4ED' },
  { key: 'happy',     label: 'Happy',     icon: 'sunny',          color: '#F59E0B', bg: '#FFFBEB' },
  { key: 'milestone', label: 'Milestone', icon: 'star',           color: '#A855F7', bg: '#F5F0FF' },
  { key: 'chill',     label: 'Chill',     icon: 'cafe',           color: '#22C55E', bg: '#F0FDF4' },
  { key: 'random',    label: 'Random',    icon: 'sparkles',       color: '#3B82F6', bg: '#EFF6FF' },
] as const;

type MoodKey = typeof MOODS[number]['key'];

function getMood(key?: string) {
  return MOODS.find(m => m.key === key) ?? MOODS[5];
}

// ── Extended Memory interface (backward-compatible) ───────────────────────────
interface Memory {
  id: string;
  uri: string;
  caption: string;
  date: string;
  location?: string;
  // NEW — optional so old saved data still loads fine
  mood?: MoodKey;
  fav?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function isOnThisDay(dateStr: string) {
  const d     = new Date(dateStr);
  const today = new Date();
  return (
    d.getDate()     === today.getDate() &&
    d.getMonth()    === today.getMonth() &&
    d.getFullYear()  <  today.getFullYear()
  );
}

// ── Animated card wrapper ─────────────────────────────────────────────────────
function FadeCard({ index, children }: { index: number; children: React.ReactNode }) {
  const opacity   = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 350, delay: Math.min(index * 55, 450), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 350, delay: Math.min(index * 55, 450), useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
export default function MemoriesScreen() {

  // ── YOUR ORIGINAL STATE ───────────────────────────────────────────────────
  const [memories,         setMemories]         = useState<Memory[]>([]);
  const [selectedMemory,   setSelectedMemory]   = useState<Memory | null>(null);
  const [showCaptionModal, setShowCaptionModal] = useState(false);
  const [tempCaption,      setTempCaption]      = useState('');
  const [newImageUri,      setNewImageUri]      = useState('');

  // ── NEW STATE ─────────────────────────────────────────────────────────────
  const [viewMode,     setViewMode]     = useState<'grid' | 'timeline'>('grid');
  const [search,       setSearch]       = useState('');
  const [showSearch,   setShowSearch]   = useState(false);
  const [filterMood,   setFilterMood]   = useState<string>('all');
  const [filterFav,    setFilterFav]    = useState(false);
  const [tempMood,     setTempMood]     = useState<MoodKey>('random');
  const searchAnim = useRef(new Animated.Value(0)).current;

  // ── YOUR ORIGINAL useEffect ───────────────────────────────────────────────
  useEffect(() => {
    loadMemories();
    requestPermissions();
  }, []);

  // ── YOUR ORIGINAL FUNCTIONS ───────────────────────────────────────────────
  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photos');
    }
  };

  const loadMemories = async () => {
    const saved = await AsyncStorage.getItem('memories');
    if (saved) setMemories(JSON.parse(saved));
  };

  const saveMemories = async (newMemories: Memory[]) => {
    await AsyncStorage.setItem('memories', JSON.stringify(newMemories));
    setMemories(newMemories);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      setNewImageUri(result.assets[0].uri);
      setTempMood('random');
      setShowCaptionModal(true);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera access is required');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      setNewImageUri(result.assets[0].uri);
      setTempMood('random');
      setShowCaptionModal(true);
    }
  };

  // addMemory — original logic + mood attached
  const addMemory = () => {
    if (!tempCaption.trim()) {
      Alert.alert('Caption required', 'Add a sweet caption for this memory');
      return;
    }
    const newMemory: Memory = {
      id:      Date.now().toString(),
      uri:     newImageUri,
      caption: tempCaption,
      date:    new Date().toISOString(),
      mood:    tempMood,
      fav:     false,
    };
    const updated = [newMemory, ...memories];
    saveMemories(updated);
    setShowCaptionModal(false);
    setTempCaption('');
    setNewImageUri('');
    setTempMood('random');
  };

  const deleteMemory = (id: string) => {
    Alert.alert('Delete Memory', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => saveMemories(memories.filter(m => m.id !== id)) },
    ]);
  };

  // ── NEW HELPERS ───────────────────────────────────────────────────────────
  const toggleFav = (id: string) => {
    saveMemories(memories.map(m => m.id === id ? { ...m, fav: !m.fav } : m));
  };

  const toggleSearch = () => {
    const toValue = showSearch ? 0 : 1;
    setShowSearch(!showSearch);
    if (showSearch) setSearch('');
    Animated.spring(searchAnim, { toValue, useNativeDriver: false, friction: 8 }).start();
  };

  const filteredMemories = memories.filter(m => {
    if (filterFav && !m.fav) return false;
    if (filterMood !== 'all' && m.mood !== filterMood) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return m.caption.toLowerCase().includes(q) || (m.location ?? '').toLowerCase().includes(q);
    }
    return true;
  });

  const onThisDayMemories = memories.filter(m => isOnThisDay(m.date));

  const searchBarHeight = searchAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 52] });

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Our Memories</Text>
          <Text style={styles.headerSub}>{memories.length} captured moments</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconBtn} onPress={toggleSearch}>
            <Icon name={showSearch ? 'close' : 'search'} size={20} color={PINK} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtn, filterFav && styles.iconBtnActive]}
            onPress={() => setFilterFav(v => !v)}
          >
            <Icon name={filterFav ? 'heart' : 'heart-outline'} size={20} color={filterFav ? WHITE : PINK} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setViewMode(v => v === 'grid' ? 'timeline' : 'grid')}>
            <Icon name={viewMode === 'grid' ? 'list' : 'grid'} size={20} color={PINK} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Search bar (animated) ── */}
      <Animated.View style={{ height: searchBarHeight, overflow: 'hidden' }}>
        <View style={styles.searchRow}>
          <Icon name="search-outline" size={16} color={SOFT} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search memories..."
            placeholderTextColor={SOFT}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </Animated.View>

      {/* ── Mood filter tabs ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.moodTabsScroll}
        contentContainerStyle={styles.moodTabsContent}
      >
        <TouchableOpacity
          style={[styles.moodTab, filterMood === 'all' && styles.moodTabActive]}
          onPress={() => setFilterMood('all')}
        >
          <Text style={[styles.moodTabTxt, filterMood === 'all' && styles.moodTabTxtActive]}>All</Text>
        </TouchableOpacity>
        {MOODS.map(m => (
          <TouchableOpacity
            key={m.key}
            style={[
              styles.moodTab,
              filterMood === m.key && { backgroundColor: m.color, borderColor: m.color },
            ]}
            onPress={() => setFilterMood(filterMood === m.key ? 'all' : m.key)}
          >
            <Icon name={m.icon as any} size={13} color={filterMood === m.key ? WHITE : m.color} />
            <Text style={[styles.moodTabTxt, filterMood === m.key && styles.moodTabTxtActive]}>
              {m.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── "On this day" banner ── */}
      {onThisDayMemories.length > 0 && (
        <View style={styles.onThisDayBanner}>
          <Icon name="time-outline" size={16} color={PINK} />
          <Text style={styles.onThisDayText}>
            {onThisDayMemories.length === 1
              ? '🌸 On this day last year — a memory awaits!'
              : `🌸 ${onThisDayMemories.length} memories from this day in past years`}
          </Text>
        </View>
      )}

      {/* ── Add buttons ── */}
      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.actionButton} onPress={pickImage}>
          <Icon name="images" size={22} color={WHITE} />
          <Text style={styles.buttonText}>Gallery</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={takePhoto}>
          <Icon name="camera" size={22} color={WHITE} />
          <Text style={styles.buttonText}>Camera</Text>
        </TouchableOpacity>
      </View>

      {/* ── Empty state ── */}
      {filteredMemories.length === 0 && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📷</Text>
          <Text style={styles.emptyTitle}>No memories yet</Text>
          <Text style={styles.emptySub}>Start capturing your special moments</Text>
        </View>
      )}

      {/* ── Grid view ── */}
      {viewMode === 'grid' && (
        <FlatList
          data={filteredMemories}
          keyExtractor={item => item.id}
          numColumns={2}
          columnWrapperStyle={styles.row}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => {
            const mood = getMood(item.mood);
            const onTD = isOnThisDay(item.date);
            return (
              <FadeCard index={index}>
                <TouchableOpacity
                  style={[styles.memoryCard, { borderColor: mood.color + '55' }]}
                  onPress={() => setSelectedMemory(item)}
                  onLongPress={() => deleteMemory(item.id)}
                  activeOpacity={0.9}
                >
                  <Image source={{ uri: item.uri }} style={styles.memoryImage} />

                  {/* On this day ribbon */}
                  {onTD && (
                    <View style={[styles.ribbon, { backgroundColor: mood.color }]}>
                      <Text style={styles.ribbonTxt}>On this day</Text>
                    </View>
                  )}

                  {/* Mood pill */}
                  <View style={[styles.moodPill, { backgroundColor: mood.color }]}>
                    <Icon name={mood.icon as any} size={11} color={WHITE} />
                  </View>

                  {/* Fav button */}
                  <TouchableOpacity style={styles.favBtn} onPress={() => toggleFav(item.id)}>
                    <Icon
                      name={item.fav ? 'heart' : 'heart-outline'}
                      size={18}
                      color={item.fav ? '#EF4444' : WHITE}
                    />
                  </TouchableOpacity>

                  {/* Caption */}
                  <View style={[styles.captionOverlay, { borderTopColor: mood.color + '88' }]}>
                    <Text style={styles.captionText} numberOfLines={2}>{item.caption}</Text>
                    <Text style={styles.dateText}>{formatDate(item.date)}</Text>
                  </View>
                </TouchableOpacity>
              </FadeCard>
            );
          }}
        />
      )}

      {/* ── Timeline view ── */}
      {viewMode === 'timeline' && (
        <FlatList
          data={filteredMemories}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => {
            const mood = getMood(item.mood);
            const onTD = isOnThisDay(item.date);
            return (
              <FadeCard index={index}>
                <View style={styles.timelineRow}>
                  {/* Spine */}
                  <View style={styles.spineCol}>
                    <View style={[styles.spineDot, { backgroundColor: mood.color }]} />
                    {index < filteredMemories.length - 1 && (
                      <View style={[styles.spineLine, { backgroundColor: mood.color + '44' }]} />
                    )}
                  </View>

                  {/* Card */}
                  <TouchableOpacity
                    style={[styles.timelineCard, { borderLeftColor: mood.color }]}
                    onPress={() => setSelectedMemory(item)}
                    onLongPress={() => deleteMemory(item.id)}
                    activeOpacity={0.9}
                  >
                    <Image source={{ uri: item.uri }} style={styles.timelineImage} />
                    <View style={styles.timelineInfo}>
                      {/* Mood label */}
                      <View style={[styles.timelineMoodBadge, { backgroundColor: mood.bg }]}>
                        <Icon name={mood.icon as any} size={12} color={mood.color} />
                        <Text style={[styles.timelineMoodTxt, { color: mood.color }]}>{mood.label}</Text>
                      </View>
                      <Text style={styles.timelineCaption} numberOfLines={3}>{item.caption}</Text>
                      <View style={styles.timelineBottom}>
                        <Text style={styles.timelineDate}>{formatDate(item.date)}</Text>
                        {onTD && (
                          <View style={[styles.onThisDayBadge, { backgroundColor: mood.color + '22' }]}>
                            <Text style={[styles.onThisDayBadgeTxt, { color: mood.color }]}>On this day</Text>
                          </View>
                        )}
                        <TouchableOpacity onPress={() => toggleFav(item.id)} style={{ marginLeft: 'auto' }}>
                          <Icon
                            name={item.fav ? 'heart' : 'heart-outline'}
                            size={16}
                            color={item.fav ? '#EF4444' : SOFT}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </TouchableOpacity>
                </View>
              </FadeCard>
            );
          }}
        />
      )}

      {/* ── Full-screen viewer modal — YOUR ORIGINAL LOGIC ── */}
      <Modal visible={!!selectedMemory} transparent animationType="fade">
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.modalClose} onPress={() => setSelectedMemory(null)}>
            <Icon name="close-circle" size={40} color={WHITE} />
          </TouchableOpacity>
          {selectedMemory && (() => {
            const mood = getMood(selectedMemory.mood);
            return (
              <View style={styles.modalContent}>
                <Image source={{ uri: selectedMemory.uri }} style={styles.fullImage} />
                {/* Mood badge in viewer */}
                <View style={[styles.viewerMoodBadge, { backgroundColor: mood.color }]}>
                  <Icon name={mood.icon as any} size={14} color={WHITE} />
                  <Text style={styles.viewerMoodTxt}>{mood.label}</Text>
                </View>
                <Text style={styles.modalCaption}>{selectedMemory.caption}</Text>
                <Text style={styles.modalDate}>{formatDate(selectedMemory.date)}</Text>
                {isOnThisDay(selectedMemory.date) && (
                  <Text style={[styles.modalDate, { color: mood.color, marginTop: 4 }]}>
                    🌸 On this day last year
                  </Text>
                )}
                <TouchableOpacity
                  style={styles.modalFavBtn}
                  onPress={() => {
                    toggleFav(selectedMemory.id);
                    setSelectedMemory(prev => prev ? { ...prev, fav: !prev.fav } : null);
                  }}
                >
                  <Icon
                    name={selectedMemory.fav ? 'heart' : 'heart-outline'}
                    size={22}
                    color={selectedMemory.fav ? '#EF4444' : WHITE}
                  />
                  <Text style={styles.modalFavTxt}>
                    {selectedMemory.fav ? 'Unfavourite' : 'Add to favourites'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })()}
        </View>
      </Modal>

      {/* ── Caption modal — YOUR ORIGINAL LOGIC + mood picker ── */}
      <Modal visible={showCaptionModal} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.captionModal}>
            <View style={styles.sheetHandle} />
            {!!newImageUri && (
              <Image source={{ uri: newImageUri }} style={styles.captionPreview} resizeMode="cover" />
            )}
            <Text style={styles.captionTitle}>Add a Memory Caption</Text>

            {/* YOUR ORIGINAL TextInput */}
            <TextInput
              style={styles.captionInput}
              placeholder="What happened on this day? ✨"
              placeholderTextColor={SOFT}
              value={tempCaption}
              onChangeText={setTempCaption}
              multiline
              maxLength={200}
            />

            {/* NEW — Mood selector */}
            <Text style={styles.moodSelectorLabel}>How did it feel?</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 16 }}
              contentContainerStyle={{ gap: 8, paddingRight: 4 }}
            >
              {MOODS.map(m => (
                <TouchableOpacity
                  key={m.key}
                  onPress={() => setTempMood(m.key)}
                  style={[
                    styles.moodSelectBtn,
                    { backgroundColor: m.bg, borderColor: tempMood === m.key ? m.color : 'transparent' },
                  ]}
                >
                  <Icon name={m.icon as any} size={16} color={m.color} />
                  <Text style={[styles.moodSelectTxt, { color: m.color }]}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* YOUR ORIGINAL buttons */}
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setShowCaptionModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={addMemory}>
                <Text style={styles.saveText}>Save Memory</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const CARD_W = (W - 48) / 2;

const styles = StyleSheet.create({
  container:         { flex: 1, backgroundColor: BG, paddingTop: Platform.OS === 'android' ? 10 : 0 },

  // Header
  header:            { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle:       { fontSize: 22, fontWeight: '800', color: DARK, letterSpacing: -0.5 },
  headerSub:         { fontSize: 12, color: MID, marginTop: 2 },
  headerActions:     { flexDirection: 'row', gap: 6 },
  iconBtn:           { width: 36, height: 36, borderRadius: 18, backgroundColor: WHITE, justifyContent: 'center', alignItems: 'center', elevation: 2, shadowColor: PINK, shadowOpacity: 0.15, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  iconBtnActive:     { backgroundColor: PINK },

  // Search
  searchRow:         { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 4, backgroundColor: WHITE, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, elevation: 1 },
  searchInput:       { flex: 1, fontSize: 14, color: DARK, padding: 0 },

  // Mood filter tabs
  moodTabsScroll:    { flexGrow: 0, marginBottom: 4 },
  moodTabsContent:   { paddingHorizontal: 16, gap: 8, paddingVertical: 8 },
  moodTab:           { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: WHITE, borderWidth: 1.5, borderColor: '#EDD8E8' },
  moodTabActive:     { backgroundColor: PINK, borderColor: PINK },
  moodTabTxt:        { fontSize: 12, fontWeight: '600', color: MID },
  moodTabTxtActive:  { color: WHITE },

  // On this day banner
  onThisDayBanner:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 10, backgroundColor: '#FFF0F7', borderRadius: 12, padding: 12, borderLeftWidth: 3, borderLeftColor: PINK },
  onThisDayText:     { flex: 1, fontSize: 13, color: PINK, fontWeight: '600' },

  // Add buttons — YOUR ORIGINAL style
  buttonRow:         { flexDirection: 'row', justifyContent: 'space-around', marginHorizontal: 16, marginBottom: 14 },
  actionButton:      { flexDirection: 'row', backgroundColor: PINK, padding: 12, borderRadius: 25, alignItems: 'center', gap: 8, paddingHorizontal: 20, elevation: 3, shadowColor: PINK, shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  buttonText:        { color: WHITE, fontWeight: '700', fontSize: 14 },

  // Empty
  emptyState:        { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 80 },
  emptyIcon:         { fontSize: 48, marginBottom: 12 },
  emptyTitle:        { fontSize: 18, fontWeight: '700', color: DARK },
  emptySub:          { fontSize: 14, color: MID, marginTop: 6 },

  // Grid card
  row:               { justifyContent: 'space-between', paddingHorizontal: 16 },
  memoryCard:        { width: CARD_W, marginBottom: 14, borderRadius: 18, overflow: 'hidden', backgroundColor: WHITE, elevation: 3, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, borderWidth: 1.5 },
  memoryImage:       { width: '100%', height: 180 },
  ribbon:            { position: 'absolute', top: 10, left: 0, paddingHorizontal: 8, paddingVertical: 3, borderTopRightRadius: 8, borderBottomRightRadius: 8 },
  ribbonTxt:         { color: WHITE, fontSize: 9, fontWeight: '700' },
  moodPill:          { position: 'absolute', top: 10, right: 36, width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  favBtn:            { position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center' },
  captionOverlay:    { padding: 10, backgroundColor: 'rgba(0,0,0,0.68)', borderTopWidth: 2 },
  captionText:       { color: WHITE, fontSize: 12, fontWeight: '500' },
  dateText:          { color: PINK, fontSize: 10, marginTop: 3 },

  // Timeline
  timelineRow:       { flexDirection: 'row', marginHorizontal: 16, marginBottom: 16 },
  spineCol:          { width: 24, alignItems: 'center', paddingTop: 14 },
  spineDot:          { width: 12, height: 12, borderRadius: 6, zIndex: 1 },
  spineLine:         { width: 2, flex: 1, marginTop: 4 },
  timelineCard:      { flex: 1, marginLeft: 10, borderRadius: 16, overflow: 'hidden', backgroundColor: WHITE, borderLeftWidth: 3, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  timelineImage:     { width: '100%', height: 140 },
  timelineInfo:      { padding: 12 },
  timelineMoodBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginBottom: 8 },
  timelineMoodTxt:   { fontSize: 11, fontWeight: '700' },
  timelineCaption:   { fontSize: 13, color: DARK, fontWeight: '500', lineHeight: 18 },
  timelineBottom:    { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 8 },
  timelineDate:      { fontSize: 11, color: MID },
  onThisDayBadge:    { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  onThisDayBadgeTxt: { fontSize: 10, fontWeight: '700' },

  // Viewer modal — YOUR ORIGINAL structure
  modalContainer:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.96)', justifyContent: 'center', alignItems: 'center' },
  modalClose:        { position: 'absolute', top: 50, right: 20, zIndex: 10 },
  modalContent:      { width: '92%', alignItems: 'center' },
  fullImage:         { width: '100%', height: 400, borderRadius: 20 },
  viewerMoodBadge:   { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20, marginTop: 16 },
  viewerMoodTxt:     { color: WHITE, fontSize: 13, fontWeight: '700' },
  modalCaption:      { color: WHITE, fontSize: 18, marginTop: 14, textAlign: 'center', fontWeight: '600' },
  modalDate:         { color: PINK, fontSize: 14, marginTop: 8 },
  modalFavBtn:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18, backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 25 },
  modalFavTxt:       { color: WHITE, fontSize: 14, fontWeight: '600' },

  // Caption modal — YOUR ORIGINAL structure
  captionModal:      { backgroundColor: WHITE, borderRadius: 24, padding: 20, width: '94%', maxHeight: '88%' },
  sheetHandle:       { width: 40, height: 4, backgroundColor: '#EDD8E8', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  captionPreview:    { width: '100%', height: 140, borderRadius: 16, marginBottom: 16 },
  captionTitle:      { fontSize: 20, fontWeight: '800', color: DARK, marginBottom: 14, textAlign: 'center' },
  captionInput:      { borderWidth: 1.5, borderColor: '#EDD8E8', borderRadius: 14, padding: 14, height: 90, textAlignVertical: 'top', fontSize: 15, color: DARK },
  moodSelectorLabel: { fontSize: 14, fontWeight: '700', color: DARK, marginTop: 14, marginBottom: 8 },
  moodSelectBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 2 },
  moodSelectTxt:     { fontSize: 12, fontWeight: '700' },
  modalButtons:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  cancelText:        { color: MID, fontSize: 16 },
  saveBtn:           { backgroundColor: PINK, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 22, elevation: 3 },
  saveText:          { color: WHITE, fontSize: 15, fontWeight: '700' },
});
