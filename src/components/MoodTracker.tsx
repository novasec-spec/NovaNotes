// src/components/MoodTracker.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  TextInput,
  ScrollView,
  Animated,
  Dimensions,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../contexts/ThemeContext';

const { width: W } = Dimensions.get('window');

// ─── ALL 30 MOODS WITH CATEGORIES ──────────────────────────────────────────
export const MOOD_CATEGORIES = [
  { key: 'all', label: 'All', icon: 'apps' },
  { key: 'feeling', label: 'Feelings', icon: 'heart-outline' },
  { key: 'energy', label: 'Energy', icon: 'lightning-bolt' },
  { key: 'wellness', label: 'Wellness', icon: 'leaf-circle-outline' },
  { key: 'social', label: 'Social', icon: 'account-group-outline' },
  { key: 'spirit', label: 'Spirit', icon: 'star-crescent' },
];

export const ALL_MOODS = [
  // ─── Feelings ───
  { id: 'happy', label: 'Happy', icon: 'emoticon-happy-outline', color: '#F59E0B', category: 'feeling' },
  { id: 'loved', label: 'Loved', icon: 'heart-outline', color: '#FF6B9D', category: 'feeling' },
  { id: 'sad', label: 'Sad', icon: 'emoticon-sad-outline', color: '#60A5FA', category: 'feeling' },
  { id: 'angry', label: 'Angry', icon: 'emoticon-angry-outline', color: '#EF4444', category: 'feeling' },
  { id: 'anxious', label: 'Anxious', icon: 'emoticon-confused-outline', color: '#8B5CF6', category: 'feeling' },
  { id: 'grateful', label: 'Grateful', icon: 'hand-heart-outline', color: '#22C55E', category: 'feeling' },
  { id: 'dreamy', label: 'Dreamy', icon: 'weather-night', color: '#A78BFA', category: 'feeling' },
  // ─── Energy ───
  { id: 'energetic', label: 'Energetic', icon: 'lightning-bolt', color: '#F97316', category: 'energy' },
  { id: 'tired', label: 'Tired', icon: 'sleep', color: '#94A3B8', category: 'energy' },
  { id: 'motivated', label: 'Motivated', icon: 'rocket-launch-outline', color: '#3B82F6', category: 'energy' },
  { id: 'lazy', label: 'Lazy', icon: 'sofa-outline', color: '#D97706', category: 'energy' },
  { id: 'focused', label: 'Focused', icon: 'target', color: '#0EA5E9', category: 'energy' },
  { id: 'restless', label: 'Restless', icon: 'run-fast', color: '#EC4899', category: 'energy' },
  // ─── Wellness ───
  { id: 'calm', label: 'Calm', icon: 'leaf-maple', color: '#10B981', category: 'wellness' },
  { id: 'stressed', label: 'Stressed', icon: 'head-cog-outline', color: '#F43F5E', category: 'wellness' },
  { id: 'refreshed', label: 'Refreshed', icon: 'water-outline', color: '#06B6D4', category: 'wellness' },
  { id: 'sick', label: 'Not Well', icon: 'medical-bag', color: '#FB923C', category: 'wellness' },
  { id: 'strong', label: 'Strong', icon: 'arm-flex-outline', color: '#7C3AED', category: 'wellness' },
  { id: 'nourished', label: 'Nourished', icon: 'food-apple-outline', color: '#84CC16', category: 'wellness' },
  // ─── Social ───
  { id: 'social', label: 'Social', icon: 'account-group-outline', color: '#F472B6', category: 'social' },
  { id: 'lonely', label: 'Lonely', icon: 'account-outline', color: '#64748B', category: 'social' },
  { id: 'missing', label: 'Missing You', icon: 'heart-broken', color: '#E879F9', category: 'social' },
  { id: 'connected', label: 'Connected', icon: 'link-variant', color: '#2DD4BF', category: 'social' },
  { id: 'playful', label: 'Playful', icon: 'gamepad-variant-outline', color: '#FBBF24', category: 'social' },
  { id: 'romantic', label: 'Romantic', icon: 'rose', color: '#F43F5E', category: 'social' },
  // ─── Spiritual ───
  { id: 'blessed', label: 'Blessed', icon: 'star-four-points-outline', color: '#A855F7', category: 'spirit' },
  { id: 'prayerful', label: 'Prayerful', icon: 'hands-pray', color: '#8B5CF6', category: 'spirit' },
  { id: 'hopeful', label: 'Hopeful', icon: 'weather-sunny', color: '#FCD34D', category: 'spirit' },
  { id: 'peaceful', label: 'Peaceful', icon: 'peace', color: '#34D399', category: 'spirit' },
  { id: 'curious', label: 'Curious', icon: 'magnify', color: '#38BDF8', category: 'spirit' },
];

interface MoodTrackerProps {
  onMoodSelect?: (mood: any) => void;
  initialMood?: any;
  size?: 'small' | 'medium' | 'large';
  onMoodWithComment?: (mood: any, comment: string) => void;
  showCommentInput?: boolean;
  notificationContext?: 'initial' | 'followup' | 'random';
}

export default function MoodTracker({
  onMoodSelect,
  initialMood,
  size = 'medium',
  onMoodWithComment,
  showCommentInput = false,
  notificationContext = 'initial',
}: MoodTrackerProps) {
  const { colors, isDarkMode } = useTheme();
  const [selectedMood, setSelectedMood] = useState<any>(initialMood || null);
  const [showPicker, setShowPicker] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [moodHistory, setMoodHistory] = useState<any[]>([]);
  const [comment, setComment] = useState('');
  const [showComment, setShowComment] = useState(false);

  const slideAnim = useRef(new Animated.Value(600)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    loadMoodHistory();
  }, []);

  const loadMoodHistory = async () => {
    try {
      const history = await AsyncStorage.getItem('moodHistory');
      if (history) {
        setMoodHistory(JSON.parse(history));
      }
    } catch (e) {
      console.warn('Failed to load mood history:', e);
    }
  };

  // ─── SAVE MOOD HELPER FUNCTION ───────────────────────────────────────────
  const saveMood = async (entry: any) => {
    try {
      const existing = await AsyncStorage.getItem('moodHistory');
      const history: any[] = existing ? JSON.parse(existing) : [];
      const today = new Date(entry.timestamp).toDateString();
      const cleaned = history.filter(m => new Date(m.timestamp).toDateString() !== today);
      cleaned.unshift(entry);
      if (cleaned.length > 90) cleaned.splice(90);
      await AsyncStorage.setItem('moodHistory', JSON.stringify(cleaned));
      setMoodHistory(cleaned);
      
      // Update selected mood state
      setSelectedMood(entry);
      
      if (onMoodSelect) onMoodSelect(entry);
      setShowPicker(false);
    } catch (e) {
      console.warn('Failed to save mood:', e);
    }
  };

  // ─── RENDER COMMENT MODAL ────────────────────────────────────────────────
  // Moved this BEFORE it's used in the render functions
  const renderCommentModal = () => (
    <Modal visible={showComment} transparent animationType="fade">
      <View style={styles.commentOverlay}>
        <View style={[styles.commentModal, { backgroundColor: colors.card }]}>
          <Text style={[styles.commentTitle, { color: colors.text }]}>
            How are you really feeling? 💕
          </Text>
          <Text style={[styles.commentSubtitle, { color: colors.muted }]}>
            Add a note about your mood (optional)
          </Text>

          <TextInput
            style={[styles.commentInput, {
              backgroundColor: colors.background,
              borderColor: colors.border,
              color: colors.text,
            }]}
            placeholder="Share what's on your mind..."
            placeholderTextColor={colors.muted}
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          <View style={styles.commentActions}>
            <TouchableOpacity
              style={[styles.commentCancel, { borderColor: colors.border }]}
              onPress={() => {
                setShowComment(false);
                setComment('');
                setSelectedMood(null);
              }}
            >
              <Text style={[styles.commentCancelText, { color: colors.muted }]}>Skip</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.commentSubmit}
              onPress={handleMoodWithComment}
            >
              <Text style={styles.commentSubmitText}>Save Mood 💕</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const handleMoodPress = async (mood: any) => {
    if (showCommentInput) {
      // Show comment input first
      setSelectedMood(mood);
      setShowComment(true);
      return;
    }
    const entry = { 
      ...mood, 
      timestamp: new Date().toISOString(), 
      comment: '',
      fromNotification: notificationContext !== 'initial',
      notificationType: notificationContext,
    };
    await saveMood(entry);
  };

  const handleMoodWithComment = async () => {
    if (!selectedMood) return;

    const entry = {
      ...selectedMood,
      timestamp: new Date().toISOString(),
      comment: comment.trim() || undefined,
      fromNotification: notificationContext !== 'initial',
      notificationType: notificationContext,
    };

    await saveMood(entry);
    setShowComment(false);
    setComment('');

    if (onMoodWithComment) {
      onMoodWithComment(entry, comment);
    }
  };

  const openPicker = () => {
    setShowPicker(true);
    Animated.spring(slideAnim, { toValue: 0, friction: 14, tension: 80, useNativeDriver: true }).start();
  };

  const closePicker = () => {
    Animated.timing(slideAnim, { toValue: 600, duration: 240, useNativeDriver: true }).start(() => {
      setShowPicker(false);
    });
  };

  const filteredMoods = ALL_MOODS.filter(m => {
    const matchCategory = activeCategory === 'all' || m.category === activeCategory;
    const matchSearch = !searchQuery.trim() || m.label.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          iconSize: 24,
          fontSize: 11,
          padding: 10,
          gap: 4,
        };
      case 'large':
        return {
          iconSize: 40,
          fontSize: 14,
          padding: 18,
          gap: 8,
        };
      default:
        return {
          iconSize: 32,
          fontSize: 12,
          padding: 14,
          gap: 6,
        };
    }
  };

  const sizeStyles = getSizeStyles();

  // ─── RENDER SELECTED MOOD DISPLAY ─────────────────────────────────────────
  if (selectedMood) {
    return (
      <>
        <TouchableOpacity
          style={[styles.selectedMoodCard, { backgroundColor: colors.card }]}
          onPress={openPicker}
          activeOpacity={0.8}
        >
          <View style={[styles.selectedMoodIcon, { backgroundColor: selectedMood.color + '22' }]}>
            <MaterialCommunityIcons name={selectedMood.icon} size={36} color={selectedMood.color} />
          </View>
          <View style={styles.selectedMoodInfo}>
            <Text style={[styles.selectedMoodLabel, { color: colors.muted }]}>Today's Vibe</Text>
            <Text style={[styles.selectedMoodName, { color: selectedMood.color }]}>
              {selectedMood.label}
            </Text>
            <Text style={[styles.selectedMoodTime, { color: colors.muted }]}>
              Logged • {new Date(selectedMood.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />
        </TouchableOpacity>
        {renderCommentModal()}
      </>
    );
  }

  // ─── RENDER MOOD PICKER BUTTON ────────────────────────────────────────────
  return (
    <>
      <TouchableOpacity
        style={[styles.moodPickerButton, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={openPicker}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons name="emoticon-outline" size={28} color="#FF6B9D" />
        <Text style={[styles.moodPickerText, { color: colors.text }]}>How are you feeling today?</Text>
        <MaterialCommunityIcons name="chevron-right" size={20} color={colors.muted} />
      </TouchableOpacity>

      {/* ─── MOOD PICKER MODAL ─── */}
      <Modal visible={showPicker} transparent animationType="none" onRequestClose={closePicker}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={closePicker} />
          <Animated.View style={[
            styles.modalSheet,
            { backgroundColor: colors.card, transform: [{ translateY: slideAnim }] },
          ]}>
            {/* Handle */}
            <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />

            {/* Title */}
            <Text style={[styles.modalTitle, { color: colors.text }]}>How are you feeling? 💕</Text>

            {/* Search */}
            <View style={[styles.searchRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
              <Ionicons name="search" size={16} color={colors.muted} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Search moods..."
                placeholderTextColor={colors.muted}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={16} color={colors.muted} />
                </TouchableOpacity>
              )}
            </View>

            {/* Categories */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
              {MOOD_CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat.key}
                  onPress={() => setActiveCategory(cat.key)}
                  style={[
                    styles.catChip,
                    {
                      backgroundColor: activeCategory === cat.key ? '#FF6B9D' : (isDarkMode ? '#333' : '#F5F0F5'),
                      borderColor: activeCategory === cat.key ? '#FF6B9D' : 'transparent',
                    },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={cat.icon}
                    size={14}
                    color={activeCategory === cat.key ? '#fff' : '#FF6B9D'}
                  />
                  <Text style={[
                    styles.catChipText,
                    { color: activeCategory === cat.key ? '#fff' : '#FF6B9D' },
                  ]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Mood Grid */}
            <FlatList
              data={filteredMoods}
              keyExtractor={item => item.id}
              numColumns={3}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.moodGridContent}
              columnWrapperStyle={styles.moodGridRow}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.moodBtn,
                    {
                      backgroundColor: item.color + (isDarkMode ? '33' : '18'),
                      borderColor: item.color + '44',
                    },
                  ]}
                  onPress={() => handleMoodPress(item)}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name={item.icon} size={32} color={item.color} />
                  <Text style={[styles.moodBtnLabel, { color: item.color }]}>{item.label}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={[styles.emptyText, { color: colors.muted }]}>
                  No moods found. Try a different search! 💕
                </Text>
              }
            />

            {/* Close Button */}
            <TouchableOpacity
              style={[styles.closeBtn, { backgroundColor: '#FF6B9D' }]}
              onPress={closePicker}
            >
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
      
      {renderCommentModal()}
    </>
  );
}

const styles = StyleSheet.create({
  // ─── Selected Mood Card ───
  selectedMoodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginVertical: 8,
    borderRadius: 20,
    padding: 16,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  selectedMoodIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedMoodInfo: { flex: 1 },
  selectedMoodLabel: { fontSize: 12, fontWeight: '600' },
  selectedMoodName: { fontSize: 20, fontWeight: '800' },
  selectedMoodTime: { fontSize: 11, marginTop: 2 },

  // ─── Mood Picker Button ───
  moodPickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginVertical: 8,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    gap: 10,
  },
  moodPickerText: { flex: 1, fontSize: 15, fontWeight: '600' },

  // ─── Modal ───
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    maxHeight: '85%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 14,
  },

  // ─── Search ───
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 14,
  },
  searchInput: { flex: 1, fontSize: 14 },

  // ─── Categories ───
  catScroll: { marginBottom: 14, maxHeight: 44 },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    marginRight: 8,
  },
  catChipText: { fontSize: 12, fontWeight: '700' },

  // ─── Mood Grid ───
  moodGridContent: { paddingBottom: 16 },
  moodGridRow: { justifyContent: 'space-between', paddingHorizontal: 2 },
  moodBtn: {
    width: (W - 60) / 3,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    marginBottom: 10,
    gap: 6,
  },
  moodBtnLabel: { fontSize: 12, fontWeight: '700', textAlign: 'center' },

  // ─── Close ───
  closeBtn: {
    padding: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  closeBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  emptyText: {
    textAlign: 'center',
    padding: 20,
    fontSize: 14,
  },
  commentOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentModal: {
    width: '85%',
    borderRadius: 24,
    padding: 24,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  commentTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  commentSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  commentInput: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 80,
    fontSize: 15,
    marginBottom: 16,
  },
  commentActions: {
    flexDirection: 'row',
    gap: 12,
  },
  commentCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  commentCancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  commentSubmit: {
    flex: 2,
    backgroundColor: '#FF6B9D',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  commentSubmitText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
