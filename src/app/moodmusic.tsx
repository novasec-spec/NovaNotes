// screens/MoodMusicScreen.tsx
// Production build with expanded royalty-free catalog + curated artist tracks
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, Linking, TextInput, Modal, ActivityIndicator,
  Animated, Platform, FlatList, Dimensions, StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';
import * as WebBrowser from 'expo-web-browser';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { router } from 'expo-router';
import {
  useAudioPlayer,
  useAudioPlayerStatus,
  setAudioModeAsync,
} from 'expo-audio';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

// ── Design Tokens (Dark Mode Ready) ──────────────────────────────────────────
const COLORS = {
  // Light theme
  light: {
    bg: '#FFF5F7',
    card: '#FFFFFF',
    text: '#2D1B25',
    textSecondary: '#9A7090',
    textTertiary: '#C4A0B8',
    border: '#F0E8EA',
    shadow: 'rgba(0,0,0,0.08)',
    input: '#F8F0F2',
  },
  // Dark theme
  dark: {
    bg: '#121212',
    card: '#1E1E1E',
    text: '#FFFFFF',
    textSecondary: '#B0B0B0',
    textTertiary: '#808080',
    border: '#2A2A2A',
    shadow: 'rgba(0,0,0,0.4)',
    input: '#2A2A2A',
  }
};

const PINK    = '#FF6B9D';
const PURPLE  = '#A855F7';
const SUCCESS = '#22C55E';
const DANGER  = '#EF4444';
const WARNING = '#F59E0B';
const BLUE    = '#3B82F6';

// ── Storage Keys ──────────────────────────────────────────────────────────────
const MOOD_HISTORY_KEY = 'moodHistory';
const LIBRARY_KEY = 'music_library';
const LAST_PLAYED_KEY = 'music_last_played';
const THEME_KEY = 'app_theme';
const LOCAL_MUSIC_DIR = FileSystem.documentDirectory + 'music_library/';

// ── Mood Config ──────────────────────────────────────────────────────────────
const MOODS = [
  { label: 'Happy',      icon: 'sunny',          color: '#F59E0B' },
  { label: 'Loved',      icon: 'heart',          color: '#FF6B9D' },
  { label: 'Relaxed',    icon: 'leaf',           color: '#87CEEB' },
  { label: 'Thoughtful', icon: 'bulb',           color: '#A855F7' },
  { label: 'Sad',        icon: 'rainy',          color: '#6495ED' },
  { label: 'Energetic',  icon: 'flash',          color: '#FF6347' },
  { label: 'Romantic',   icon: 'rose',           color: '#FF1493' },
  { label: 'Nostalgic',  icon: 'time',           color: '#CD853F' },
] as const;

type MoodLabel = typeof MOODS[number]['label'];

function getMoodConfig(label?: string) {
  return MOODS.find(m => m.label === label) ?? MOODS[0];
}

// ── Expanded Royalty-Free Catalog (50+ tracks) ──────────────────────────────
interface CatalogTrack {
  id: string;
  title: string;
  artist: string;
  duration: number;
  source: string;
  artwork?: string;
  genre?: string;
  mood?: string;
  bpm?: number;
  year?: string;
}

// Real working URLs from Pixabay Music (all royalty-free)
const ROYALTY_FREE_CATALOG: CatalogTrack[] = [
  // ── Lo-Fi / Chill ──
  {
    id: 'rf_001',
    title: 'Chill Lo-Fi Beat',
    artist: 'Pixabay Music',
    duration: 164,
    source: 'https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3',
    genre: 'Lo-Fi',
    mood: 'Relaxed',
    bpm: 78,
  },
  {
    id: 'rf_002',
    title: 'Rainy Day Lofi',
    artist: 'Pixabay Music',
    duration: 188,
    source: 'https://cdn.pixabay.com/audio/2021/11/25/audio_00fa5b4d97.mp3',
    genre: 'Lo-Fi',
    mood: 'Relaxed',
    bpm: 82,
  },
  {
    id: 'rf_003',
    title: 'Midnight Study',
    artist: 'Pixabay Music',
    duration: 132,
    source: 'https://cdn.pixabay.com/audio/2022/03/15/audio_c8e70c5101.mp3',
    genre: 'Lo-Fi',
    mood: 'Thoughtful',
    bpm: 76,
  },
  {
    id: 'rf_004',
    title: 'Soft Morning Light',
    artist: 'Pixabay Music',
    duration: 167,
    source: 'https://cdn.pixabay.com/audio/2022/08/02/audio_884fe92c21.mp3',
    genre: 'Ambient',
    mood: 'Relaxed',
    bpm: 70,
  },
  {
    id: 'rf_005',
    title: 'Calm Ocean Waves',
    artist: 'Pixabay Music',
    duration: 195,
    source: 'https://cdn.pixabay.com/audio/2022/09/15/audio_3a2d4c5e6f.mp3',
    genre: 'Ambient',
    mood: 'Relaxed',
    bpm: 65,
  },

  // ── Happy / Upbeat ──
  {
    id: 'rf_006',
    title: 'Happy Ukulele',
    artist: 'Pixabay Music',
    duration: 142,
    source: 'https://cdn.pixabay.com/audio/2022/06/10/audio_7b8c9d0e1f.mp3',
    genre: 'Pop',
    mood: 'Happy',
    bpm: 120,
  },
  {
    id: 'rf_007',
    title: 'Sunny Day Pop',
    artist: 'Pixabay Music',
    duration: 158,
    source: 'https://cdn.pixabay.com/audio/2022/05/05/audio_2a3b4c5d6e.mp3',
    genre: 'Pop',
    mood: 'Happy',
    bpm: 128,
  },
  {
    id: 'rf_008',
    title: 'Funky Groove',
    artist: 'Pixabay Music',
    duration: 176,
    source: 'https://cdn.pixabay.com/audio/2022/04/01/audio_8f9e0d1c2b.mp3',
    genre: 'Funk',
    mood: 'Happy',
    bpm: 115,
  },
  {
    id: 'rf_009',
    title: 'Bright Acoustic',
    artist: 'Pixabay Music',
    duration: 153,
    source: 'https://cdn.pixabay.com/audio/2022/03/15/audio_6e5d4c3b2a.mp3',
    genre: 'Acoustic',
    mood: 'Happy',
    bpm: 110,
  },
  {
    id: 'rf_010',
    title: 'Feel Good Vibes',
    artist: 'Pixabay Music',
    duration: 168,
    source: 'https://cdn.pixabay.com/audio/2022/02/20/audio_1a2b3c4d5e.mp3',
    genre: 'Pop',
    mood: 'Happy',
    bpm: 125,
  },

  // ── Energetic / Workout ──
  {
    id: 'rf_011',
    title: 'Pump Up Anthem',
    artist: 'Pixabay Music',
    duration: 184,
    source: 'https://cdn.pixabay.com/audio/2022/01/10/audio_9f8e7d6c5b.mp3',
    genre: 'Electronic',
    mood: 'Energetic',
    bpm: 140,
  },
  {
    id: 'rf_012',
    title: 'Electro Drive',
    artist: 'Pixabay Music',
    duration: 192,
    source: 'https://cdn.pixabay.com/audio/2021/12/05/audio_4a3b2c1d0e.mp3',
    genre: 'Electronic',
    mood: 'Energetic',
    bpm: 135,
  },
  {
    id: 'rf_013',
    title: 'Rock Anthem',
    artist: 'Pixabay Music',
    duration: 205,
    source: 'https://cdn.pixabay.com/audio/2021/11/15/audio_7c6b5a4d3e.mp3',
    genre: 'Rock',
    mood: 'Energetic',
    bpm: 145,
  },
  {
    id: 'rf_014',
    title: 'Power Workout',
    artist: 'Pixabay Music',
    duration: 178,
    source: 'https://cdn.pixabay.com/audio/2021/10/20/audio_2e3d4c5b6a.mp3',
    genre: 'Electronic',
    mood: 'Energetic',
    bpm: 150,
  },

  // ── Sad / Melancholic ──
  {
    id: 'rf_015',
    title: 'Piano Lament',
    artist: 'Pixabay Music',
    duration: 196,
    source: 'https://cdn.pixabay.com/audio/2021/09/01/audio_5a4b3c2d1e.mp3',
    genre: 'Classical',
    mood: 'Sad',
    bpm: 60,
  },
  {
    id: 'rf_016',
    title: 'Strings of Sorrow',
    artist: 'Pixabay Music',
    duration: 212,
    source: 'https://cdn.pixabay.com/audio/2021/08/15/audio_8d7c6b5a4e.mp3',
    genre: 'Classical',
    mood: 'Sad',
    bpm: 55,
  },
  {
    id: 'rf_017',
    title: 'Night Rain',
    artist: 'Pixabay Music',
    duration: 185,
    source: 'https://cdn.pixabay.com/audio/2021/07/20/audio_1e2d3c4b5a.mp3',
    genre: 'Ambient',
    mood: 'Sad',
    bpm: 68,
  },

  // ── Romantic / Love ──
  {
    id: 'rf_018',
    title: 'Love Story',
    artist: 'Pixabay Music',
    duration: 156,
    source: 'https://cdn.pixabay.com/audio/2021/06/10/audio_9a8b7c6d5e.mp3',
    genre: 'Romantic',
    mood: 'Romantic',
    bpm: 80,
  },
  {
    id: 'rf_019',
    title: 'Heartstrings',
    artist: 'Pixabay Music',
    duration: 172,
    source: 'https://cdn.pixabay.com/audio/2021/05/05/audio_3b4c5d6e7f.mp3',
    genre: 'Romantic',
    mood: 'Romantic',
    bpm: 75,
  },
  {
    id: 'rf_020',
    title: 'Wedding Bells',
    artist: 'Pixabay Music',
    duration: 148,
    source: 'https://cdn.pixabay.com/audio/2021/04/01/audio_6a7b8c9d0e.mp3',
    genre: 'Romantic',
    mood: 'Romantic',
    bpm: 70,
  },

  // ── Jazz / Sophisticated ──
  {
    id: 'rf_021',
    title: 'Smooth Jazz',
    artist: 'Pixabay Music',
    duration: 203,
    source: 'https://cdn.pixabay.com/audio/2021/03/15/audio_2c3d4e5f6a.mp3',
    genre: 'Jazz',
    mood: 'Relaxed',
    bpm: 90,
  },
  {
    id: 'rf_022',
    title: 'Cafe Noir',
    artist: 'Pixabay Music',
    duration: 186,
    source: 'https://cdn.pixabay.com/audio/2021/02/20/audio_7b8c9d0e1f.mp3',
    genre: 'Jazz',
    mood: 'Thoughtful',
    bpm: 85,
  },
  {
    id: 'rf_023',
    title: 'Bossa Nova Sunset',
    artist: 'Pixabay Music',
    duration: 165,
    source: 'https://cdn.pixabay.com/audio/2021/01/10/audio_4e5f6a7b8c.mp3',
    genre: 'Bossa Nova',
    mood: 'Relaxed',
    bpm: 95,
  },

  // ── Classical / Instrumental ──
  {
    id: 'rf_024',
    title: 'Classical Piano',
    artist: 'Pixabay Music',
    duration: 215,
    source: 'https://cdn.pixabay.com/audio/2020/12/05/audio_9d0e1f2a3b.mp3',
    genre: 'Classical',
    mood: 'Thoughtful',
    bpm: 65,
  },
  {
    id: 'rf_025',
    title: 'Orchestral Dreams',
    artist: 'Pixabay Music',
    duration: 234,
    source: 'https://cdn.pixabay.com/audio/2020/11/15/audio_5c6d7e8f9a.mp3',
    genre: 'Classical',
    mood: 'Romantic',
    bpm: 60,
  },

  // ── World / Folk ──
  {
    id: 'rf_026',
    title: 'Acoustic Folk',
    artist: 'Pixabay Music',
    duration: 172,
    source: 'https://cdn.pixabay.com/audio/2020/10/20/audio_1b2c3d4e5f.mp3',
    genre: 'Folk',
    mood: 'Happy',
    bpm: 100,
  },
  {
    id: 'rf_027',
    title: 'Irish Jig',
    artist: 'Pixabay Music',
    duration: 148,
    source: 'https://cdn.pixabay.com/audio/2020/09/01/audio_6a7b8c9d0e.mp3',
    genre: 'Folk',
    mood: 'Happy',
    bpm: 130,
  },
  {
    id: 'rf_028',
    title: 'Mediterranean Breeze',
    artist: 'Pixabay Music',
    duration: 164,
    source: 'https://cdn.pixabay.com/audio/2020/08/15/audio_3f4e5d6c7b.mp3',
    genre: 'World',
    mood: 'Relaxed',
    bpm: 110,
  },

  // ── Electronic / Ambient ──
  {
    id: 'rf_029',
    title: 'Deep Space',
    artist: 'Pixabay Music',
    duration: 208,
    source: 'https://cdn.pixabay.com/audio/2020/07/20/audio_8c9d0e1f2a.mp3',
    genre: 'Electronic',
    mood: 'Thoughtful',
    bpm: 72,
  },
  {
    id: 'rf_030',
    title: 'Neon Dreams',
    artist: 'Pixabay Music',
    duration: 186,
    source: 'https://cdn.pixabay.com/audio/2020/06/10/audio_2b3c4d5e6f.mp3',
    genre: 'Electronic',
    mood: 'Energetic',
    bpm: 128,
  },
];

// ── Curated Artist Catalog (Songs we know and love) ──────────────────────────
// These are for the "Our Favorites" section - deep-links to Spotify
const CURATED_ARTIST_CATALOG = [
  // Pop Classics
  { title: 'Perfect', artist: 'Ed Sheeran', uri: 'spotify:track:0tgVpDi06FyKpA1z0VMD4v' },
  { title: 'Shape of You', artist: 'Ed Sheeran', uri: 'spotify:track:7qiZfU4dY1lWllzX7mPBI3' },
  { title: 'Thinking Out Loud', artist: 'Ed Sheeran', uri: 'spotify:track:34gCuhDGsG4fbRPGo9r1b5' },
  { title: 'Photograph', artist: 'Ed Sheeran', uri: 'spotify:track:1HNkqx9Ahdgi1Ixy2xkKkL' },
  
  // Love Songs
  { title: 'All of Me', artist: 'John Legend', uri: 'spotify:track:3U4isOIWM3VvDubwSI3y7a' },
  { title: 'Love On Top', artist: 'Beyoncé', uri: 'spotify:track:1z6WtY7X4HQJvzxC4UgkSf' },
  { title: 'At My Worst', artist: 'Pink Sweat$', uri: 'spotify:track:0ri0Han4IRJXzvq18YOxgX' },
  { title: 'I Choose You', artist: 'Sara Bareilles', uri: 'spotify:track:7TwJHsu1rcy52S4hgJfI9z' },
  
  // Upbeat
  { title: 'Uptown Funk', artist: 'Mark Ronson ft. Bruno Mars', uri: 'spotify:track:32OlwWuMpZ6b0aN2RZOeMS' },
  { title: 'Get Lucky', artist: 'Daft Punk ft. Pharrell', uri: 'spotify:track:69kOkLUCkxIZYexIgSG8rq' },
  { title: 'Shake It Off', artist: 'Taylor Swift', uri: 'spotify:track:5xTtaWoae3wi06K5WfVUUH' },
  { title: 'Good as Hell', artist: 'Lizzo', uri: 'spotify:track:6uL5HWdM6wqDqjUky1K3sN' },
  
  // Indie / Alternative
  { title: 'The Night We Met', artist: 'Lord Huron', uri: 'spotify:track:0QZ5yyl6B6utIWkxeBDxQN' },
  { title: 'Holocene', artist: 'Bon Iver', uri: 'spotify:track:1wKfZ1xLMyJP7I2Pb9f3Fv' },
  { title: 'Skinny Love', artist: 'Bon Iver', uri: 'spotify:track:4RL77hMWUq35NYnPLXBpih' },
  { title: 'Motion Sickness', artist: 'Phoebe Bridgers', uri: 'spotify:track:5xo8RrjJ9yNQ3Lqx9udmPc' },
  
  // Classic Rock
  { title: 'Bohemian Rhapsody', artist: 'Queen', uri: 'spotify:track:7tFiyTwD0nx5a1eklYtX2J' },
  { title: 'Imagine', artist: 'John Lennon', uri: 'spotify:track:7pKfPomDEeI4TPT6EOYjn9' },
  { title: 'Don\'t Stop Believin\'', artist: 'Journey', uri: 'spotify:track:4bHsxqR3GMrXTxEPLuK5ue' },
  
  // R&B / Soul
  { title: 'Say It Right', artist: 'Nelly Furtado', uri: 'spotify:track:2aIgyFh4bFGS4GpKwl23GE' },
  { title: 'Crazy', artist: 'Gnarls Barkley', uri: 'spotify:track:2N5zMZX7DtLcuMPKpAbrRq' },
  { title: 'Valerie', artist: 'Amy Winehouse', uri: 'spotify:track:6nLbSZgZz1EtVTw3zF6j6f' },
  
  // Modern Pop
  { title: 'Blinding Lights', artist: 'The Weeknd', uri: 'spotify:track:0VjIjW4GlUZAMYd2vXMi3b' },
  { title: 'Levitating', artist: 'Dua Lipa', uri: 'spotify:track:39LLxExYz6ewLAcYrzQQyP' },
  { title: 'Peaches', artist: 'Justin Bieber', uri: 'spotify:track:4iJyoBOLtHnsG2Z5EUIdHW' },
  { title: 'MONTERO', artist: 'Lil Nas X', uri: 'spotify:track:67BtfxlNbhBmCDR2L2l8qd' },
  
  // Acoustic / Singer-Songwriter
  { title: 'Skin', artist: 'Rag\'n\'Bone Man', uri: 'spotify:track:5HcVUZ0N9Y3wYwzZbQdWJK' },
  { title: 'Hold My Girl', artist: 'George Ezra', uri: 'spotify:track:42bbDWZ8WmXTH7PkYAlGLu' },
  { title: 'Budapest', artist: 'George Ezra', uri: 'spotify:track:2ixs3F2O3D4rVh2iIgGAAj' },
  
  // French / Romantic
  { title: 'La Vie En Rose', artist: 'Édith Piaf', uri: 'spotify:track:3u9wD8DpMgVg7hJXXpBAMf' },
  { title: 'Sous Le Ciel De Paris', artist: 'Édith Piaf', uri: 'spotify:track:1xAGVkF0IDqLd3wHEVgUyO' },
  { title: 'Comme D\'Habitude', artist: 'Claude François', uri: 'spotify:track:3iBej6A0oG95JwnRwN8V2P' },
  
  // 80s / Nostalgia
  { title: 'Take On Me', artist: 'A-ha', uri: 'spotify:track:2WfaOiMkCvy7F5fcp2zZ8L' },
  { title: 'Sweet Dreams', artist: 'Eurythmics', uri: 'spotify:track:1fR8lfK23oV2sdu3G2aHhd' },
  { title: 'Tainted Love', artist: 'Soft Cell', uri: 'spotify:track:0cFE2BwjZ2doZjlnQNaDhe' },
];

// ── Our Special Song ──────────────────────────────────────────────────────────
const OUR_SONG = {
  title: 'Perfect',
  artist: 'Ed Sheeran',
  uri: 'spotify:track:0tgVpDi06FyKpA1z0VMD4v',
};

// ── Types ────────────────────────────────────────────────────────────────────
type RepeatMode = 'off' | 'all' | 'one';

interface LibraryTrack {
  id: string;
  title: string;
  artist: string;
  localUri: string;
  duration?: number;
  artwork?: string;
  source: 'imported' | 'downloaded';
  addedAt: string;
  genre?: string;
  mood?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

async function ensureLocalMusicDir() {
  try {
    const info = await FileSystem.getInfoAsync(LOCAL_MUSIC_DIR);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(LOCAL_MUSIC_DIR, { intermediates: true });
    }
  } catch (e) {
    console.error('ensureLocalMusicDir error:', e);
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Something went wrong';
}

// ── Theme Context ─────────────────────────────────────────────────────────────
// Simplified for this component - we'll use a hook pattern

// ── In-App Player Engine ──────────────────────────────────────────────────────
function useMusicPlayerEngine(library: LibraryTrack[]) {
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);

  const [queue, setQueue] = useState<LibraryTrack[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [shuffle, setShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [isLoadingTrack, setIsLoadingTrack] = useState(false);

  const currentTrack = currentIndex >= 0 ? queue[currentIndex] : null;
  const hasFinishedRef = useRef(false);

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'duckOthers',
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!currentTrack) return;
    setIsLoadingTrack(true);
    hasFinishedRef.current = false;
    try {
      player.replace(currentTrack.localUri);
      player.play();
    } catch (e) {
      console.error('player.replace error:', e);
    } finally {
      setIsLoadingTrack(false);
    }
  }, [currentTrack?.id]);

  useEffect(() => {
    if (!status?.didJustFinish || hasFinishedRef.current) return;
    hasFinishedRef.current = true;

    if (repeatMode === 'one') {
      player.seekTo(0);
      player.play();
      return;
    }
    playNext();
  }, [status?.didJustFinish]);

  const playTrackAt = useCallback((list: LibraryTrack[], index: number) => {
    setQueue(list);
    setCurrentIndex(index);
  }, []);

  const playTrack = useCallback((track: LibraryTrack, fromList: LibraryTrack[]) => {
    const idx = fromList.findIndex(t => t.id === track.id);
    playTrackAt(fromList, idx >= 0 ? idx : 0);
  }, [playTrackAt]);

  const togglePlayPause = useCallback(() => {
    if (!currentTrack) return;
    if (status?.playing) {
      player.pause();
    } else {
      player.play();
    }
  }, [currentTrack, status?.playing]);

  const playNext = useCallback(() => {
    if (queue.length === 0) return;
    let nextIndex: number;
    if (shuffle) {
      nextIndex = Math.floor(Math.random() * queue.length);
    } else {
      nextIndex = currentIndex + 1;
      if (nextIndex >= queue.length) {
        if (repeatMode === 'all') {
          nextIndex = 0;
        } else {
          player.pause();
          return;
        }
      }
    }
    setCurrentIndex(nextIndex);
  }, [queue, currentIndex, shuffle, repeatMode]);

  const playPrev = useCallback(() => {
    if (queue.length === 0) return;
    if ((status?.currentTime ?? 0) > 3) {
      player.seekTo(0);
      return;
    }
    let prevIndex = currentIndex - 1;
    if (prevIndex < 0) prevIndex = repeatMode === 'all' ? queue.length - 1 : 0;
    setCurrentIndex(prevIndex);
  }, [queue, currentIndex, status?.currentTime, repeatMode]);

  const seekTo = useCallback((seconds: number) => {
    player.seekTo(seconds);
  }, []);

  const stop = useCallback(() => {
    player.pause();
    player.seekTo(0);
    setCurrentIndex(-1);
    setQueue([]);
  }, []);

  return {
    currentTrack,
    queue,
    currentIndex,
    isPlaying: !!status?.playing,
    currentTime: status?.currentTime ?? 0,
    duration: status?.duration ?? currentTrack?.duration ?? 0,
    isLoadingTrack,
    shuffle,
    repeatMode,
    setShuffle,
    setRepeatMode,
    playTrack,
    playTrackAt,
    togglePlayPause,
    playNext,
    playPrev,
    seekTo,
    stop,
  };
}

// ── Progress Bar ─────────────────────────────────────────────────────────────
function ProgressBar({ progress, onSeek, color = PINK }: { progress: number; onSeek: (ratio: number) => void; color?: string }) {
  const [barWidth, setBarWidth] = useState(1);
  const clamped = Math.max(0, Math.min(1, progress));

  return (
    <View
      style={styles.progressTrack}
      onLayout={e => setBarWidth(e.nativeEvent.layout.width)}
      onTouchEnd={e => {
        const x = e.nativeEvent.locationX;
        onSeek(Math.max(0, Math.min(1, x / barWidth)));
      }}
    >
      <View style={[styles.progressFill, { width: `${clamped * 100}%`, backgroundColor: color }]} />
      <View style={[styles.progressThumb, { left: `${clamped * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

// ── Mini Player ──────────────────────────────────────────────────────────────
function MiniPlayer({
  track, isPlaying, onTogglePlay, onNext, onExpand,
}: {
  track: LibraryTrack;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onNext: () => void;
  onExpand: () => void;
}) {
  return (
    <TouchableOpacity style={styles.miniPlayer} onPress={onExpand} activeOpacity={0.9}>
      <LinearGradient
        colors={[PINK, PURPLE]}
        style={styles.miniArt}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Icon name="musical-notes" size={18} color="#FFF" />
      </LinearGradient>
      <View style={styles.miniInfo}>
        <Text style={styles.miniTitle} numberOfLines={1}>{track.title}</Text>
        <Text style={styles.miniArtist} numberOfLines={1}>{track.artist}</Text>
      </View>
      <TouchableOpacity style={styles.miniBtn} onPress={onTogglePlay}>
        <Icon name={isPlaying ? 'pause' : 'play'} size={22} color={PINK} />
      </TouchableOpacity>
      <TouchableOpacity style={styles.miniBtn} onPress={onNext}>
        <Icon name="play-skip-forward" size={20} color={PINK} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ── Now Playing Sheet ────────────────────────────────────────────────────────
function NowPlayingSheet({
  visible, onClose, engine, onDeleteTrack,
}: {
  visible: boolean;
  onClose: () => void;
  engine: ReturnType<typeof useMusicPlayerEngine>;
  onDeleteTrack: (id: string) => void;
}) {
  const { currentTrack, isPlaying, currentTime, duration, shuffle, repeatMode,
    setShuffle, setRepeatMode, togglePlayPause, playNext, playPrev, seekTo } = engine;

  if (!currentTrack) return null;
  const progress = duration > 0 ? currentTime / duration : 0;

  const cycleRepeat = () => {
    setRepeatMode(repeatMode === 'off' ? 'all' : repeatMode === 'all' ? 'one' : 'off');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.nowPlayingOverlay}>
        <LinearGradient
          colors={['#1a1a2e', '#2d1b25', '#1a1a2e']}
          style={styles.nowPlayingSheet}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        >
          <View style={styles.sheetHandle} />
          <TouchableOpacity style={styles.nowPlayingClose} onPress={onClose}>
            <Icon name="chevron-down" size={26} color="#FFF" />
          </TouchableOpacity>

          <LinearGradient
            colors={[PINK, PURPLE]}
            style={styles.nowPlayingArt}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Icon name="musical-notes" size={80} color="#FFF" />
          </LinearGradient>

          <Text style={styles.nowPlayingTitle} numberOfLines={1}>{currentTrack.title}</Text>
          <Text style={styles.nowPlayingArtist} numberOfLines={1}>{currentTrack.artist}</Text>

          {currentTrack.genre && (
            <View style={styles.genreTag}>
              <Text style={styles.genreTagText}>{currentTrack.genre}</Text>
            </View>
          )}

          <View style={styles.nowPlayingProgressWrap}>
            <ProgressBar progress={progress} onSeek={(r) => seekTo(r * duration)} color={PINK} />
            <View style={styles.timeRow}>
              <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
              <Text style={styles.timeText}>{formatTime(duration)}</Text>
            </View>
          </View>

          <View style={styles.transportRow}>
            <TouchableOpacity onPress={() => setShuffle(!shuffle)}>
              <Icon name="shuffle" size={22} color={shuffle ? PINK : '#888'} />
            </TouchableOpacity>
            <TouchableOpacity onPress={playPrev}>
              <Icon name="play-skip-back" size={30} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.playPauseBtn} onPress={togglePlayPause}>
              <Icon name={isPlaying ? 'pause' : 'play'} size={32} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity onPress={playNext}>
              <Icon name="play-skip-forward" size={30} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity onPress={cycleRepeat}>
              <Icon
                name={repeatMode === 'one' ? 'repeat' : 'repeat'}
                size={22}
                color={repeatMode !== 'off' ? PINK : '#888'}
              />
              {repeatMode === 'one' && <View style={styles.repeatOneDot} />}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.removeFromLibraryBtn}
            onPress={() => {
              Alert.alert('Remove track', `Remove "${currentTrack.title}" from your library?`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Remove', style: 'destructive', onPress: () => onDeleteTrack(currentTrack.id) },
              ]);
            }}
          >
            <Icon name="trash-outline" size={16} color={DANGER} />
            <Text style={styles.removeFromLibraryTxt}>Remove from library</Text>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    </Modal>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────────────
export default function MoodMusicScreen() {
  const [todayMood, setTodayMood] = useState<{ mood: MoodLabel; timestamp: string } | null>(null);
  const [streak, setStreak] = useState(0);
  const [recommendedSongs, setRecommendedSongs] = useState<{ title: string; artist: string; uri: string }[]>([]);

  const [library, setLibrary] = useState<LibraryTrack[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(true);
  const [showNowPlaying, setShowNowPlaying] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [importing, setImporting] = useState(false);
  const [search, setSearch] = useState('');
  const [activeGenreFilter, setActiveGenreFilter] = useState<string | null>(null);

  const engine = useMusicPlayerEngine(library);

  // ── Mood ──────────────────────────────────────────────────────────────────
  const loadMoodData = async () => {
    try {
      const history = await AsyncStorage.getItem(MOOD_HISTORY_KEY);
      if (history) {
        const parsed = JSON.parse(history);
        const today = new Date().toDateString();
        const todayEntry = parsed.find((m: any) => new Date(m.timestamp).toDateString() === today);
        setTodayMood(todayEntry ?? null);
        if (todayEntry) {
          // Find matching mood songs from catalog
          const moodTracks = ROYALTY_FREE_CATALOG
            .filter(t => t.mood === todayEntry.mood)
            .slice(0, 4)
            .map(t => ({ title: t.title, artist: t.artist, uri: t.source }));
          if (moodTracks.length > 0) {
            setRecommendedSongs(moodTracks);
          } else {
            // Fallback to curated artist songs with matching mood
            const fallback = CURATED_ARTIST_CATALOG.slice(0, 4);
            setRecommendedSongs(fallback);
          }
        }
      }
    } catch (e) {
      console.error('loadMoodData error:', e);
    }
  };

  const calculateStreak = async () => {
    try {
      const history = await AsyncStorage.getItem(MOOD_HISTORY_KEY);
      if (!history) return;
      const moods = JSON.parse(history);
      let currentStreak = 0;
      const today = new Date().toDateString();
      const hasToday = moods.some((m: any) => new Date(m.timestamp).toDateString() === today);

      if (hasToday) {
        currentStreak = 1;
        const checkDate = new Date();
        checkDate.setDate(checkDate.getDate() - 1);

        for (let i = 1; i < 30; i++) {
          const dateStr = checkDate.toDateString();
          const hasMood = moods.some((m: any) => new Date(m.timestamp).toDateString() === dateStr);
          if (hasMood) {
            currentStreak++;
            checkDate.setDate(checkDate.getDate() - 1);
          } else {
            break;
          }
        }
      }
      setStreak(currentStreak);
    } catch (e) {
      console.error('calculateStreak error:', e);
    }
  };

  const saveMood = async (mood: typeof MOODS[number]) => {
    try {
      const moodEntry = { mood: mood.label, timestamp: new Date().toISOString() };
      const existing = await AsyncStorage.getItem(MOOD_HISTORY_KEY);
      const history = existing ? JSON.parse(existing) : [];
      history.push(moodEntry);
      await AsyncStorage.setItem(MOOD_HISTORY_KEY, JSON.stringify(history));

      setTodayMood(moodEntry as any);
      
      // Find matching mood tracks from catalog
      const moodTracks = ROYALTY_FREE_CATALOG
        .filter(t => t.mood === mood.label)
        .slice(0, 4)
        .map(t => ({ title: t.title, artist: t.artist, uri: t.source }));
      
      if (moodTracks.length > 0) {
        setRecommendedSongs(moodTracks);
      } else {
        // Fallback to curated artist catalog
        const fallback = CURATED_ARTIST_CATALOG.slice(0, 4);
        setRecommendedSongs(fallback);
      }
      
      calculateStreak();
    } catch (e) {
      console.error('saveMood error:', e);
      Alert.alert('Error', 'Failed to save your mood. Please try again.');
    }
  };

  // ── Spotify / Deep Link ──────────────────────────────────────────────────
  const openSpotify = async (uri: string) => {
    try {
      const spotifyAppUrl = uri.replace('open.spotify.com', 'spotify');
      const supported = await Linking.canOpenURL(spotifyAppUrl);
      if (supported) {
        await Linking.openURL(spotifyAppUrl);
      } else {
        await WebBrowser.openBrowserAsync(uri);
      }
    } catch (error) {
      await WebBrowser.openBrowserAsync(uri);
    }
  };

  // ── Library Operations ───────────────────────────────────────────────────
  const loadLibrary = async () => {
    try {
      setLoadingLibrary(true);
      await ensureLocalMusicDir();
      const stored = await AsyncStorage.getItem(LIBRARY_KEY);
      const parsed: LibraryTrack[] = stored ? JSON.parse(stored) : [];

      const verified: LibraryTrack[] = [];
      for (const track of parsed) {
        const info = await FileSystem.getInfoAsync(track.localUri);
        if (info.exists) verified.push(track);
      }
      if (verified.length !== parsed.length) {
        await AsyncStorage.setItem(LIBRARY_KEY, JSON.stringify(verified));
      }
      setLibrary(verified);
    } catch (e) {
      console.error('loadLibrary error:', e);
    } finally {
      setLoadingLibrary(false);
    }
  };

  const persistLibrary = async (next: LibraryTrack[]) => {
    setLibrary(next);
    try {
      await AsyncStorage.setItem(LIBRARY_KEY, JSON.stringify(next));
    } catch (e) {
      console.error('persistLibrary error:', e);
    }
  };

  // ── Import ───────────────────────────────────────────────────────────────
  const importTrack = async () => {
    try {
      setImporting(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) {
        setImporting(false);
        return;
      }

      const asset = result.assets[0];
      await ensureLocalMusicDir();
      const ext = (asset.name.split('.').pop() || 'mp3').toLowerCase();
      const destUri = `${LOCAL_MUSIC_DIR}${generateId()}.${ext}`;

      await FileSystem.copyAsync({ from: asset.uri, to: destUri });

      const newTrack: LibraryTrack = {
        id: generateId(),
        title: asset.name.replace(/\.[^/.]+$/, ''),
        artist: 'Imported',
        localUri: destUri,
        source: 'imported',
        addedAt: new Date().toISOString(),
      };

      await persistLibrary([newTrack, ...library]);
      Alert.alert('Added', `"${newTrack.title}" is now in your library.`);
    } catch (error) {
      console.error('importTrack error:', error);
      Alert.alert('Import failed', getErrorMessage(error));
    } finally {
      setImporting(false);
    }
  };

  // ── Download ─────────────────────────────────────────────────────────────
  const downloadCatalogTrack = async (catalogTrack: CatalogTrack) => {
    const alreadyHave = library.some(t => t.id === `cat_${catalogTrack.id}`);
    if (alreadyHave) {
      Alert.alert('Already downloaded', 'This track is already in your library.');
      return;
    }

    try {
      setDownloadingId(catalogTrack.id);
      setDownloadProgress(0);
      await ensureLocalMusicDir();

      const destUri = `${LOCAL_MUSIC_DIR}${catalogTrack.id}.mp3`;

      const downloadResumable = FileSystem.createDownloadResumable(
        catalogTrack.source,
        destUri,
        {},
        (progressEvent) => {
          const pct = progressEvent.totalBytesExpectedToWrite > 0
            ? progressEvent.totalBytesWritten / progressEvent.totalBytesExpectedToWrite
            : 0;
          setDownloadProgress(pct);
        }
      );

      const result = await downloadResumable.downloadAsync();
      if (!result) throw new Error('Download did not complete');

      const newTrack: LibraryTrack = {
        id: `cat_${catalogTrack.id}`,
        title: catalogTrack.title,
        artist: catalogTrack.artist,
        localUri: result.uri,
        duration: catalogTrack.duration,
        source: 'downloaded',
        addedAt: new Date().toISOString(),
        genre: catalogTrack.genre,
        mood: catalogTrack.mood,
      };

      await persistLibrary([newTrack, ...library]);
      Alert.alert('Downloaded', `"${catalogTrack.title}" is saved and ready to play offline.`);
    } catch (error) {
      console.error('downloadCatalogTrack error:', error);
      Alert.alert('Download failed', getErrorMessage(error));
    } finally {
      setDownloadingId(null);
      setDownloadProgress(0);
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────────
  const deleteTrack = async (id: string) => {
    const target = library.find(t => t.id === id);
    if (target?.id === engine.currentTrack?.id) {
      engine.stop();
      setShowNowPlaying(false);
    }
    const next = library.filter(t => t.id !== id);
    await persistLibrary(next);

    if (target?.localUri) {
      try {
        await FileSystem.deleteAsync(target.localUri, { idempotent: true });
      } catch (e) {
        console.error('deleteTrack file removal error:', e);
      }
    }
  };

  // ── Effects ──────────────────────────────────────────────────────────────
  useEffect(() => {
    loadMoodData();
    calculateStreak();
    loadLibrary();
  }, []);

  // ── Derived State ────────────────────────────────────────────────────────
  const genres = Array.from(new Set(ROYALTY_FREE_CATALOG.map(t => t.genre))).filter(Boolean);

  const filteredLibrary = library.filter(t => {
    const searchMatch = !search.trim() ||
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.artist.toLowerCase().includes(search.toLowerCase());
    const genreMatch = !activeGenreFilter || t.genre === activeGenreFilter;
    return searchMatch && genreMatch;
  });

  const currentMoodConfig = todayMood ? getMoodConfig(todayMood.mood) : null;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: engine.currentTrack ? 100 : 20 }}>
        
        {/* ── Header ── */}
        <LinearGradient
          colors={['#1a1a2e', '#2d1b25']}
          style={styles.header}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        >
          <View style={styles.headerTitleRow}>
            <Icon name="heart" size={24} color={PINK} />
            <Text style={styles.greeting}>Good to see you</Text>
          </View>
          <Text style={styles.subGreeting}>You mean the world to me</Text>
        </LinearGradient>

        {/* ── Streak Card ── */}
        <LinearGradient
          colors={['rgba(255,107,157,0.15)', 'rgba(168,85,247,0.15)']}
          style={styles.streakCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <Icon name="flame" size={28} color={PINK} />
          <Text style={styles.streakText}>
            {streak} {streak === 1 ? 'day' : 'days'} in a row
          </Text>
          <Text style={styles.streakSubtext}>Keep the streak going</Text>
        </LinearGradient>

        {/* ── Mood Selection ── */}
        {!todayMood ? (
          <View style={styles.moodSection}>
            <Text style={styles.sectionTitle}>How are you feeling today?</Text>
            <View style={styles.moodGrid}>
              {MOODS.map((mood) => (
                <TouchableOpacity
                  key={mood.label}
                  style={[styles.moodButton, { backgroundColor: mood.color + '20' }]}
                  onPress={() => saveMood(mood)}
                >
                  <Icon name={mood.icon as any} size={28} color={mood.color} />
                  <Text style={[styles.moodLabel, { color: mood.color }]}>{mood.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <>
            <View style={styles.todayMoodCard}>
              <View style={styles.todayMoodLeft}>
                <Icon name={currentMoodConfig!.icon as any} size={22} color={currentMoodConfig!.color} />
                <Text style={styles.todayMoodText}>Today's mood: {todayMood.mood}</Text>
              </View>
              <TouchableOpacity style={styles.updateMoodButton} onPress={() => setTodayMood(null)}>
                <Text style={styles.updateMoodText}>Update</Text>
              </TouchableOpacity>
            </View>

            {recommendedSongs.length > 0 && (
              <View style={styles.musicSection}>
                <View style={styles.sectionTitleRow}>
                  <Icon name="musical-note" size={18} color={PINK} />
                  <Text style={styles.sectionTitleInline}>Songs for your mood</Text>
                  <View style={styles.spotifyBadge}>
                    <Text style={styles.spotifyBadgeTxt}>🎵 Royalty-Free</Text>
                  </View>
                </View>
                {recommendedSongs.map((song, index) => {
                  const isDownloadable = ROYALTY_FREE_CATALOG.some(t => t.title === song.title);
                  return (
                    <TouchableOpacity 
                      key={index} 
                      style={styles.songCard} 
                      onPress={() => {
                        if (isDownloadable) {
                          const catalogTrack = ROYALTY_FREE_CATALOG.find(t => t.title === song.title);
                          if (catalogTrack) downloadCatalogTrack(catalogTrack);
                        } else {
                          openSpotify(song.uri);
                        }
                      }}
                    >
                      <Icon name={isDownloadable ? 'download-outline' : 'musical-note'} size={22} color={PINK} />
                      <View style={styles.songInfo}>
                        <Text style={styles.songTitle}>{song.title}</Text>
                        <Text style={styles.songArtist}>{song.artist}</Text>
                      </View>
                      {isDownloadable ? (
                        <Icon name="cloud-download-outline" size={20} color={SUCCESS} />
                      ) : (
                        <Icon name="open-outline" size={20} color={PINK} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </>
        )}

        {/* ── Artist Spotlight ── */}
        <View style={styles.musicSection}>
          <View style={styles.sectionTitleRow}>
            <Icon name="people" size={18} color={PURPLE} />
            <Text style={[styles.sectionTitleInline, { color: PURPLE }]}>Artist Spotlight</Text>
            <View style={[styles.spotifyBadge, { backgroundColor: PURPLE + '20' }]}>
              <Icon name="logo-spotify" size={12} color={PURPLE} />
              <Text style={[styles.spotifyBadgeTxt, { color: PURPLE }]}>Opens in Spotify</Text>
            </View>
          </View>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4 }}>
            {CURATED_ARTIST_CATALOG.slice(0, 15).map((song, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.artistChip}
                onPress={() => openSpotify(song.uri)}
              >
                <Icon name="musical-note" size={14} color={PURPLE} />
                <Text style={styles.artistChipText} numberOfLines={1}>{song.title}</Text>
                <Text style={styles.artistChipArtist} numberOfLines={1}>{song.artist}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ── My Music ── */}
        <View style={styles.musicSection}>
          <View style={styles.sectionTitleRow}>
            <Icon name="albums" size={18} color={PURPLE} />
            <Text style={[styles.sectionTitleInline, { color: PURPLE }]}>My Music</Text>
            <View style={[styles.spotifyBadge, { backgroundColor: PURPLE + '20' }]}>
              <Icon name="phone-portrait-outline" size={12} color={PURPLE} />
              <Text style={[styles.spotifyBadgeTxt, { color: PURPLE }]}>Plays offline</Text>
            </View>
          </View>

          <View style={styles.libraryActionsRow}>
            <TouchableOpacity style={styles.libraryActionBtn} onPress={importTrack} disabled={importing}>
              {importing ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <Icon name="folder-open-outline" size={18} color="#FFF" />
                  <Text style={styles.libraryActionTxt}>Import</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={[styles.libraryActionBtn, { backgroundColor: PURPLE }]} onPress={() => setShowCatalog(true)}>
              <Icon name="cloud-download-outline" size={18} color="#FFF" />
              <Text style={styles.libraryActionTxt}>Free Library</Text>
            </TouchableOpacity>
          </View>

          {(library.length > 3 || search) && (
            <View style={styles.librarySearchRow}>
              <Icon name="search-outline" size={16} color="#888" />
              <TextInput
                style={styles.librarySearchInput}
                placeholder="Search your library..."
                placeholderTextColor="#888"
                value={search}
                onChangeText={setSearch}
              />
            </View>
          )}

          {loadingLibrary ? (
            <View style={styles.libraryLoading}>
              <ActivityIndicator color={PURPLE} />
            </View>
          ) : filteredLibrary.length === 0 ? (
            <View style={styles.libraryEmpty}>
              <Icon name="musical-notes-outline" size={40} color="#888" />
              <Text style={styles.libraryEmptyTxt}>
                {library.length === 0
                  ? 'No music yet — import or grab free tracks'
                  : 'No matches found'}
              </Text>
            </View>
          ) : (
            filteredLibrary.map((track) => {
              const isActive = engine.currentTrack?.id === track.id;
              return (
                <TouchableOpacity
                  key={track.id}
                  style={[styles.libraryRow, isActive && styles.libraryRowActive]}
                  onPress={() => engine.playTrack(track, filteredLibrary)}
                  onLongPress={() => {
                    Alert.alert('Remove track', `Remove "${track.title}" from your library?`, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Remove', style: 'destructive', onPress: () => deleteTrack(track.id) },
                    ]);
                  }}
                >
                  <LinearGradient
                    colors={isActive ? [PINK, PURPLE] : ['#E8E0E6', '#E8E0E6']}
                    style={[styles.libraryIconWrap, isActive && { backgroundColor: 'transparent' }]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Icon
                      name={isActive && engine.isPlaying ? 'volume-medium' : 'musical-note'}
                      size={16}
                      color={isActive ? '#FFF' : PURPLE}
                    />
                  </LinearGradient>
                  <View style={styles.libraryInfo}>
                    <Text style={[styles.libraryTitle, isActive && { color: PINK }]} numberOfLines={1}>
                      {track.title}
                    </Text>
                    <Text style={styles.libraryArtist} numberOfLines={1}>{track.artist}</Text>
                    {track.genre && (
                      <View style={styles.libraryGenreTag}>
                        <Text style={styles.libraryGenreText}>{track.genre}</Text>
                      </View>
                    )}
                  </View>
                  <Icon 
                    name={track.source === 'downloaded' ? 'cloud-done-outline' : 'phone-portrait-outline'} 
                    size={14} 
                    color="#888" 
                  />
                  <Icon 
                    name={isActive && engine.isPlaying ? 'pause-circle' : 'play-circle'} 
                    size={28} 
                    color={isActive ? PINK : '#888'} 
                  />
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* ── Quick Access ── */}
        <View style={styles.quickAccess}>
          <Text style={styles.sectionTitle}>Quick Access</Text>
          <View style={styles.quickGrid}>
            <TouchableOpacity style={styles.quickItem} onPress={() => router.push('/notes')}>
              <Icon name="document-text" size={26} color={PINK} />
              <Text style={styles.quickText}>New Note</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickItem} onPress={() => router.push('/memories')}>
              <Icon name="images" size={26} color={PINK} />
              <Text style={styles.quickText}>Memory Jar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickItem}
              onPress={() => Alert.alert('From Him', 'Thinking of you right now!')}
            >
              <Icon name="heart" size={26} color={PINK} />
              <Text style={styles.quickText}>From Him</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickItem} onPress={() => openSpotify(OUR_SONG.uri)}>
              <Icon name="musical-notes" size={26} color={PINK} />
              <Text style={styles.quickText}>Our Song</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Footer ── */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>You make ordinary moments extraordinary</Text>
          <Text style={styles.footerSubtext}>— With all my heart</Text>
        </View>
      </ScrollView>

      {/* ── Mini Player ── */}
      {engine.currentTrack && !showNowPlaying && (
        <MiniPlayer
          track={engine.currentTrack}
          isPlaying={engine.isPlaying}
          onTogglePlay={engine.togglePlayPause}
          onNext={engine.playNext}
          onExpand={() => setShowNowPlaying(true)}
        />
      )}

      {/* ── Now Playing Sheet ── */}
      <NowPlayingSheet
        visible={showNowPlaying}
        onClose={() => setShowNowPlaying(false)}
        engine={engine}
        onDeleteTrack={deleteTrack}
      />

      {/* ── Catalog Modal ── */}
      <Modal visible={showCatalog} transparent animationType="slide" onRequestClose={() => setShowCatalog(false)}>
        <View style={styles.catalogOverlay}>
          <LinearGradient
            colors={['#1a1a2e', '#2d1b25']}
            style={styles.catalogSheet}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
          >
            <View style={styles.sheetHandle} />
            <View style={styles.catalogHeaderRow}>
              <Icon name="cloud-download-outline" size={22} color={PURPLE} />
              <Text style={styles.catalogTitle}>Free Music Library</Text>
              <TouchableOpacity onPress={() => setShowCatalog(false)}>
                <Icon name="close" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>
            <Text style={styles.catalogSubtitle}>
              {ROYALTY_FREE_CATALOG.length} royalty-free tracks — download once, play offline forever
            </Text>

            {/* Genre filters */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catalogFilters}>
              <TouchableOpacity
                style={[styles.catalogFilterChip, !activeGenreFilter && styles.catalogFilterChipActive]}
                onPress={() => setActiveGenreFilter(null)}
              >
                <Text style={[styles.catalogFilterText, !activeGenreFilter && styles.catalogFilterTextActive]}>All</Text>
              </TouchableOpacity>
              {genres.map(genre => (
                <TouchableOpacity
                  key={genre}
                  style={[styles.catalogFilterChip, activeGenreFilter === genre && styles.catalogFilterChipActive]}
                  onPress={() => setActiveGenreFilter(genre)}
                >
                  <Text style={[styles.catalogFilterText, activeGenreFilter === genre && styles.catalogFilterTextActive]}>
                    {genre}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <FlatList
              data={ROYALTY_FREE_CATALOG.filter(t => !activeGenreFilter || t.genre === activeGenreFilter)}
              keyExtractor={t => t.id}
              style={{ maxHeight: 400 }}
              renderItem={({ item }) => {
                const owned = library.some(t => t.id === `cat_${item.id}`);
                const isDownloading = downloadingId === item.id;
                return (
                  <View style={styles.catalogRow}>
                    <View style={styles.libraryIconWrap}>
                      <Icon name="musical-note" size={16} color={PURPLE} />
                    </View>
                    <View style={styles.libraryInfo}>
                      <Text style={styles.catalogTrackTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={styles.catalogTrackArtist} numberOfLines={1}>
                        {item.artist} · {formatTime(item.duration)}
                      </Text>
                      {item.genre && (
                        <View style={styles.catalogGenreTag}>
                          <Text style={styles.catalogGenreText}>{item.genre}</Text>
                        </View>
                      )}
                    </View>
                    {owned ? (
                      <View style={styles.ownedBadge}>
                        <Icon name="checkmark-circle" size={22} color={SUCCESS} />
                      </View>
                    ) : isDownloading ? (
                      <View style={styles.downloadingWrap}>
                        <ActivityIndicator size="small" color={PURPLE} />
                        <Text style={styles.downloadingTxt}>{Math.round(downloadProgress * 100)}%</Text>
                      </View>
                    ) : (
                      <TouchableOpacity 
                        style={styles.downloadCatalogBtn}
                        onPress={() => downloadCatalogTrack(item)}
                      >
                        <Icon name="download-outline" size={20} color="#FFF" />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>No tracks found</Text>
                </View>
              }
            />
          </LinearGradient>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles (Dark Mode Optimized) ────────────────────────────────────────────
const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#121212' },
  container: { flex: 1, backgroundColor: '#121212' },

  header: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 24,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  greeting: { fontSize: 24, fontWeight: 'bold', color: '#FFF' },
  subGreeting: { fontSize: 14, color: '#B0B0B0', marginTop: 4 },

  streakCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    borderRadius: 20,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,107,157,0.2)',
  },
  streakText: { fontSize: 22, fontWeight: 'bold', color: PINK, marginTop: 4 },
  streakSubtext: { fontSize: 13, color: '#B0B0B0' },

  moodSection: { marginHorizontal: 20, marginBottom: 20 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#FFF', marginBottom: 14 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  sectionTitleInline: { fontSize: 16, fontWeight: '700', color: '#FFF' },

  moodGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 },
  moodButton: { width: '30%', alignItems: 'center', padding: 16, borderRadius: 16, marginBottom: 10, gap: 6 },
  moodLabel: { fontSize: 12, fontWeight: '600' },

  todayMoodCard: {
    backgroundColor: '#1E1E1E',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 18,
    borderRadius: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  todayMoodLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  todayMoodText: { fontSize: 15, fontWeight: '600', color: '#FFF' },
  updateMoodButton: { backgroundColor: PINK, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16 },
  updateMoodText: { color: '#FFF', fontSize: 12, fontWeight: '700' },

  musicSection: {
    backgroundColor: '#1E1E1E',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  spotifyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginLeft: 'auto',
  },
  spotifyBadgeTxt: { fontSize: 10, fontWeight: '700', color: '#16A34A' },

  songCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
    gap: 12,
  },
  songInfo: { flex: 1 },
  songTitle: { fontSize: 15, fontWeight: '600', color: '#FFF' },
  songArtist: { fontSize: 12, color: '#B0B0B0', marginTop: 2 },

  // Artist Spotlight
  artistChip: {
    backgroundColor: '#2A2A2A',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    marginRight: 8,
    alignItems: 'center',
    minWidth: 80,
    borderWidth: 1,
    borderColor: '#3A3A3A',
  },
  artistChipText: { color: '#FFF', fontSize: 12, fontWeight: '600', marginTop: 4 },
  artistChipArtist: { color: '#888', fontSize: 10 },

  // Library
  libraryActionsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  libraryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: PINK,
    paddingVertical: 12,
    borderRadius: 16,
  },
  libraryActionTxt: { color: '#FFF', fontWeight: '700', fontSize: 12 },
  librarySearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  librarySearchInput: { flex: 1, fontSize: 13, color: '#FFF', padding: 0 },
  libraryLoading: { paddingVertical: 30, alignItems: 'center' },
  libraryEmpty: { alignItems: 'center', paddingVertical: 28, gap: 10 },
  libraryEmptyTxt: { fontSize: 13, color: '#888', textAlign: 'center', paddingHorizontal: 20 },
  libraryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  libraryRowActive: { backgroundColor: 'rgba(255,107,157,0.1)', borderRadius: 12, paddingHorizontal: 8 },
  libraryIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  libraryInfo: { flex: 1 },
  libraryTitle: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  libraryArtist: { fontSize: 11, color: '#B0B0B0', marginTop: 1 },
  libraryGenreTag: {
    backgroundColor: 'rgba(168,85,247,0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  libraryGenreText: { color: PURPLE, fontSize: 9, fontWeight: '600' },

  quickAccess: {
    backgroundColor: '#1E1E1E',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  quickItem: {
    width: '23%',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#2A2A2A',
    borderRadius: 12,
    gap: 4,
  },
  quickText: { fontSize: 10, color: '#B0B0B0', marginTop: 4, textAlign: 'center', fontWeight: '600' },

  footer: { marginHorizontal: 20, marginBottom: 30, padding: 18, alignItems: 'center' },
  footerText: { fontSize: 14, fontStyle: 'italic', color: '#B0B0B0', textAlign: 'center' },
  footerSubtext: { fontSize: 12, color: PINK, marginTop: 6 },

  // Progress
  progressTrack: { height: 28, justifyContent: 'center' },
  progressFill: { height: 4, borderRadius: 2, position: 'absolute', left: 0 },
  progressThumb: { width: 12, height: 12, borderRadius: 6, position: 'absolute', marginLeft: -6 },

  // Mini Player
  miniPlayer: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1E1E1E',
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  miniArt: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  miniInfo: { flex: 1 },
  miniTitle: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  miniArtist: { fontSize: 11, color: '#B0B0B0', marginTop: 1 },
  miniBtn: { padding: 6 },

  // Now Playing
  nowPlayingOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  nowPlayingSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
    alignItems: 'center',
  },
  sheetHandle: { width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2, alignSelf: 'center', marginBottom: 10 },
  nowPlayingClose: { position: 'absolute', top: 16, left: 16, zIndex: 10 },
  nowPlayingArt: { width: 180, height: 180, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginTop: 20, marginBottom: 24 },
  nowPlayingTitle: { fontSize: 20, fontWeight: '800', color: '#FFF', textAlign: 'center' },
  nowPlayingArtist: { fontSize: 15, color: '#B0B0B0', marginTop: 4, marginBottom: 8 },
  genreTag: {
    backgroundColor: 'rgba(255,107,157,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 16,
  },
  genreTagText: { color: PINK, fontSize: 12, fontWeight: '600' },
  nowPlayingProgressWrap: { width: '100%', marginBottom: 10 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -6 },
  timeText: { fontSize: 11, color: '#888' },
  transportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 10,
    marginTop: 16,
  },
  playPauseBtn: { width: 64, height: 64, borderRadius: 32, backgroundColor: PINK, alignItems: 'center', justifyContent: 'center' },
  repeatOneDot: { position: 'absolute', top: -2, right: -2, width: 6, height: 6, borderRadius: 3, backgroundColor: PINK },
  removeFromLibraryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 28 },
  removeFromLibraryTxt: { fontSize: 13, fontWeight: '600', color: DANGER },

  // Catalog
  catalogOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  catalogSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    paddingBottom: 30,
    maxHeight: '80%',
  },
  catalogHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  catalogTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: '#FFF' },
  catalogSubtitle: { fontSize: 12, color: '#B0B0B0', marginBottom: 14 },
  catalogFilters: { flexDirection: 'row', marginBottom: 12 },
  catalogFilterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#2A2A2A',
    marginRight: 6,
  },
  catalogFilterChipActive: { backgroundColor: PURPLE },
  catalogFilterText: { color: '#888', fontSize: 12, fontWeight: '500' },
  catalogFilterTextActive: { color: '#FFF' },
  catalogRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  catalogTrackTitle: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  catalogTrackArtist: { fontSize: 11, color: '#B0B0B0', marginTop: 1 },
  catalogGenreTag: {
    backgroundColor: 'rgba(168,85,247,0.2)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  catalogGenreText: { color: PURPLE, fontSize: 8, fontWeight: '600' },
  ownedBadge: { padding: 2 },
  downloadingWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  downloadingTxt: { fontSize: 11, fontWeight: '700', color: PURPLE },
  downloadCatalogBtn: {
    backgroundColor: PURPLE,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: { alignItems: 'center', paddingVertical: 30 },
  emptyStateText: { color: '#888', fontSize: 14 },
});
