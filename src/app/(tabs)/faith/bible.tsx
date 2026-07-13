// src/app/(tabs)/faith/bible.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../contexts/ThemeContext';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { FaithApiService, BibleVerse } from './services/faithApi';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TRANSLATIONS = ['kjv', 'web', 'bbe', 'cpdv', 'ylt'];
const BOOKS = ['Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth', '1 Samuel', '2 Samuel', '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra', 'Nehemiah', 'Esther', 'Job', 'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Solomon', 'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos', 'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah', 'Malachi', 'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans', '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians', 'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians', '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews', 'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude', 'Revelation'];

export default function BibleScreen() {
  const { colors, isDarkMode } = useTheme();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [verse, setVerse] = useState<BibleVerse | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedTranslation, setSelectedTranslation] = useState('kjv');
  const [selectedBook, setSelectedBook] = useState('John');
  const [selectedChapter, setSelectedChapter] = useState('3');
  const [showBooks, setShowBooks] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    loadFavorites();
    loadVerse();
  }, [selectedTranslation]);

  const loadFavorites = async () => {
    try {
      const favs = await AsyncStorage.getItem('bible_favorites');
      if (favs) setFavorites(JSON.parse(favs));
    } catch (error) {
      console.error('Error loading favorites:', error);
    }
  };

  const loadVerse = async () => {
    setLoading(true);
    try {
      const data = await FaithApiService.getBibleBook(selectedBook, selectedChapter, selectedTranslation);
      if (data) setVerse(data);
    } catch (error) {
      console.error('Error loading verse:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchBible = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setIsSearching(true);
    try {
      const results = await FaithApiService.searchBible(searchQuery, selectedTranslation);
      if (results) {
        setSearchResults(results.results || []);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = async (reference: string) => {
    let newFavs;
    if (favorites.includes(reference)) {
      newFavs = favorites.filter(f => f !== reference);
    } else {
      newFavs = [...favorites, reference];
    }
    setFavorites(newFavs);
    await AsyncStorage.setItem('bible_favorites', JSON.stringify(newFavs));
  };

  const shareVerse = async () => {
    if (!verse) return;
    try {
      await Share.share({
        message: `📖 ${verse.reference}\n"${verse.text}"\n\n✨ Shared from Nova Faith 💕`,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadVerse();
    setRefreshing(false);
  };

  const renderVerse = () => {
    if (!verse) return null;

    return (
      <View style={[styles.verseContainer, { backgroundColor: colors.card }]}>
        <View style={styles.verseHeader}>
          <Text style={[styles.verseReference, { color: '#8B5CF6' }]}>
            {verse.reference}
          </Text>
          <View style={styles.verseActions}>
            <TouchableOpacity onPress={() => toggleFavorite(verse.reference)}>
              <MaterialCommunityIcons
                name={favorites.includes(verse.reference) ? 'heart' : 'heart-outline'}
                size={22}
                color={favorites.includes(verse.reference) ? '#FF6B9D' : colors.muted}
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={shareVerse}>
              <Icon name="share-outline" size={22} color={colors.muted} />
            </TouchableOpacity>
          </View>
        </View>
        <Text style={[styles.verseText, { color: colors.text }]}>
          {verse.text}
        </Text>
        <Text style={[styles.verseTranslation, { color: colors.muted }]}>
          {verse.translation?.toUpperCase() || selectedTranslation.toUpperCase()}
        </Text>

        <View style={styles.verseVerses}>
          {verse.verses?.map((v, i) => (
            <View key={i} style={styles.verseLine}>
              <Text style={[styles.verseNumber, { color: colors.muted }]}>{v.verse}</Text>
              <Text style={[styles.verseLineText, { color: colors.text }]}>{v.text}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderSearchResults = () => (
    <View style={[styles.searchResults, { backgroundColor: colors.card }]}>
      <Text style={[styles.searchTitle, { color: colors.text }]}>Search Results</Text>
      {searchResults.map((result, index) => (
        <View key={index} style={[styles.resultItem, { borderBottomColor: colors.border }]}>
          <Text style={[styles.resultReference, { color: '#8B5CF6' }]}>{result.reference}</Text>
          <Text style={[styles.resultText, { color: colors.text }]}>{result.text}</Text>
        </View>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Icon name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>📖 Bible</Text>
        <TouchableOpacity onPress={() => setShowBooks(true)} style={styles.menuBtn}>
          <MaterialCommunityIcons name="book-open-page-variant" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Controls */}
      <View style={[styles.controls, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={styles.controlRow}>
          <TouchableOpacity
            style={[styles.controlButton, { backgroundColor: colors.border }]}
            onPress={() => {
              const currentIndex = BOOKS.indexOf(selectedBook);
              if (currentIndex > 0) {
                setSelectedBook(BOOKS[currentIndex - 1]);
                loadVerse();
              }
            }}
          >
            <Icon name="chevron-back" size={20} color={colors.text} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.controlButton, styles.bookButton, { backgroundColor: colors.background }]}
            onPress={() => setShowBooks(!showBooks)}
          >
            <Text style={[styles.bookText, { color: colors.text }]}>{selectedBook}</Text>
            <Icon name="chevron-down" size={16} color={colors.muted} />
          </TouchableOpacity>

          <TextInput
            style={[styles.chapterInput, { color: colors.text, borderColor: colors.border }]}
            value={selectedChapter}
            onChangeText={setSelectedChapter}
            keyboardType="number-pad"
            maxLength={3}
          />

          <TouchableOpacity
            style={[styles.controlButton, { backgroundColor: colors.border }]}
            onPress={() => {
              const currentIndex = BOOKS.indexOf(selectedBook);
              if (currentIndex < BOOKS.length - 1) {
                setSelectedBook(BOOKS[currentIndex + 1]);
                loadVerse();
              }
            }}
          >
            <Icon name="chevron-forward" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Translation selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.translationScroll}>
          {TRANSLATIONS.map((trans) => (
            <TouchableOpacity
              key={trans}
              style={[
                styles.translationChip,
                selectedTranslation === trans && styles.translationChipActive,
                { backgroundColor: selectedTranslation === trans ? '#8B5CF6' : colors.border },
              ]}
              onPress={() => setSelectedTranslation(trans)}
            >
              <Text
                style={[
                  styles.translationText,
                  { color: selectedTranslation === trans ? '#fff' : colors.muted },
                ]}
              >
                {trans.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Search Bar */}
      <View style={[styles.searchBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search the Bible..."
          placeholderTextColor={colors.muted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={searchBible}
        />
        <TouchableOpacity onPress={searchBible} style={[styles.searchBtn, { backgroundColor: '#8B5CF6' }]}>
          <Icon name="search" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B5CF6" />}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#8B5CF6" />
            <Text style={[styles.loadingText, { color: colors.muted }]}>Loading...</Text>
          </View>
        ) : isSearching ? (
          searchResults.length > 0 ? renderSearchResults() : (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="bible" size={48} color={colors.muted} />
              <Text style={[styles.emptyText, { color: colors.text }]}>No results found</Text>
              <Text style={[styles.emptySub, { color: colors.muted }]}>Try a different search term</Text>
            </View>
          )
        ) : (
          renderVerse()
        )}
      </ScrollView>
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
  menuBtn: { padding: 4 },

  // Controls
  controls: {
    padding: 12,
    borderBottomWidth: 1,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  controlButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  bookButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  bookText: { fontSize: 14, fontWeight: '600' },
  chapterInput: {
    width: 44,
    height: 40,
    textAlign: 'center',
    borderWidth: 1,
    borderRadius: 8,
    fontSize: 16,
    fontWeight: '700',
  },

  // Translation
  translationScroll: { marginTop: 10 },
  translationChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 8,
  },
  translationChipActive: { backgroundColor: '#8B5CF6' },
  translationText: { fontSize: 12, fontWeight: '600' },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 8 },
  searchBtn: {
    padding: 10,
    borderRadius: 20,
  },

  // Content
  content: { flex: 1, padding: 16 },
  verseContainer: {
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  verseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  verseReference: { fontSize: 16, fontWeight: '700' },
  verseActions: { flexDirection: 'row', gap: 12 },
  verseText: { fontSize: 18, lineHeight: 28, marginBottom: 8 },
  verseTranslation: { fontSize: 12, opacity: 0.6 },
  verseVerses: { marginTop: 12 },
  verseLine: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  verseNumber: {
    fontSize: 12,
    fontWeight: '700',
    width: 24,
    textAlign: 'right',
  },
  verseLineText: { fontSize: 15, flex: 1, lineHeight: 22 },

  // Search Results
  searchResults: { padding: 16, borderRadius: 16 },
  searchTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  resultItem: { paddingVertical: 10, borderBottomWidth: 1 },
  resultReference: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  resultText: { fontSize: 14, lineHeight: 20 },

  // Loading & Empty
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 },
  loadingText: { marginTop: 12, fontSize: 14 },
  emptyContainer: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptySub: { fontSize: 14, marginTop: 4 },
});
