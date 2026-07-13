// src/app/(tabs)/faith/services/faithApi.ts

// ─── FREE BIBLE API ──────────────────────────────────────────────────────────
// Uses the free Bible API from https://bible-api.com
const BIBLE_API_URL = 'https://bible-api.com';

export interface BibleVerse {
  reference: string;
  text: string;
  translation: string;
  verses: Array<{ verse: number; text: string }>;
}

export interface BibleSearchResult {
  results: Array<{
    reference: string;
    text: string;
  }>;
}

// ─── FREE HYMNS/CHORDS API ──────────────────────────────────────────────────
// Uses free API from https://api.apis.guru/v2/specs/
// Or we use the Church of Christ Hymnal API (free)
const HYMNS_API_URL = 'https://hymnary.org/api';

// ─── FREE PRAYER API ─────────────────────────────────────────────────────────
// Uses the Prayers API (free) - https://prayer.herokuapp.com/
const PRAYER_API_URL = 'https://prayer.herokuapp.com/api/v1';

// ─── FREE SERMON API ─────────────────────────────────────────────────────────
// Uses SermonAudio API (free) - https://www.sermonaudio.com/api/
const SERMON_API_URL = 'https://www.sermonaudio.com/api/v1';

export class FaithApiService {
  // ─── Bible API ─────────────────────────────────────────────────────────────
  static async getVerseOfTheDay(): Promise<BibleVerse | null> {
    try {
      const response = await fetch(`${BIBLE_API_URL}/?verse=${getVerseOfDay()}`);
      if (!response.ok) throw new Error('Failed to fetch verse');
      return await response.json();
    } catch (error) {
      console.error('Bible API error:', error);
      return null;
    }
  }

  static async searchBible(query: string, translation: string = 'kjv'): Promise<BibleSearchResult | null> {
    try {
      const response = await fetch(`${BIBLE_API_URL}/?search=${encodeURIComponent(query)}&translation=${translation}`);
      if (!response.ok) throw new Error('Search failed');
      return await response.json();
    } catch (error) {
      console.error('Bible search error:', error);
      return null;
    }
  }

  static async getBibleBook(book: string, chapter: string, translation: string = 'kjv'): Promise<BibleVerse | null> {
    try {
      const response = await fetch(`${BIBLE_API_URL}/${book}+${chapter}?translation=${translation}`);
      if (!response.ok) throw new Error('Failed to fetch book');
      return await response.json();
    } catch (error) {
      console.error('Bible book error:', error);
      return null;
    }
  }

  static async getRandomVerse(): Promise<BibleVerse | null> {
    try {
      const response = await fetch(`${BIBLE_API_URL}/?verse=random`);
      if (!response.ok) throw new Error('Failed to fetch random verse');
      return await response.json();
    } catch (error) {
      console.error('Random verse error:', error);
      return null;
    }
  }

  // ─── Hymns API ─────────────────────────────────────────────────────────────
  static async getHymns(query: string): Promise<any> {
    try {
      // Using the Hymnary.org API (free)
      const response = await fetch(`https://hymnary.org/api/hymns?q=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error('Failed to fetch hymns');
      return await response.json();
    } catch (error) {
      console.error('Hymns API error:', error);
      return null;
    }
  }

  static async getHymnLyrics(id: string): Promise<any> {
    try {
      const response = await fetch(`https://hymnary.org/api/hymns/${id}`);
      if (!response.ok) throw new Error('Failed to fetch hymn lyrics');
      return await response.json();
    } catch (error) {
      console.error('Hymn lyrics error:', error);
      return null;
    }
  }

  // ─── Prayers API ───────────────────────────────────────────────────────────
  static async getPrayers(category?: string): Promise<any> {
    try {
      const url = category ? `${PRAYER_API_URL}/prayers/${category}` : `${PRAYER_API_URL}/prayers`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch prayers');
      return await response.json();
    } catch (error) {
      console.error('Prayers API error:', error);
      return null;
    }
  }

  // ─── Sermon API ────────────────────────────────────────────────────────────
  static async getSermons(query?: string): Promise<any> {
    try {
      const url = query ? `${SERMON_API_URL}/search?q=${encodeURIComponent(query)}` : `${SERMON_API_URL}/sermons`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch sermons');
      return await response.json();
    } catch (error) {
      console.error('Sermon API error:', error);
      return null;
    }
  }

  // ─── Lyrics API ────────────────────────────────────────────────────────────
  static async getSongLyrics(artist: string, title: string): Promise<any> {
    try {
      // Using the free Lyrics.ovh API
      const response = await fetch(`https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`);
      if (!response.ok) throw new Error('Failed to fetch lyrics');
      return await response.json();
    } catch (error) {
      console.error('Lyrics API error:', error);
      return null;
    }
  }

  // ─── Worship Songs API ─────────────────────────────────────────────────────
  static async getWorshipSongs(query?: string): Promise<any> {
    try {
      // Using the free SongSelect API
      const url = query ? `https://api.songselect.com/search?q=${encodeURIComponent(query)}` : 'https://api.songselect.com/songs';
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to fetch worship songs');
      return await response.json();
    } catch (error) {
      console.error('Worship songs error:', error);
      return null;
    }
  }
}

function getVerseOfDay(): string {
  const verseMap = [
    'john 3:16',
    'psalms 23:1',
    'jeremiah 29:11',
    'romans 8:28',
    'philippians 4:13',
    'isaiah 40:31',
    'matthew 5:14',
    'romans 15:13',
    '1 corinthians 13:13',
    'proverbs 3:5',
    'psalms 46:10',
    'matthew 11:28',
    'john 14:27',
    'romans 12:12',
    'psalms 34:18',
  ];
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  return verseMap[dayOfYear % verseMap.length];
}
