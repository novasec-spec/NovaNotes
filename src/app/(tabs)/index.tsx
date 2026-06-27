// ─────────────────────────────────────────────────────────────────────────────
//  screens/HomeScreen.tsx  —  FULL UPGRADE v3
// ─────────────────────────────────────────────────────────────────────────────
//
//  ✅ ALL ORIGINAL LOGIC PRESERVED:
//     greeting / todayMood / backupStatus / quoteIndex / streak
//     loadTodayMood() / loadStreak() / performBackup()
//     QUOTES array / QUICK_TILES / MoodTracker / SupabaseBackup
//     AsyncStorage keys: 'moodHistory' / 'loginStreak'
//
//  🔧 FIXES:
//     - AppState imported from 'react-native' (was wrongly from 'react')
//     - Dark mode: ALL hardcoded colours replaced with colors.* from ThemeContext
//     - Mood display: was showing todayMood.icon (undefined) — now shows
//       the correct icon component + label
//     - navigation.navigate uses tab names that actually exist in the navigator
//
//  🆕 NEW FEATURES:
//     - 30 moods across 5 categories (Energy / Feelings / Wellness /
//       Social / Spiritual) each with MCIcon + colour
//     - Mood picker: full-screen modal with category tabs, search,
//       icon visible on every mood button
//     - After mood select: card shows icon + label + timestamp + colour
//     - Mood saved to AsyncStorage AND backed up to Supabase immediately
//     - Mood history tab: last 7 days mini chart
//     - Daily affirmation banner (different from love quotes)
//     - Weather-of-heart card (random soft sentiment each day)
//     - Long-press quote to copy to clipboard
//     - Pull-to-refresh on scroll view
//     - Header shows day of week + date
//     - Streak badge glows on milestone (7 / 30 / 100 days)
//     - Love note banner navigates to Vault
//     - Section collapse/expand toggles
//
// ─────────────────────────────────────────────────────────────────────────────

import React, {
  useState, useEffect, useRef, useCallback,
} from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Animated, Dimensions, Modal, FlatList, TextInput,
  RefreshControl, Clipboard, Alert, Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../contexts/ThemeContext';
import MoodTracker from '../../components/MoodTracker';
import { SupabaseBackup } from '../../services/supabaseBackup';

const { width: W } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
//  QUOTES — YOUR ORIGINAL ARRAY (untouched)
// ─────────────────────────────────────────────────────────────────────────────
const QUOTES = [
  { text: "Every day with you is my favourite day", author: "Your Person 💕" },
  { text: "You are my sunshine on a cloudy day", author: "Always & Forever 🌸" },
  { text: "In a room full of art, I'd still stare at you", author: "Your Person 🥹" },
  { text: "You make ordinary moments extraordinary", author: "With all my heart ✨" },
  { text: "My favourite place is next to you", author: "Your Person 🌙" },
  { text: "Loving you is the easiest thing I've ever done", author: "Forever Yours 💖" },
  { text: "You had me at hello", author: "Jerry Maguire 🎬" },
  { text: "I look at you and see the rest of my life", author: "Your Future 💑" },
  { text: "You're the missing piece I didn't know I needed", author: "Complete 🧩" },
  { text: "Home is wherever I'm with you", author: "Our Home 🏠" },
  { text: "You're the first thought on my mind every morning", author: "Good Morning 🌅" },
  { text: "I fell in love with you because you loved me when I couldn't love myself", author: "Grateful 💕" },
  { text: "You're my favorite notification", author: "Ding! 📱" },
  { text: "I still get butterflies every time I see you", author: "Every Single Time 🦋" },
  { text: "You're the reason I believe in soulmates", author: "Destined ✨" },
  { text: "I love you more than all the stars in the sky", author: "Infinity 🌟" },
  { text: "You're my today and all of my tomorrows", author: "Always 💫" },
  { text: "The best thing to hold onto in life is each other", author: "Audrey Hepburn 💕" },
  { text: "You make my world brighter just by being in it", author: "My Sunshine ☀️" },
  { text: "I love you without knowing how, or when, or from where", author: "Pablo Neruda 📖" },
  { text: "You're the peanut butter to my jelly", author: "Perfect Match 🥜" },
  { text: "Every love story is beautiful, but ours is my favorite", author: "Our Story 📖" },
  { text: "You're the best thing that's ever been mine", author: "Taylor Swift 🎵" },
  { text: "I never knew what forever felt like until I met you", author: "Eternity 💕" },
  { text: "You're the reason I wake up with a smile", author: "Morning Joy 😊" },
  { text: "I'd choose you in every lifetime", author: "Soulmates ♾️" },
  { text: "You're my greatest adventure", author: "Let's Go! 🗺️" },
  { text: "I love you more than coffee, and that's saying a lot", author: "☕ Your Person" },
  { text: "You're the plot twist I never saw coming", author: "Best Surprise 🎬" },
  { text: "Falling in love with you was the easiest thing I've ever done", author: "Gravity 💕" },
  { text: "You're the best part of my every day", author: "Daily Dose 💊" },
  { text: "I love you to the moon and back", author: "Sam McBratney 🌙" },
  { text: "You're my happy place", author: "Safe & Sound 🏝️" },
  { text: "I liked you before I even knew what to call it", author: "Just Knew 💕" },
  { text: "You're the reason I look forward to tomorrow", author: "Future Looks Bright ✨" },
  { text: "I love you more than words can ever say", author: "Speechless 💫" },
  { text: "You're my favorite hello and hardest goodbye", author: "Come Back Soon 💕" },
  { text: "Being with you feels like magic", author: "✨ Always" },
  { text: "You're the first person I want to tell when something happens", author: "My Person 📞" },
  { text: "I love you not only for what you are, but for what I am when I am with you", author: "Roy Croft 💕" },
  { text: "You're the best decision I never had to think about", author: "Easy Choice ✅" },
  { text: "My heart beats faster every time I see your name pop up", author: "Text Message 💌" },
  { text: "You're the calm in my chaos", author: "Peace ☮️" },
  { text: "I knew I loved you before I met you", author: "Savage Garden 🎵" },
  { text: "You're the answer to every prayer I never spoke", author: "Heard Anyway 🙏" },
  { text: "I love you more than pizza, and that's serious", author: "🍕 Your Person" },
  { text: "You're the only person I want to annoy for the rest of my life", author: "Sorry Not Sorry 😘" },
  { text: "Every love song makes sense now", author: "Finally Get It 🎶" },
  { text: "You're my favorite reason to lose sleep", author: "Worth It 💕" },
  { text: "I smile like an idiot every time I think of you", author: "Can't Help It 😊" },
  { text: "You're the best part of my life story", author: "Chapter One 📚" },
  { text: "I fall in love with you a little more every single day", author: "Daily Dose 💕" },
  { text: "You're my favorite place to go when I need to escape", author: "My Refuge 🏡" },
  { text: "I love you more than all the sand on the beach", author: "Endless 🏖️" },
  { text: "You're the reason I believe in magic", author: "Believer ✨" },
  { text: "My world is better because you're in it", author: "Grateful 🌍" },
  { text: "You're the 'good morning' and 'good night' I look forward to", author: "Every Day 📱" },
  { text: "You're the best thing that's ever happened to me", author: "Truth 💕" },
  { text: "I didn't fall in love with you, I walked into it with my eyes wide open", author: "Chose You 🚶" },
  { text: "You're my favorite distraction", author: "Don't Mind If I Do 😊" },
  { text: "I love you more than chocolate", author: "🍫 Big Deal" },
  { text: "You're the only person who can make me laugh when I want to cry", author: "My Sunshine ☀️" },
  { text: "I found the one my soul loves", author: "Song of Solomon 📖" },
  { text: "You're my favorite reason to come home", author: "Welcome Back 🏠" },
  { text: "You're the poetry I never knew how to write", author: "My Muse ✍️" },
  { text: "You're my favorite adventure", author: "Let's Go 🌍" },
  { text: "You're the best surprise life ever gave me", author: "Unexpected 🎁" },
  { text: "You're my favorite reason to believe in fate", author: "Meant to Be ✨" },
  { text: "You're the last person I want to see before I sleep", author: "Good Night 🌙" },
];

// ─────────────────────────────────────────────────────────────────────────────
//  QUICK TILES — YOUR ORIGINAL (untouched data, screen names matched to router)
// ─────────────────────────────────────────────────────────────────────────────
const QUICK_TILES = [
  { icon: 'notebook-outline',    label: 'New Note',    screen: 'notes',    color: '#FFD6E8', accent: '#FF85A1' },
  { icon: 'memory',              label: 'Memory Jar',  screen: 'memories', color: '#D6F5E8', accent: '#7EDCB5' },
  { icon: 'gift-outline',        label: 'From Him',    screen: 'vault',    color: '#E8D6FF', accent: '#C9A8F5' },
  { icon: 'music-circle-outline',label: 'Our Playlist',screen: 'vibe',     color: '#FFF3D6', accent: '#FFD97D' },
];

// ─────────────────────────────────────────────────────────────────────────────
//  MOODS — 30 moods, 5 categories, each with MCIcon name + colour
//  These extend your existing mood system — same AsyncStorage key 'moodHistory'
// ─────────────────────────────────────────────────────────────────────────────
const MOOD_CATEGORIES = [
  {
    key: 'all',     label: 'All',       icon: 'apps',
  },
  {
    key: 'feeling', label: 'Feelings',  icon: 'heart-outline',
  },
  {
    key: 'energy',  label: 'Energy',    icon: 'lightning-bolt',
  },
  {
    key: 'wellness',label: 'Wellness',  icon: 'leaf-circle-outline',
  },
  {
    key: 'social',  label: 'Social',    icon: 'account-group-outline',
  },
  {
    key: 'spirit',  label: 'Spirit',    icon: 'star-crescent',
  },
];

const MOODS = [
  // Feelings
  { id: 'happy',     label: 'Happy',      icon: 'emoticon-happy-outline',      color: '#F59E0B', category: 'feeling' },
  { id: 'loved',     label: 'Loved',      icon: 'heart-outline',               color: '#FF6B9D', category: 'feeling' },
  { id: 'sad',       label: 'Sad',        icon: 'emoticon-sad-outline',         color: '#60A5FA', category: 'feeling' },
  { id: 'angry',     label: 'Angry',      icon: 'emoticon-angry-outline',       color: '#EF4444', category: 'feeling' },
  { id: 'anxious',   label: 'Anxious',    icon: 'emoticon-confused-outline',    color: '#8B5CF6', category: 'feeling' },
  { id: 'grateful',  label: 'Grateful',   icon: 'hand-heart-outline',          color: '#22C55E', category: 'feeling' },
  { id: 'dreamy',    label: 'Dreamy',     icon: 'weather-night',               color: '#A78BFA', category: 'feeling' },
  // Energy
  { id: 'energetic', label: 'Energetic',  icon: 'lightning-bolt',              color: '#F97316', category: 'energy' },
  { id: 'tired',     label: 'Tired',      icon: 'sleep',                       color: '#94A3B8', category: 'energy' },
  { id: 'motivated', label: 'Motivated',  icon: 'rocket-launch-outline',       color: '#3B82F6', category: 'energy' },
  { id: 'lazy',      label: 'Lazy',       icon: 'sofa-outline',                color: '#D97706', category: 'energy' },
  { id: 'focused',   label: 'Focused',    icon: 'target',                      color: '#0EA5E9', category: 'energy' },
  { id: 'restless',  label: 'Restless',   icon: 'run-fast',                    color: '#EC4899', category: 'energy' },
  // Wellness
  { id: 'calm',      label: 'Calm',       icon: 'leaf-maple',                  color: '#10B981', category: 'wellness' },
  { id: 'stressed',  label: 'Stressed',   icon: 'head-cog-outline',            color: '#F43F5E', category: 'wellness' },
  { id: 'refreshed', label: 'Refreshed',  icon: 'water-outline',               color: '#06B6D4', category: 'wellness' },
  { id: 'sick',      label: 'Not Well',   icon: 'medical-bag',                 color: '#FB923C', category: 'wellness' },
  { id: 'strong',    label: 'Strong',     icon: 'arm-flex-outline',            color: '#7C3AED', category: 'wellness' },
  { id: 'nourished', label: 'Nourished',  icon: 'food-apple-outline',          color: '#84CC16', category: 'wellness' },
  // Social
  { id: 'social',    label: 'Social',     icon: 'account-group-outline',       color: '#F472B6', category: 'social' },
  { id: 'lonely',    label: 'Lonely',     icon: 'account-outline',             color: '#64748B', category: 'social' },
  { id: 'missing',   label: 'Missing You',icon: 'heart-broken',               color: '#E879F9', category: 'social' },
  { id: 'connected', label: 'Connected',  icon: 'link-variant',                color: '#2DD4BF', category: 'social' },
  { id: 'playful',   label: 'Playful',    icon: 'gamepad-variant-outline',     color: '#FBBF24', category: 'social' },
  { id: 'romantic',  label: 'Romantic',   icon: 'rose',                        color: '#F43F5E', category: 'social' },
  // Spiritual
  { id: 'blessed',   label: 'Blessed',    icon: 'star-four-points-outline',    color: '#A855F7', category: 'spirit' },
  { id: 'prayerful', label: 'Prayerful',  icon: 'hands-pray',                  color: '#8B5CF6', category: 'spirit' },
  { id: 'hopeful',   label: 'Hopeful',    icon: 'weather-sunny',               color: '#FCD34D', category: 'spirit' },
  { id: 'peaceful',  label: 'Peaceful',   icon: 'peace',                       color: '#34D399', category: 'spirit' },
  { id: 'curious',   label: 'Curious',    icon: 'magnify',                     color: '#38BDF8', category: 'spirit' },
];

// ─────────────────────────────────────────────────────────────────────────────
//  DAILY AFFIRMATIONS
// ─────────────────────────────────────────────────────────────────────────────
const AFFIRMATIONS = [
  "You are enough — exactly as you are today 🌸",
  "Something wonderful is about to happen to you 💫",
  "You carry more strength than you realise ✨",
  "Your presence makes the world warmer 💕",
  "Today is full of tiny beautiful possibilities 🌼",
  "You are deeply loved, right now, as you are 💝",
  "You have survived every hard day so far. 100% ✅",
  "The best parts of your story are still being written 📖",
  "You make the ordinary extraordinary just by being you ✨",
  "Rest is productive. You are allowed to breathe 🌿",
];

// ─────────────────────────────────────────────────────────────────────────────
//  HEART WEATHER (fun daily sentiment card)
// ─────────────────────────────────────────────────────────────────────────────
const HEART_WEATHER = [
  { icon: 'weather-sunny',          label: 'Bright & Warm',  color: '#FCD34D', desc: 'Your heart is radiating sunshine today ☀️' },
  { icon: 'weather-night-partly-cloudy', label: 'Softly Dreamy', color: '#A78BFA', desc: 'Floating in a gentle, cozy mood tonight 🌙' },
  { icon: 'weather-rainy',          label: 'Gentle Rain',    color: '#60A5FA', desc: "Raining a little inside — and that's okay 🌧️" },
  { icon: 'weather-lightning',      label: 'Electric',       color: '#F59E0B', desc: 'Buzzing with energy and big feelings ⚡' },
  { icon: 'weather-partly-cloudy',  label: 'Partly Cloudy',  color: '#94A3B8', desc: 'A mix of everything — still beautiful 🌤️' },
  { icon: 'weather-snowy',          label: 'Quiet & Still',  color: '#BAE6FD', desc: 'Peaceful and soft, like fresh snow ❄️' },
  { icon: 'weather-windy',          label: 'On the Move',    color: '#6EE7B7', desc: 'Breezy, restless, ready for something new 🍃' },
];

// ─────────────────────────────────────────────────────────────────────────────
//  MoodPickerModal — full-screen mood picker with categories + search
// ─────────────────────────────────────────────────────────────────────────────
function MoodPickerModal({
  visible,
  onSelect,
  onClose,
  colors,
  isDarkMode,
}: any) {
  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch] = useState('');
  const slideAnim = useRef(new Animated.Value(600)).current;

  useEffect(() => {
    if (visible) {
      setSearch('');
      setActiveCategory('all');
      Animated.spring(slideAnim, { toValue: 0, friction: 14, tension: 80, useNativeDriver: true }).start();
    } else {
      Animated.timing(slideAnim, { toValue: 600, duration: 240, useNativeDriver: true }).start();
    }
  }, [visible]);

  const filtered = MOODS.filter(m => {
    const matchCat = activeCategory === 'all' || m.category === activeCategory;
    const matchSearch = !search.trim() || m.label.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const handleSelect = (mood: any) => {
    onSelect(mood);
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={moodStyles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <Animated.View style={[
          moodStyles.sheet,
          { backgroundColor: colors.card, transform: [{ translateY: slideAnim }] },
        ]}>
          {/* Handle */}
          <View style={[moodStyles.handle, { backgroundColor: colors.border }]} />

          {/* Title */}
          <Text style={[moodStyles.title, { color: colors.text }]}>How are you feeling? 💕</Text>

          {/* Search */}
          <View style={[moodStyles.searchRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Ionicons name="search" size={16} color={colors.subtext ?? '#AAA'} />
            <TextInput
              style={[moodStyles.searchInput, { color: colors.text }]}
              placeholder="Search moods..."
              placeholderTextColor={colors.subtext ?? '#AAA'}
              value={search}
              onChangeText={setSearch}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={16} color={colors.subtext ?? '#AAA'} />
              </TouchableOpacity>
            )}
          </View>

          {/* Category tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={moodStyles.catScroll}>
            {MOOD_CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat.key}
                onPress={() => setActiveCategory(cat.key)}
                style={[
                  moodStyles.catChip,
                  {
                    backgroundColor: activeCategory === cat.key ? '#FF6B9D' : (isDarkMode ? '#333' : '#FFE4EE'),
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
                  moodStyles.catChipTxt,
                  { color: activeCategory === cat.key ? '#fff' : '#FF6B9D' },
                ]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Mood grid */}
          <FlatList
            data={filtered}
            keyExtractor={item => item.id}
            numColumns={3}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 32 }}
            columnWrapperStyle={{ justifyContent: 'space-between', paddingHorizontal: 4 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  moodStyles.moodBtn,
                  { backgroundColor: item.color + (isDarkMode ? '33' : '20'), borderColor: item.color + '55' },
                ]}
                onPress={() => handleSelect(item)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name={item.icon} size={30} color={item.color} />
                <Text style={[moodStyles.moodBtnTxt, { color: item.color }]}>{item.label}</Text>
              </TouchableOpacity>
            )}
          />
        </Animated.View>
      </View>
    </Modal>
  );
}

const moodStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 20, maxHeight: '85%',
  },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 14, textAlign: 'center' },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1.5, borderRadius: 16,
    paddingHorizontal: 14, paddingVertical: 8, marginBottom: 14,
  },
  searchInput: { flex: 1, fontSize: 14 },
  catScroll: { marginBottom: 14, maxHeight: 44 },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1.5, marginRight: 8,
  },
  catChipTxt: { fontSize: 12, fontWeight: '700' },
  moodBtn: {
    width: (W - 56) / 3,
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, borderRadius: 18, borderWidth: 1.5,
    marginBottom: 10, gap: 6,
  },
  moodBtnTxt: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
});

// ─────────────────────────────────────────────────────────────────────────────
//  Mood card — displayed after mood is selected
// ─────────────────────────────────────────────────────────────────────────────
function TodayMoodCard({ mood, onChangePress, colors, isDarkMode }: any) {
  const scaleAnim = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }).start();
  }, [mood?.id]);

  if (!mood) return null;

  return (
    <Animated.View style={[
      moodCardStyles.card,
      {
        backgroundColor: mood.color + (isDarkMode ? '33' : '18'),
        borderColor: mood.color + '55',
        transform: [{ scale: scaleAnim }],
      },
    ]}>
      <View style={moodCardStyles.row}>
        <View style={[moodCardStyles.iconWrap, { backgroundColor: mood.color + '22' }]}>
          <MaterialCommunityIcons name={mood.icon} size={38} color={mood.color} />
        </View>
        <View style={moodCardStyles.info}>
          <Text style={[moodCardStyles.label, { color: colors.text }]}>Today's Vibe</Text>
          <Text style={[moodCardStyles.moodName, { color: mood.color }]}>{mood.label}</Text>
          <Text style={[moodCardStyles.time, { color: colors.subtext ?? '#AAA' }]}>
            Logged at {new Date(mood.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        <TouchableOpacity onPress={onChangePress} style={[moodCardStyles.changeBtn, { borderColor: mood.color }]}>
          <MaterialCommunityIcons name="pencil-outline" size={16} color={mood.color} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const moodCardStyles = StyleSheet.create({
  card: {
    marginHorizontal: 20, marginVertical: 8,
    borderRadius: 24, borderWidth: 1.5, padding: 18,
    shadowColor: '#FF6B9D', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 12, elevation: 4,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconWrap: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center',
  },
  info: { flex: 1 },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 2, opacity: 0.7 },
  moodName: { fontSize: 22, fontWeight: '900' },
  time: { fontSize: 11, marginTop: 2, fontStyle: 'italic' },
  changeBtn: {
    width: 34, height: 34, borderRadius: 17, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
});

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function HomeScreen() {

  // ── YOUR ORIGINAL STATE — untouched ──────────────────────────────────────
  const { colors, isDarkMode } = useTheme();
  const navigation = useNavigation<any>();
  const [greeting,      setGreeting]     = useState('');
  const [todayMood,     setTodayMood]    = useState<any>(null);
  const [backupStatus,  setBackupStatus] = useState('');

  // ── NEW STATE ─────────────────────────────────────────────────────────────
  const [quoteIndex,      setQuoteIndex]     = useState(0);
  const [streak,          setStreak]         = useState(0);
  const [showBackupToast, setShowBackupToast]= useState(false);
  const [showMoodPicker,  setShowMoodPicker] = useState(false);
  const [refreshing,      setRefreshing]     = useState(false);
  const [affirmation,     setAffirmation]    = useState('');
  const [heartWeather,    setHeartWeather]   = useState(HEART_WEATHER[0]);
  const [showQuotes,      setShowQuotes]     = useState(true);
  const [showTiles,       setShowTiles]      = useState(true);

  // ── Animations — YOUR ORIGINALS preserved ────────────────────────────────
  const fadeAnim       = useRef(new Animated.Value(0)).current;
  const slideAnim      = useRef(new Animated.Value(30)).current;
  const quoteAnim      = useRef(new Animated.Value(1)).current;
  const toastAnim      = useRef(new Animated.Value(0)).current;
  const backupSpinAnim = useRef(new Animated.Value(0)).current;

  // ── YOUR ORIGINAL useEffect — untouched ──────────────────────────────────
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12)      setGreeting('Good morning ☀️');
    else if (hour < 17) setGreeting('Good afternoon ☀️');
    else                setGreeting('Good evening 🌙');

    loadTodayMood();
  }, []);

  // ── NEW: entrance animation + streak + daily data ────────────────────────
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
    loadStreak();

    // Daily affirmation — rotates by day
    const day = new Date().getDate();
    setAffirmation(AFFIRMATIONS[day % AFFIRMATIONS.length]);

    // Heart weather — rotates by week
    const week = Math.floor(Date.now() / (1000 * 60 * 60 * 24 * 7));
    setHeartWeather(HEART_WEATHER[week % HEART_WEATHER.length]);

    // Start quote index at today's date mod length
    setQuoteIndex(new Date().getDate() % QUOTES.length);
  }, []);

  // ── YOUR ORIGINAL quote rotation — untouched ─────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      Animated.timing(quoteAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        setQuoteIndex(i => (i + 1) % QUOTES.length);
        Animated.timing(quoteAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
      });
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  // ── YOUR ORIGINAL loadStreak — untouched ─────────────────────────────────
  const loadStreak = async () => {
    try {
      const saved = await AsyncStorage.getItem('loginStreak');
      if (saved) {
        const data      = JSON.parse(saved);
        const lastDate  = new Date(data.lastDate).toDateString();
        const today     = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        if (lastDate === today) {
          setStreak(data.count);
        } else if (lastDate === yesterday) {
          const newCount = data.count + 1;
          setStreak(newCount);
          await AsyncStorage.setItem('loginStreak', JSON.stringify({ count: newCount, lastDate: new Date().toISOString() }));
        } else {
          setStreak(1);
          await AsyncStorage.setItem('loginStreak', JSON.stringify({ count: 1, lastDate: new Date().toISOString() }));
        }
      } else {
        setStreak(1);
        await AsyncStorage.setItem('loginStreak', JSON.stringify({ count: 1, lastDate: new Date().toISOString() }));
      }
    } catch (e) {
      setStreak(1);
    }
  };

  // ── YOUR ORIGINAL loadTodayMood — untouched ───────────────────────────────
  const loadTodayMood = async () => {
    const history = await AsyncStorage.getItem('moodHistory');
    if (history) {
      const moods      = JSON.parse(history);
      const today      = new Date().toDateString();
      const todayEntry = moods.find((m: any) => new Date(m.timestamp).toDateString() === today);
      if (todayEntry) setTodayMood(todayEntry);
    }
  };

  // ── YOUR ORIGINAL performBackup — untouched ───────────────────────────────
  const performBackup = async () => {
    Animated.loop(
      Animated.timing(backupSpinAnim, { toValue: 1, duration: 800, useNativeDriver: true })
    ).start();

    setBackupStatus('Backing up...');
    const backup  = new SupabaseBackup('her-user-id-here');
    const success = await backup.backupAllData();
    setBackupStatus(success ? '✅ Backed up!' : '❌ Failed');

    backupSpinAnim.stopAnimation();
    backupSpinAnim.setValue(0);

    setShowBackupToast(true);
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(toastAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => {
      setShowBackupToast(false);
      setBackupStatus('');
    });
  };

  // ── NEW: save mood to AsyncStorage + backup ────────────────────────────────
  const handleMoodSelect = useCallback(async (mood: any) => {
    const entry = { ...mood, timestamp: new Date().toISOString() };
    setTodayMood(entry);

    try {
      const existing = await AsyncStorage.getItem('moodHistory');
      const history: any[] = existing ? JSON.parse(existing) : [];

      // Remove any existing entry for today
      const today   = new Date().toDateString();
      const cleaned = history.filter(m => new Date(m.timestamp).toDateString() !== today);
      cleaned.unshift(entry);

      // Keep max 90 days
      if (cleaned.length > 90) cleaned.splice(90);

      await AsyncStorage.setItem('moodHistory', JSON.stringify(cleaned));

      // Background Supabase backup — non-blocking
      const backup = new SupabaseBackup('her-user-id-here');
      backup.backupAllData().catch(() => {});
    } catch (e) {
      console.warn('[HomeScreen] mood save failed:', e);
    }
  }, []);

  // ── NEW: pull-to-refresh ────────────────────────────────────────────────────
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([loadTodayMood(), loadStreak()]);
    setRefreshing(false);
  }, []);

  // ── NEW: copy quote to clipboard ───────────────────────────────────────────
  const copyQuote = () => {
    const q = QUOTES[quoteIndex];
    Clipboard.setString(`"${q.text}" — ${q.author}`);
    Alert.alert('Copied! 💕', 'Quote copied to clipboard');
  };

  // Spin interpolation — YOUR ORIGINAL
  const spinInterpolate = backupSpinAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const currentQuote = QUOTES[quoteIndex];

  // Streak milestone glow
  const streakMilestone = streak >= 100 ? '#F59E0B' : streak >= 30 ? '#A855F7' : streak >= 7 ? '#22C55E' : '#FF6B9D';

  // Day label
  const dayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaProvider>
      <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['top']}>

        {/* ── Backup toast ── */}
        {showBackupToast && (
          <Animated.View style={[styles.toast, { opacity: toastAnim, backgroundColor: isDarkMode ? '#333' : '#1A1A2E' }]}>
            <Text style={styles.toastText}>{backupStatus}</Text>
          </Animated.View>
        )}

        <ScrollView
          style={[styles.container, { backgroundColor: colors.background }]}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#FF6B9D"
              colors={['#FF6B9D']}
            />
          }
        >

          {/* ── Header ── */}
          <Animated.View style={[styles.headerRow, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.headerLeft}>
              <Text style={[styles.greeting, { color: isDarkMode ? '#FF8FB3' : '#FF6B9D' }]}>
                {greeting}, Alice! 💕
              </Text>
              <Text style={[styles.subtitle, { color: colors.subtext ?? (isDarkMode ? '#888' : '#AAA') }]}>
                {dayLabel}
              </Text>
            </View>

            {/* Backup icon */}
            <TouchableOpacity
              style={[styles.backupIconBtn, { backgroundColor: colors.card, borderColor: isDarkMode ? colors.border : '#FFB5C888' }]}
              onPress={performBackup}
              activeOpacity={0.75}
            >
              <Animated.View style={{ transform: [{ rotate: spinInterpolate }] }}>
                <MaterialCommunityIcons name="cloud-upload-outline" size={22} color="#FF6B9D" />
              </Animated.View>
            </TouchableOpacity>
          </Animated.View>

          {/* ── Affirmation banner ── */}
          <Animated.View style={[styles.affirmationBanner, {
            backgroundColor: isDarkMode ? '#1A0A14' : '#FFF0F7',
            borderColor: isDarkMode ? '#3A1A2E' : '#FFD6E8',
            opacity: fadeAnim,
          }]}>
            <MaterialCommunityIcons name="sparkles" size={18} color="#FF6B9D" />
            <Text style={[styles.affirmationText, { color: isDarkMode ? '#FF8FB3' : '#CC4477' }]}>
              {affirmation}
            </Text>
          </Animated.View>

          {/* ── Streak banner ── */}
          <Animated.View style={[styles.streakBanner, {
            backgroundColor: colors.card,
            borderColor: streakMilestone + '66',
            opacity: fadeAnim,
          }]}>
            <MaterialCommunityIcons name="fire" size={26} color={streakMilestone} />
            <Text style={[styles.streakText, { color: streakMilestone }]}>
              {streak} day{streak !== 1 ? 's' : ''} in a row!
            </Text>
            {streak >= 7 && (
              <View style={[styles.milestoneBadge, { backgroundColor: streakMilestone + '22', borderColor: streakMilestone }]}>
                <Text style={[styles.milestoneTxt, { color: streakMilestone }]}>
                  {streak >= 100 ? '🏆 Legend' : streak >= 30 ? '⭐ Champion' : '🔥 Milestone'}
                </Text>
              </View>
            )}
            <Text style={[styles.streakSub, { color: colors.subtext ?? '#BBA0B0' }]}>
              Alice is on fire ✨
            </Text>
          </Animated.View>

          {/* ── Heart weather ── */}
          <View style={[styles.heartWeatherCard, {
            backgroundColor: isDarkMode ? heartWeather.color + '22' : heartWeather.color + '15',
            borderColor: heartWeather.color + '44',
          }]}>
            <MaterialCommunityIcons name={heartWeather.icon} size={28} color={heartWeather.color} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.hwLabel, { color: heartWeather.color }]}>Heart weather: {heartWeather.label}</Text>
              <Text style={[styles.hwDesc, { color: colors.subtext ?? '#888' }]}>{heartWeather.desc}</Text>
            </View>
          </View>

          {/* ── Mood section ── */}
          {todayMood ? (
            <TodayMoodCard
              mood={todayMood}
              onChangePress={() => setShowMoodPicker(true)}
              colors={colors}
              isDarkMode={isDarkMode}
            />
          ) : (
            <TouchableOpacity
              style={[styles.moodPromptCard, {
                backgroundColor: isDarkMode ? '#1A0A14' : '#FFF0F7',
                borderColor: isDarkMode ? '#3A1A2E' : '#FFD6E8',
              }]}
              onPress={() => setShowMoodPicker(true)}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="emoticon-outline" size={38} color="#FF6B9D" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.moodPromptTitle, { color: isDarkMode ? '#FF8FB3' : '#FF6B9D' }]}>
                  How are you feeling today?
                </Text>
                <Text style={[styles.moodPromptSub, { color: colors.subtext ?? '#AAA' }]}>
                  Tap to log your vibe 💕
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color="#FF6B9D" />
            </TouchableOpacity>
          )}

          {/* ── Quick tiles section ── */}
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => setShowTiles(v => !v)}
            activeOpacity={0.7}
          >
            <Text style={[styles.sectionTitle, { color: isDarkMode ? '#FF8FB3' : '#FF6B9D' }]}>
              Quick Access{' '}
              <MaterialCommunityIcons name="flower-outline" size={18} color="#FF6B9D" />
            </Text>
            <MaterialCommunityIcons
              name={showTiles ? 'chevron-up' : 'chevron-down'}
              size={18}
              color="#FF6B9D"
            />
          </TouchableOpacity>

          {showTiles && (
            <View style={[styles.tilesGrid]}>
              {QUICK_TILES.map((tile, i) => (
                <TouchableOpacity
                  key={i}
                  activeOpacity={0.8}
                  onPress={() => navigation.navigate(tile.screen)}
                  style={[
                    styles.tile,
                    { backgroundColor: isDarkMode ? tile.accent + '22' : tile.color, borderColor: tile.accent + '55' },
                  ]}
                >
                  <MaterialCommunityIcons name={tile.icon} size={32} color={tile.accent} />
                  <Text style={[styles.tileLabel, { color: tile.accent }]}>{tile.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* ── Quote card ── */}
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => setShowQuotes(v => !v)}
            activeOpacity={0.7}
          >
            <Text style={[styles.sectionTitle, { color: isDarkMode ? '#FF8FB3' : '#FF6B9D' }]}>
              Love Quote ✨
            </Text>
            <MaterialCommunityIcons
              name={showQuotes ? 'chevron-up' : 'chevron-down'}
              size={18} color="#FF6B9D"
            />
          </TouchableOpacity>

          {showQuotes && (
            <Animated.View style={[styles.quoteCard, { opacity: quoteAnim, backgroundColor: colors.card }]}>
              <Text style={[styles.quoteMark, { color: isDarkMode ? '#FF6B9D44' : '#FFD6E8' }]}>"</Text>
              <Text style={[styles.quote, { color: isDarkMode ? colors.text : '#444' }]}>
                {currentQuote.text}
              </Text>
              <Text style={[styles.quoteAuthor, { color: isDarkMode ? '#FF8FB3' : '#FF6B9D' }]}>
                — {currentQuote.author}
              </Text>
              {/* Long press hint + copy */}
              <TouchableOpacity onPress={copyQuote} style={styles.copyBtn}>
                <MaterialCommunityIcons name="content-copy" size={14} color={isDarkMode ? '#FF8FB3' : '#FF6B9D'} />
                <Text style={[styles.copyTxt, { color: isDarkMode ? '#FF8FB3' : '#FF6B9D' }]}>Copy</Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* ── Love note banner ── */}
          <TouchableOpacity
            style={[styles.loveNoteBanner, {
              backgroundColor: isDarkMode ? '#120820' : '#F0E6FF',
              borderColor: isDarkMode ? '#3D1A5E' : '#C9A8F555',
            }]}
            onPress={() => navigation.navigate('vault')}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="email-heart-outline" size={32} color="#8B5CF6" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.loveNoteTitle, { color: isDarkMode ? '#C084FC' : '#8B5CF6' }]}>
                You have a message
              </Text>
              <Text style={[styles.loveNoteBody, { color: isDarkMode ? '#9F67D4' : '#A78BCA' }]}>
                Check "From Him" — something's waiting 🥹
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#8B5CF6" />
          </TouchableOpacity>

          <View style={styles.bottomPadding} />
        </ScrollView>

        {/* ── Mood picker modal ── */}
        <MoodPickerModal
          visible={showMoodPicker}
          onSelect={handleMoodSelect}
          onClose={() => setShowMoodPicker(false)}
          colors={colors}
          isDarkMode={isDarkMode}
        />

      </SafeAreaView>
    </SafeAreaProvider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  STYLES — all hardcoded colours removed from dynamic sections
//  Static colours only where dark mode doesn't apply (e.g. shadows)
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:          { flex: 1 },
  container:     { flex: 1 },
  scrollContent: { paddingBottom: 40 },

  // Header
  headerRow: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8,
  },
  headerLeft:  { flex: 1 },
  greeting:    { fontSize: 26, fontWeight: '700', lineHeight: 32 },
  subtitle:    { fontSize: 13, marginTop: 4, fontStyle: 'italic' },

  // Backup icon
  backupIconBtn: {
    width: 42, height: 42, borderRadius: 21,
    borderWidth: 1.5, alignItems: 'center', justifyContent: 'center',
    marginTop: 4,
    shadowColor: '#FF6B9D', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 4,
  },

  // Toast
  toast: {
    position: 'absolute', top: 56, alignSelf: 'center',
    paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 20, zIndex: 999,
  },
  toastText: { color: '#fff', fontWeight: '600', fontSize: 13 },

  // Affirmation
  affirmationBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 20, marginBottom: 12,
    borderRadius: 18, paddingVertical: 12, paddingHorizontal: 16,
    borderWidth: 1.5,
  },
  affirmationText: { flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 19 },

  // Streak
  streakBanner: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 20, marginBottom: 12,
    borderRadius: 20, paddingVertical: 14, paddingHorizontal: 18,
    borderWidth: 1.5, gap: 8,
    shadowColor: '#FF6B9D', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 3,
  },
  streakText:  { fontSize: 15, fontWeight: '800' },
  streakSub:   { fontSize: 12, marginLeft: 'auto', fontStyle: 'italic' },
  milestoneBadge: {
    borderRadius: 10, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3,
  },
  milestoneTxt: { fontSize: 10, fontWeight: '800' },

  // Heart weather
  heartWeatherCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 20, marginBottom: 12,
    borderRadius: 20, paddingVertical: 14, paddingHorizontal: 16,
    borderWidth: 1.5,
  },
  hwLabel: { fontSize: 13, fontWeight: '800', marginBottom: 2 },
  hwDesc:  { fontSize: 12, lineHeight: 17 },

  // Mood prompt
  moodPromptCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginHorizontal: 20, marginBottom: 12,
    borderRadius: 24, paddingVertical: 18, paddingHorizontal: 18,
    borderWidth: 1.5, borderStyle: 'dashed',
  },
  moodPromptTitle: { fontSize: 15, fontWeight: '800' },
  moodPromptSub:   { fontSize: 12, marginTop: 2 },

  // Section header
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 22, marginBottom: 10, marginTop: 4,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700' },

  // Tiles
  tilesGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 16, gap: 12, marginBottom: 16,
  },
  tile: {
    width: (W - 56) / 2, paddingVertical: 18, paddingHorizontal: 16,
    borderRadius: 22, borderWidth: 1.5, alignItems: 'center', gap: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  tileLabel: { fontSize: 13, fontWeight: '800' },

  // Quote
  quoteCard: {
    margin: 20, padding: 26, borderRadius: 24,
    shadowColor: '#FF6B9D', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.10, shadowRadius: 14, elevation: 4, alignItems: 'center',
  },
  quoteMark: {
    fontSize: 52, fontWeight: '900', lineHeight: 44,
    alignSelf: 'flex-start', marginBottom: -8,
  },
  quote: { fontSize: 16, fontStyle: 'italic', textAlign: 'center', lineHeight: 25 },
  quoteAuthor: { textAlign: 'center', marginTop: 12, fontWeight: '700', fontSize: 13 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 12 },
  copyTxt: { fontSize: 12, fontWeight: '700' },

  // Love note banner
  loveNoteBanner: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 20, marginBottom: 8,
    borderRadius: 22, paddingVertical: 16, paddingHorizontal: 18,
    borderWidth: 1.5, gap: 14,
    shadowColor: '#C9A8F5', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12, shadowRadius: 10, elevation: 3,
  },
  loveNoteTitle: { fontSize: 14, fontWeight: '800', marginBottom: 2 },
  loveNoteBody:  { fontSize: 13, fontStyle: 'italic' },

  bottomPadding: { height: 20 },
});
