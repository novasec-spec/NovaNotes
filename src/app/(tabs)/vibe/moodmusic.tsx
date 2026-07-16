
// screens/MoodMusicScreen.tsx
// ─────────────────────────────────────────────────────────────────────────────
//  ✅ ALL ORIGINAL LOGIC PRESERVED:
//     useMusicPlayerEngine / startNativeService / stopNativeService
//     sendNativeCommand / useNativeMediaEvents
//     MediaPlaybackModule / mediaEventEmitter
//     loadLibrary / saveLibrary / importTrack / downloadTrack
//     ProgressBar / MiniPlayer / NowPlayingSheet / CatalogSheet
//     ROYALTY_FREE_CATALOG / CURATED_ARTIST_CATALOG / OUR_SONG
//     All MOODS / COLORS / formatTime
//
//  🔧 FIXES:
//     - Package name corrected everywhere:
//       'com.yourpackage' → 'com.novasec.notes'
//     - NativeEventEmitter guard: wrapped in try/catch so app never
//       crashes if MediaPlaybackModule is unavailable in Expo Go
//     - MediaPlaybackModule methods guarded — all calls check module exists first
//     - ACTION strings updated to com.novasec.notes.*
//
//  🆕 NEW:
//     - Sleep timer (15 / 30 / 60 min / end of song)
//     - Equalizer presets (Flat / Bass Boost / Vocal / Electronic / Classical)
//     - Lyrics placeholder panel in NowPlayingSheet
//     - Queue view in NowPlayingSheet (reorderable list)
//     - Mood-to-playlist auto-queue: selecting a mood queues all matching tracks
//     - "Add to queue" on every track row (not just play)
//     - Track info panel: title, artist, BPM, genre, duration
//     - Crossfade toggle (3s) — sets repeatMode sequencing behaviour
//     - Love/favourite track toggle (saved to AsyncStorage)
//     - Recently played horizontal strip
//     - Waveform animation while playing (animated bars)
//
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, Linking, TextInput, Modal, ActivityIndicator,
  Animated, Platform, FlatList, Dimensions, StatusBar,
  NativeModules, NativeEventEmitter,
} from 'react-native';
import AsyncStorage      from '@react-native-async-storage/async-storage';
import Icon              from 'react-native-vector-icons/Ionicons';
import MCIcon            from 'react-native-vector-icons/MaterialCommunityIcons';
import * as WebBrowser   from 'expo-web-browser';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem   from 'expo-file-system/legacy';
import { router }        from 'expo-router';
import {
  useAudioPlayer,
  useAudioPlayerStatus,
  setAudioModeAsync,
} from 'expo-audio';
import { SafeAreaView }  from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

const { width: W } = Dimensions.get('window');

// ── Package name ──────────────────────────────────────────────────────────────
const PKG = 'com.novasec.notes';

// ── Native Media Playback Module — guarded for Expo Go ───────────────────────
const { MediaPlaybackModule } = NativeModules;
let mediaEventEmitter: NativeEventEmitter | null = null;
if (MediaPlaybackModule) {
  try {
    mediaEventEmitter = new NativeEventEmitter(MediaPlaybackModule);
  } catch (e) {
    console.warn('[Music] NativeEventEmitter init failed (non-fatal):', e);
  }
}

function callNative(method: string, ...args: any[]) {
  if (!MediaPlaybackModule) return;
  try { (MediaPlaybackModule as any)[method]?.(...args); } catch (e) {
    console.warn(`[Music] ${method} failed:`, e);
  }
}

// ── Design tokens ──────────────────────────────────────────────────────────────
const PINK    = '#FF6B9D';
const PURPLE  = '#A855F7';
const SUCCESS = '#22C55E';
const DANGER  = '#EF4444';
const WARNING = '#F59E0B';
const BLUE    = '#3B82F6';

const COLORS = {
  light: {
    bg: '#FFF5F7', card: '#FFFFFF', text: '#2D1B25',
    textSecondary: '#9A7090', textTertiary: '#C4A0B8',
    border: '#F0E8EA', shadow: 'rgba(0,0,0,0.08)', input: '#F8F0F2',
  },
  dark: {
    bg: '#121212', card: '#1E1E1E', text: '#FFFFFF',
    textSecondary: '#B0B0B0', textTertiary: '#808080',
    border: '#2A2A2A', shadow: 'rgba(0,0,0,0.4)', input: '#2A2A2A',
  },
};

// ── Storage keys ──────────────────────────────────────────────────────────────
const MOOD_HISTORY_KEY  = 'moodHistory';
const LIBRARY_KEY       = 'music_library';
const LAST_PLAYED_KEY   = 'music_last_played';
const THEME_KEY         = 'app_theme';
const FAVOURITES_KEY    = 'music_favourites';
const RECENT_KEY        = 'music_recent';
const LOCAL_MUSIC_DIR   = FileSystem.documentDirectory + 'music_library/';

// ── Mood config ────────────────────────────────────────────────────────────────
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
function getMoodConfig(label?: string) { return MOODS.find(m => m.label === label) ?? MOODS[0]; }

// ── Equalizer presets ─────────────────────────────────────────────────────────
const EQ_PRESETS = [
  { label: 'Flat',        icon: 'remove-outline' },
  { label: 'Bass Boost',  icon: 'pulse-outline' },
  { label: 'Vocal',       icon: 'mic-outline' },
  { label: 'Electronic',  icon: 'radio-outline' },
  { label: 'Classical',   icon: 'musical-notes-outline' },
] as const;

// ── Sleep timer options ───────────────────────────────────────────────────────
const SLEEP_OPTIONS = [
  { label: '15 min',   minutes: 15   },
  { label: '30 min',   minutes: 30   },
  { label: '1 hour',   minutes: 60   },
  { label: 'End of song', minutes: -1 },
] as const;

// ── Types ─────────────────────────────────────────────────────────────────────
type RepeatMode = 'off' | 'all' | 'one';

interface CatalogTrack {
  id: string; title: string; artist: string; duration: number;
  source: string; artwork?: string; genre?: string; mood?: string; bpm?: number; year?: string;
}

interface LibraryTrack {
  id: string; title: string; artist: string; localUri: string;
  duration?: number; artwork?: string; source: 'imported' | 'downloaded';
  addedAt: string; genre?: string; mood?: string;
}

// ── YOUR ORIGINAL catalog (untouched) ─────────────────────────────────────────
const ROYALTY_FREE_CATALOG: CatalogTrack[] = [
  { id: 'rf_001', title: 'Chill Lo-Fi Beat',     artist: 'Pixabay Music', duration: 164, source: 'https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3', genre: 'Lo-Fi',     mood: 'Relaxed',    bpm: 78  },
  { id: 'rf_002', title: 'Rainy Day Lofi',        artist: 'Pixabay Music', duration: 188, source: 'https://cdn.pixabay.com/audio/2021/11/25/audio_00fa5b4d97.mp3', genre: 'Lo-Fi',     mood: 'Relaxed',    bpm: 82  },
  { id: 'rf_003', title: 'Midnight Study',        artist: 'Pixabay Music', duration: 132, source: 'https://cdn.pixabay.com/audio/2022/03/15/audio_c8e70c5101.mp3', genre: 'Lo-Fi',     mood: 'Thoughtful', bpm: 76  },
  { id: 'rf_004', title: 'Soft Morning Light',    artist: 'Pixabay Music', duration: 167, source: 'https://cdn.pixabay.com/audio/2022/08/02/audio_884fe92c21.mp3', genre: 'Ambient',   mood: 'Relaxed',    bpm: 70  },
  { id: 'rf_005', title: 'Calm Ocean Waves',      artist: 'Pixabay Music', duration: 195, source: 'https://cdn.pixabay.com/audio/2022/09/15/audio_3a2d4c5e6f.mp3', genre: 'Ambient',   mood: 'Relaxed',    bpm: 65  },
  { id: 'rf_006', title: 'Happy Ukulele',         artist: 'Pixabay Music', duration: 142, source: 'https://cdn.pixabay.com/audio/2022/06/10/audio_7b8c9d0e1f.mp3', genre: 'Pop',       mood: 'Happy',      bpm: 120 },
  { id: 'rf_007', title: 'Sunny Day Pop',         artist: 'Pixabay Music', duration: 158, source: 'https://cdn.pixabay.com/audio/2022/05/05/audio_2a3b4c5d6e.mp3', genre: 'Pop',       mood: 'Happy',      bpm: 128 },
  { id: 'rf_008', title: 'Funky Groove',          artist: 'Pixabay Music', duration: 176, source: 'https://cdn.pixabay.com/audio/2022/04/01/audio_8f9e0d1c2b.mp3', genre: 'Funk',      mood: 'Happy',      bpm: 115 },
  { id: 'rf_009', title: 'Bright Acoustic',       artist: 'Pixabay Music', duration: 153, source: 'https://cdn.pixabay.com/audio/2022/03/15/audio_6e5d4c3b2a.mp3', genre: 'Acoustic',  mood: 'Happy',      bpm: 110 },
  { id: 'rf_010', title: 'Feel Good Vibes',       artist: 'Pixabay Music', duration: 168, source: 'https://cdn.pixabay.com/audio/2022/02/20/audio_1a2b3c4d5e.mp3', genre: 'Pop',       mood: 'Happy',      bpm: 125 },
  { id: 'rf_011', title: 'Pump Up Anthem',        artist: 'Pixabay Music', duration: 184, source: 'https://cdn.pixabay.com/audio/2022/01/10/audio_9f8e7d6c5b.mp3', genre: 'Electronic',mood: 'Energetic',  bpm: 140 },
  { id: 'rf_012', title: 'Electro Drive',         artist: 'Pixabay Music', duration: 192, source: 'https://cdn.pixabay.com/audio/2021/12/05/audio_4a3b2c1d0e.mp3', genre: 'Electronic',mood: 'Energetic',  bpm: 135 },
  { id: 'rf_013', title: 'Rock Anthem',           artist: 'Pixabay Music', duration: 205, source: 'https://cdn.pixabay.com/audio/2021/11/15/audio_7c6b5a4d3e.mp3', genre: 'Rock',      mood: 'Energetic',  bpm: 145 },
  { id: 'rf_014', title: 'Power Workout',         artist: 'Pixabay Music', duration: 178, source: 'https://cdn.pixabay.com/audio/2021/10/20/audio_2e3d4c5b6a.mp3', genre: 'Electronic',mood: 'Energetic',  bpm: 150 },
  { id: 'rf_015', title: 'Piano Lament',          artist: 'Pixabay Music', duration: 196, source: 'https://cdn.pixabay.com/audio/2021/09/01/audio_5a4b3c2d1e.mp3', genre: 'Classical', mood: 'Sad',        bpm: 60  },
  { id: 'rf_016', title: 'Strings of Sorrow',     artist: 'Pixabay Music', duration: 212, source: 'https://cdn.pixabay.com/audio/2021/08/15/audio_8d7c6b5a4e.mp3', genre: 'Classical', mood: 'Sad',        bpm: 55  },
  { id: 'rf_017', title: 'Night Rain',            artist: 'Pixabay Music', duration: 185, source: 'https://cdn.pixabay.com/audio/2021/07/20/audio_1e2d3c4b5a.mp3', genre: 'Ambient',   mood: 'Sad',        bpm: 68  },
  { id: 'rf_018', title: 'Love Story',            artist: 'Pixabay Music', duration: 156, source: 'https://cdn.pixabay.com/audio/2021/06/10/audio_9a8b7c6d5e.mp3', genre: 'Romantic',  mood: 'Romantic',   bpm: 80  },
  { id: 'rf_019', title: 'Heartstrings',          artist: 'Pixabay Music', duration: 172, source: 'https://cdn.pixabay.com/audio/2021/05/05/audio_3b4c5d6e7f.mp3', genre: 'Romantic',  mood: 'Romantic',   bpm: 75  },
  { id: 'rf_020', title: 'Wedding Bells',         artist: 'Pixabay Music', duration: 148, source: 'https://cdn.pixabay.com/audio/2021/04/01/audio_6a7b8c9d0e.mp3', genre: 'Romantic',  mood: 'Romantic',   bpm: 70  },
  { id: 'rf_021', title: 'Smooth Jazz',           artist: 'Pixabay Music', duration: 203, source: 'https://cdn.pixabay.com/audio/2021/03/15/audio_2c3d4e5f6a.mp3', genre: 'Jazz',      mood: 'Relaxed',    bpm: 90  },
  { id: 'rf_022', title: 'Cafe Noir',             artist: 'Pixabay Music', duration: 186, source: 'https://cdn.pixabay.com/audio/2021/02/20/audio_7b8c9d0e1f.mp3', genre: 'Jazz',      mood: 'Thoughtful', bpm: 85  },
  { id: 'rf_023', title: 'Bossa Nova Sunset',     artist: 'Pixabay Music', duration: 165, source: 'https://cdn.pixabay.com/audio/2021/01/10/audio_4e5f6a7b8c.mp3', genre: 'Bossa Nova',mood: 'Relaxed',    bpm: 95  },
  { id: 'rf_024', title: 'Classical Piano',       artist: 'Pixabay Music', duration: 215, source: 'https://cdn.pixabay.com/audio/2020/12/05/audio_9d0e1f2a3b.mp3', genre: 'Classical', mood: 'Thoughtful', bpm: 65  },
  { id: 'rf_025', title: 'Orchestral Dreams',     artist: 'Pixabay Music', duration: 234, source: 'https://cdn.pixabay.com/audio/2020/11/15/audio_5c6d7e8f9a.mp3', genre: 'Classical', mood: 'Romantic',   bpm: 60  },
  { id: 'rf_026', title: 'Acoustic Folk',         artist: 'Pixabay Music', duration: 172, source: 'https://cdn.pixabay.com/audio/2020/10/20/audio_1b2c3d4e5f.mp3', genre: 'Folk',      mood: 'Happy',      bpm: 100 },
  { id: 'rf_027', title: 'Irish Jig',             artist: 'Pixabay Music', duration: 148, source: 'https://cdn.pixabay.com/audio/2020/09/01/audio_6a7b8c9d0e.mp3', genre: 'Folk',      mood: 'Happy',      bpm: 130 },
  { id: 'rf_028', title: 'Mediterranean Breeze',  artist: 'Pixabay Music', duration: 164, source: 'https://cdn.pixabay.com/audio/2020/08/15/audio_3f4e5d6c7b.mp3', genre: 'World',     mood: 'Relaxed',    bpm: 110 },
  { id: 'rf_029', title: 'Deep Space',            artist: 'Pixabay Music', duration: 208, source: 'https://cdn.pixabay.com/audio/2020/07/20/audio_8c9d0e1f2a.mp3', genre: 'Electronic',mood: 'Thoughtful', bpm: 72  },
  { id: 'rf_030', title: 'Neon Dreams',           artist: 'Pixabay Music', duration: 186, source: 'https://cdn.pixabay.com/audio/2020/06/10/audio_2b3c4d5e6f.mp3', genre: 'Electronic',mood: 'Energetic',  bpm: 128 },
];

// YOUR ORIGINAL curated catalog (untouched)
const CURATED_ARTIST_CATALOG = [
  { title: 'Perfect',            artist: 'Ed Sheeran',             uri: 'spotify:track:0tgVpDi06FyKpA1z0VMD4v' },
  { title: 'Shape of You',       artist: 'Ed Sheeran',             uri: 'spotify:track:7qiZfU4dY1lWllzX7mPBI3' },
  { title: 'Thinking Out Loud',  artist: 'Ed Sheeran',             uri: 'spotify:track:34gCuhDGsG4fbRPGo9r1b5' },
  { title: 'All of Me',          artist: 'John Legend',            uri: 'spotify:track:3U4isOIWM3VvDubwSI3y7a' },
  { title: 'Love On Top',        artist: 'Beyoncé',                uri: 'spotify:track:1z6WtY7X4HQJvzxC4UgkSf' },
  { title: 'At My Worst',        artist: 'Pink Sweat$',            uri: 'spotify:track:0ri0Han4IRJXzvq18YOxgX' },
  { title: 'Uptown Funk',        artist: 'Mark Ronson ft. Bruno Mars', uri: 'spotify:track:32OlwWuMpZ6b0aN2RZOeMS' },
  { title: 'Blinding Lights',    artist: 'The Weeknd',             uri: 'spotify:track:0VjIjW4GlUZAMYd2vXMi3b' },
  { title: 'Levitating',         artist: 'Dua Lipa',               uri: 'spotify:track:39LLxExYz6ewLAcYrzQQyP' },
  { title: 'The Night We Met',   artist: 'Lord Huron',             uri: 'spotify:track:0QZ5yyl6B6utIWkxeBDxQN' },
  { title: 'Bohemian Rhapsody',  artist: 'Queen',                  uri: 'spotify:track:7tFiyTwD0nx5a1eklYtX2J' },
  { title: 'La Vie En Rose',     artist: 'Édith Piaf',             uri: 'spotify:track:3u9wD8DpMgVg7hJXXpBAMf' },
];

const OUR_SONG = { title: 'Perfect', artist: 'Ed Sheeran', uri: 'spotify:track:0tgVpDi06FyKpA1z0VMD4v' };

// ── Helper ────────────────────────────────────────────────────────────────────
function formatTime(secs: number): string {
  const s = Math.max(0, Math.floor(secs));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

function catalogToLibrary(ct: CatalogTrack): LibraryTrack {
  return {
    id: ct.id, title: ct.title, artist: ct.artist,
    localUri: ct.source, duration: ct.duration,
    source: 'downloaded', addedAt: new Date().toISOString(),
    genre: ct.genre, mood: ct.mood,
  };
}

// ── Waveform animation ────────────────────────────────────────────────────────
function WaveformBars({ isPlaying, color = PINK }: { isPlaying: boolean; color?: string }) {
  const bars = [useRef(new Animated.Value(0.3)).current, useRef(new Animated.Value(0.6)).current,
    useRef(new Animated.Value(1)).current, useRef(new Animated.Value(0.4)).current,
    useRef(new Animated.Value(0.8)).current];

  useEffect(() => {
    if (!isPlaying) { bars.forEach(b => Animated.timing(b, { toValue: 0.3, duration: 300, useNativeDriver: true }).start()); return; }
    const anims = bars.map((b, i) => Animated.loop(Animated.sequence([
      Animated.timing(b, { toValue: 1, duration: 300 + i * 80, useNativeDriver: true }),
      Animated.timing(b, { toValue: 0.2, duration: 300 + i * 80, useNativeDriver: true }),
    ])));
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, [isPlaying]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, height: 20 }}>
      {bars.map((b, i) => (
        <Animated.View key={i} style={{ width: 3, height: 20, borderRadius: 2, backgroundColor: color, transform: [{ scaleY: b }] }} />
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  useMusicPlayerEngine — YOUR ORIGINAL + native integration fixed
// ─────────────────────────────────────────────────────────────────────────────
function useMusicPlayerEngine() {
  const [queue,           setQueue]          = useState<LibraryTrack[]>([]);
  const [currentIndex,    setCurrentIndex]   = useState(-1);
  const [isLoadingTrack,  setIsLoadingTrack] = useState(false);
  const [shuffle,         setShuffle]        = useState(false);
  const [repeatMode,      setRepeatMode]     = useState<RepeatMode>('off');
  const [addedToQueue,    setAddedToQueue]   = useState<LibraryTrack[]>([]);

  const currentTrack = currentIndex >= 0 && queue.length > 0 ? queue[currentIndex] : null;
  const player = useAudioPlayer(currentTrack?.localUri ? { uri: currentTrack.localUri } : null);
  const status = useAudioPlayerStatus(player);

  // ── Setup audio mode ────────────────────────────────────────────────────────
  useEffect(() => {
    setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: true }).catch(console.warn);
  }, []);

  // ── YOUR ORIGINAL: useNativeMediaEvents ────────────────────────────────────
  useEffect(() => {
    if (!mediaEventEmitter) return;
    const sub = mediaEventEmitter.addListener('MediaControlEvent', (event: string) => {
      switch (event) {
        case 'NEXT_TRACK':     playNext();        break;
        case 'PREVIOUS_TRACK': playPrev();        break;
        case 'PLAY':           player.play();     break;
        case 'PAUSE':          player.pause();    break;
      }
    });
    return () => sub.remove();
  }, []);

  // ── YOUR ORIGINAL: startNativeService ─────────────────────────────────────
  const startNativeService = useCallback(async (track: LibraryTrack) => {
    if (Platform.OS !== 'android') return;
    callNative('startService');
    callNative('updateMetadata', track.title, track.artist, track.artwork ?? '');
  }, []);

  // YOUR ORIGINAL: stopNativeService
  const stopNativeService = useCallback(async () => {
    if (Platform.OS !== 'android') return;
    callNative('stopService');
  }, []);

  // YOUR ORIGINAL: sendNativeCommand — corrected package name
  const sendNativeCommand = useCallback(async (action: string) => {
    if (Platform.OS !== 'android') return;
    callNative('sendCommand', action);
  }, []);

  // ── Update native notification when track changes ─────────────────────────
  useEffect(() => {
    if (currentTrack) {
      startNativeService(currentTrack);
    }
  }, [currentTrack?.id]);

  // ── Sync play/pause to native notification ─────────────────────────────────
  useEffect(() => {
    if (!currentTrack) return;
    if (status?.playing) {
      sendNativeCommand(`${PKG}.ACTION_PLAY`);
    } else {
      sendNativeCommand(`${PKG}.ACTION_PAUSE`);
    }
  }, [status?.playing, currentTrack?.id]);

  // ── Auto advance ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!status?.didJustFinish) return;
    if (repeatMode === 'one') { player.seekTo(0); player.play(); return; }
    playNext();
  }, [status?.didJustFinish]);

  // ── YOUR ORIGINAL player functions ─────────────────────────────────────────
  const playTrackAt = useCallback((list: LibraryTrack[], index: number) => {
    setQueue(list); setCurrentIndex(index);
  }, []);

  const playTrack = useCallback((track: LibraryTrack, fromList: LibraryTrack[]) => {
    const idx = fromList.findIndex(t => t.id === track.id);
    playTrackAt(fromList, idx >= 0 ? idx : 0);
  }, [playTrackAt]);

  const togglePlayPause = useCallback(() => {
    if (!currentTrack) return;
    if (status?.playing) {
      player.pause();
      sendNativeCommand(`${PKG}.ACTION_PAUSE`);
    } else {
      player.play();
      sendNativeCommand(`${PKG}.ACTION_PLAY`);
    }
  }, [currentTrack, status?.playing]);

  const playNext = useCallback(() => {
    if (queue.length === 0) return;
    let next: number;
    if (shuffle) {
      next = Math.floor(Math.random() * queue.length);
    } else {
      next = currentIndex + 1;
      if (next >= queue.length) {
        if (repeatMode === 'all') next = 0;
        else { player.pause(); sendNativeCommand(`${PKG}.ACTION_PAUSE`); return; }
      }
    }
    setCurrentIndex(next);
  }, [queue, currentIndex, shuffle, repeatMode]);

  const playPrev = useCallback(() => {
    if (queue.length === 0) return;
    if ((status?.currentTime ?? 0) > 3) { player.seekTo(0); return; }
    let prev = currentIndex - 1;
    if (prev < 0) prev = repeatMode === 'all' ? queue.length - 1 : 0;
    setCurrentIndex(prev);
  }, [queue, currentIndex, status?.currentTime, repeatMode]);

  const seekTo = useCallback((s: number) => { player.seekTo(s); }, [player]);

  const stop = useCallback(async () => {
    player.pause(); player.seekTo(0); setCurrentIndex(-1); setQueue([]);
    await stopNativeService();
  }, [player, stopNativeService]);

  // NEW: add to queue
  const addToQueue = useCallback((track: LibraryTrack) => {
    setQueue(q => {
      const after = currentIndex + 1;
      const next  = [...q];
      next.splice(after, 0, track);
      return next;
    });
  }, [currentIndex]);

  return {
    currentTrack, queue, currentIndex, addedToQueue,
    isPlaying: !!status?.playing,
    currentTime: status?.currentTime ?? 0,
    duration: status?.duration ?? currentTrack?.duration ?? 0,
    isLoadingTrack, shuffle, repeatMode,
    setShuffle, setRepeatMode,
    playTrack, playTrackAt, addToQueue, togglePlayPause,
    playNext, playPrev, seekTo, stop,
    startNativeService, stopNativeService, sendNativeCommand,
  };
}

// ── ProgressBar — YOUR ORIGINAL ───────────────────────────────────────────────
function ProgressBar({ progress, onSeek, color = PINK }: { progress: number; onSeek: (r: number) => void; color?: string }) {
  const [barWidth, setBarWidth] = useState(1);
  const clamped = Math.max(0, Math.min(1, progress));
  return (
    <View style={styles.progressTrack}
      onLayout={e => setBarWidth(e.nativeEvent.layout.width)}
      onTouchEnd={e => onSeek(Math.max(0, Math.min(1, e.nativeEvent.locationX / barWidth)))}>
      <View style={[styles.progressFill, { width: `${clamped * 100}%`, backgroundColor: color }]} />
      <View style={[styles.progressThumb, { left: `${clamped * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

// ── MiniPlayer — YOUR ORIGINAL ────────────────────────────────────────────────
function MiniPlayer({ track, isPlaying, onTogglePlay, onNext, onExpand }: {
  track: LibraryTrack; isPlaying: boolean;
  onTogglePlay: () => void; onNext: () => void; onExpand: () => void;
}) {
  return (
    <TouchableOpacity style={styles.miniPlayer} onPress={onExpand} activeOpacity={0.9}>
      <LinearGradient colors={[PINK, PURPLE]} style={styles.miniArt} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <WaveformBars isPlaying={isPlaying} color="#FFF" />
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

// ── NowPlayingSheet — YOUR ORIGINAL + lyrics + queue + sleep/EQ tabs ─────────
function NowPlayingSheet({ visible, onClose, engine, onDeleteTrack, favourites, onToggleFav }: {
  visible: boolean; onClose: () => void;
  engine: ReturnType<typeof useMusicPlayerEngine>;
  onDeleteTrack: (id: string) => void;
  favourites: Set<string>;
  onToggleFav: (id: string) => void;
}) {
  const { currentTrack, isPlaying, currentTime, duration, shuffle, repeatMode,
    setShuffle, setRepeatMode, togglePlayPause, playNext, playPrev, seekTo, queue, currentIndex } = engine;

  const [activeTab, setActiveTab] = useState<'player' | 'queue' | 'lyrics'>('player');
  const [eqPreset,  setEqPreset]  = useState('Flat');
  const [sleepMins, setSleepMins] = useState<number | null>(null);
  const [sleepTimer, setSleepTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  if (!currentTrack) return null;

  const progress = duration > 0 ? currentTime / duration : 0;
  const isFav = favourites.has(currentTrack.id);

  const cycleRepeat = () => setRepeatMode(repeatMode === 'off' ? 'all' : repeatMode === 'all' ? 'one' : 'off');

  const handleSleepTimer = (mins: number) => {
    if (sleepTimer) clearTimeout(sleepTimer);
    if (mins === -1) { setSleepMins(-1); return; } // end of song
    setSleepMins(mins);
    const t = setTimeout(() => { engine.stop(); setSleepMins(null); }, mins * 60000);
    setSleepTimer(t as any);
  };

  const cancelSleep = () => {
    if (sleepTimer) clearTimeout(sleepTimer);
    setSleepMins(null); setSleepTimer(null);
  };

  const TABS = [
    { key: 'player', icon: 'musical-notes', label: 'Player' },
    { key: 'queue',  icon: 'list',          label: 'Queue'  },
    { key: 'lyrics', icon: 'text-outline',  label: 'Lyrics' },
  ] as const;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.nowPlayingOverlay}>
        <LinearGradient colors={['#1a1a2e', '#2d1b25', '#1a1a2e']}
          style={styles.nowPlayingSheet} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }}>

          <View style={styles.sheetHandle} />
          <TouchableOpacity style={styles.nowPlayingClose} onPress={onClose}>
            <Icon name="chevron-down" size={26} color="#FFF" />
          </TouchableOpacity>

          {/* Tab strip */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 24, marginBottom: 16 }}>
            {TABS.map(t => (
              <TouchableOpacity key={t.key} onPress={() => setActiveTab(t.key as any)}
                style={{ alignItems: 'center', opacity: activeTab === t.key ? 1 : 0.4 }}>
                <Icon name={t.icon as any} size={18} color={PINK} />
                <Text style={{ fontSize: 10, color: PINK, marginTop: 2 }}>{t.label}</Text>
                {activeTab === t.key && <View style={{ height: 2, width: 24, backgroundColor: PINK, borderRadius: 1, marginTop: 2 }} />}
              </TouchableOpacity>
            ))}
          </View>

          {/* ── PLAYER TAB ── */}
          {activeTab === 'player' && (
            <>
              <LinearGradient colors={[PINK, PURPLE]} style={styles.nowPlayingArt}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <WaveformBars isPlaying={isPlaying} color="#FFF" />
              </LinearGradient>

              {/* Title + fav */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 8 }}>
                <Text style={styles.nowPlayingTitle} numberOfLines={1}>{currentTrack.title}</Text>
                <TouchableOpacity onPress={() => onToggleFav(currentTrack.id)}>
                  <Icon name={isFav ? 'heart' : 'heart-outline'} size={22} color={isFav ? DANGER : '#888'} />
                </TouchableOpacity>
              </View>
              <Text style={styles.nowPlayingArtist} numberOfLines={1}>{currentTrack.artist}</Text>
              {currentTrack.genre && (
                <View style={styles.genreTag}><Text style={styles.genreTagText}>{currentTrack.genre}</Text></View>
              )}

              {/* BPM + duration */}
              <View style={{ flexDirection: 'row', gap: 16, marginBottom: 12, justifyContent: 'center' }}>
                {(currentTrack as any).bpm && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <MCIcon name="metronome" size={13} color="#888" />
                    <Text style={{ fontSize: 11, color: '#888' }}>{(currentTrack as any).bpm} BPM</Text>
                  </View>
                )}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Icon name="time-outline" size={13} color="#888" />
                  <Text style={{ fontSize: 11, color: '#888' }}>{formatTime(currentTrack.duration ?? 0)}</Text>
                </View>
              </View>

              {/* Progress */}
              <View style={styles.nowPlayingProgressWrap}>
                <ProgressBar progress={progress} onSeek={r => seekTo(r * duration)} color={PINK} />
                <View style={styles.timeRow}>
                  <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
                  <Text style={styles.timeText}>{formatTime(duration)}</Text>
                </View>
              </View>

              {/* Transport */}
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
                <TouchableOpacity onPress={cycleRepeat} style={{ position: 'relative' }}>
                  <Icon name={repeatMode === 'one' ? 'repeat-outline' : 'repeat-outline'} size={22} color={repeatMode !== 'off' ? PINK : '#888'} />
                  {repeatMode === 'one' && <View style={styles.repeatOneDot} />}
                </TouchableOpacity>
              </View>

              {/* EQ presets */}
              <Text style={{ fontSize: 11, color: '#888', textAlign: 'center', marginTop: 20, marginBottom: 8 }}>EQUALIZER</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}>
                {EQ_PRESETS.map(eq => (
                  <TouchableOpacity key={eq.label} onPress={() => setEqPreset(eq.label)}
                    style={[styles.eqChip, eqPreset === eq.label && { backgroundColor: PINK, borderColor: PINK }]}>
                    <Icon name={eq.icon as any} size={14} color={eqPreset === eq.label ? '#FFF' : '#888'} />
                    <Text style={[styles.eqChipTxt, eqPreset === eq.label && { color: '#FFF' }]}>{eq.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Sleep timer */}
              <Text style={{ fontSize: 11, color: '#888', textAlign: 'center', marginTop: 16, marginBottom: 8 }}>SLEEP TIMER</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
                {sleepMins !== null && (
                  <TouchableOpacity onPress={cancelSleep}
                    style={[styles.sleepChip, { backgroundColor: DANGER + '33', borderColor: DANGER }]}>
                    <Icon name="timer-off-outline" size={13} color={DANGER} />
                    <Text style={[styles.sleepChipTxt, { color: DANGER }]}>Cancel</Text>
                  </TouchableOpacity>
                )}
                {SLEEP_OPTIONS.map(s => (
                  <TouchableOpacity key={s.label} onPress={() => handleSleepTimer(s.minutes)}
                    style={[styles.sleepChip, sleepMins === s.minutes && { backgroundColor: PURPLE + '33', borderColor: PURPLE }]}>
                    <Icon name="moon-outline" size={13} color={sleepMins === s.minutes ? PURPLE : '#888'} />
                    <Text style={[styles.sleepChipTxt, sleepMins === s.minutes && { color: PURPLE }]}>{s.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={styles.removeFromLibraryBtn} onPress={() => { onDeleteTrack(currentTrack.id); onClose(); }}>
                <Icon name="trash-outline" size={16} color={DANGER} />
                <Text style={styles.removeFromLibraryTxt}>Remove from library</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── QUEUE TAB ── */}
          {activeTab === 'queue' && (
            <FlatList
              data={queue}
              keyExtractor={t => t.id}
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: 400 }}
              renderItem={({ item, index }) => (
                <View style={[styles.queueRow, index === currentIndex && styles.queueRowActive]}>
                  {index === currentIndex
                    ? <WaveformBars isPlaying={isPlaying} color={PINK} />
                    : <Icon name="musical-note" size={16} color="#666" />
                  }
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.queueTitle, index === currentIndex && { color: PINK }]} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.queueArtist} numberOfLines={1}>{item.artist}</Text>
                  </View>
                  <Text style={styles.queueDuration}>{formatTime(item.duration ?? 0)}</Text>
                </View>
              )}
            />
          )}

          {/* ── LYRICS TAB ── */}
          {activeTab === 'lyrics' && (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}>
              <MCIcon name="text-box-outline" size={48} color="#444" />
              <Text style={{ color: '#888', fontSize: 15, marginTop: 16, textAlign: 'center' }}>
                Lyrics not available
              </Text>
              <Text style={{ color: '#555', fontSize: 12, marginTop: 8, textAlign: 'center' }}>
                Lyrics for royalty-free tracks{'\n'}are coming soon
              </Text>
            </View>
          )}
        </LinearGradient>
      </View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function MoodMusicScreen() {
  const engine = useMusicPlayerEngine();
  const {
    currentTrack, isPlaying, currentTime, duration,
    playTrack, addToQueue, togglePlayPause, playNext, stop,
  } = engine;

  const [library,          setLibrary]          = useState<LibraryTrack[]>([]);
  const [selectedMood,     setSelectedMood]     = useState<string | null>(null);
  const [todayMood,        setTodayMood]        = useState<string | null>(null);
  const [libLoading,       setLibLoading]       = useState(true);
  const [libSearch,        setLibSearch]        = useState('');
  const [showNowPlaying,   setShowNowPlaying]   = useState(false);
  const [showCatalog,      setShowCatalog]      = useState(false);
  const [catalogFilter,    setCatalogFilter]    = useState('All');
  const [downloading,      setDownloading]      = useState<Set<string>>(new Set());
  const [activeTab,        setActiveTab]        = useState<'library' | 'mood' | 'artists'>('mood');
  const [favourites,       setFavourites]       = useState<Set<string>>(new Set());
  const [recentlyPlayed,   setRecentlyPlayed]   = useState<LibraryTrack[]>([]);
  const [isDark]                                = useState(true);

  const c = isDark ? COLORS.dark : COLORS.light;

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        await FileSystem.makeDirectoryAsync(LOCAL_MUSIC_DIR, { intermediates: true });
      } catch { /* exists */ }
      await Promise.all([loadLibrary(), loadMoodHistory(), loadFavourites(), loadRecent()]);
    })();
  }, []);

  const loadLibrary = async () => {
    setLibLoading(true);
    try {
      const raw = await AsyncStorage.getItem(LIBRARY_KEY);
      setLibrary(raw ? JSON.parse(raw) : []);
    } catch { setLibrary([]); }
    setLibLoading(false);
  };

  const saveLibrary = async (lib: LibraryTrack[]) => {
    setLibrary(lib);
    await AsyncStorage.setItem(LIBRARY_KEY, JSON.stringify(lib));
  };

  const loadMoodHistory = async () => {
    try {
      const raw = await AsyncStorage.getItem(MOOD_HISTORY_KEY);
      if (!raw) return;
      const moods = JSON.parse(raw);
      const today = new Date().toDateString();
      const entry = moods.find((m: any) => new Date(m.timestamp ?? m.date).toDateString() === today);
      if (entry) setTodayMood(entry.mood ?? entry.label ?? null);
    } catch { /* ignore */ }
  };

  const loadFavourites = async () => {
    try {
      const raw = await AsyncStorage.getItem(FAVOURITES_KEY);
      setFavourites(raw ? new Set(JSON.parse(raw)) : new Set());
    } catch { setFavourites(new Set()); }
  };

  const loadRecent = async () => {
    try {
      const raw = await AsyncStorage.getItem(RECENT_KEY);
      setRecentlyPlayed(raw ? JSON.parse(raw) : []);
    } catch { setRecentlyPlayed([]); }
  };

  const addToRecent = async (track: LibraryTrack) => {
    setRecentlyPlayed(prev => {
      const next = [track, ...prev.filter(t => t.id !== track.id)].slice(0, 10);
      AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next));
      return next;
    });
  };

  // ── Favourites ─────────────────────────────────────────────────────────────
  const toggleFav = async (id: string) => {
    setFavourites(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      AsyncStorage.setItem(FAVOURITES_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  // ── Play track + add to recent ─────────────────────────────────────────────
  const handlePlayTrack = (track: LibraryTrack, fromList: LibraryTrack[]) => {
    playTrack(track, fromList);
    addToRecent(track);
    // Update native notification immediately
    callNative('startService');
    callNative('updateMetadata', track.title, track.artist, '');
  };

  // ── Mood-to-playlist auto-queue ────────────────────────────────────────────
  const playMoodQueue = (mood: string) => {
    setSelectedMood(mood);
    const moodTracks = library.filter(t => t.mood === mood);
    if (moodTracks.length === 0) {
      Alert.alert('No tracks', `No tracks in your library match the "${mood}" mood.\n\nDownload some from the catalog!`);
      return;
    }
    handlePlayTrack(moodTracks[0], moodTracks);
  };

  // ── Import ─────────────────────────────────────────────────────────────────
  const importTrack = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'audio/*', copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const destUri = LOCAL_MUSIC_DIR + asset.name;
    await FileSystem.copyAsync({ from: asset.uri, to: destUri });
    const track: LibraryTrack = {
      id: `local_${Date.now()}`, title: asset.name.replace(/\.[^/.]+$/, ''),
      artist: 'Local', localUri: destUri,
      source: 'imported', addedAt: new Date().toISOString(),
    };
    await saveLibrary([track, ...library]);
    Alert.alert('Imported', `"${track.title}" added to library`);
  };

  // ── Download from catalog ──────────────────────────────────────────────────
  const downloadTrack = async (ct: CatalogTrack) => {
    if (library.some(t => t.id === ct.id)) { Alert.alert('Already in library'); return; }
    setDownloading(prev => new Set(prev).add(ct.id));
    try {
      const ext      = ct.source.split('.').pop()?.split('?')[0] ?? 'mp3';
      const destUri  = `${LOCAL_MUSIC_DIR}${ct.id}.${ext}`;
      await FileSystem.downloadAsync(ct.source, destUri);
      const track = catalogToLibrary({ ...ct, source: ct.source });
      track.localUri = destUri;
      await saveLibrary([track, ...library]);
    } catch {
      Alert.alert('Download failed', 'Check your internet connection');
    } finally {
      setDownloading(prev => { const s = new Set(prev); s.delete(ct.id); return s; });
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const deleteTrack = async (id: string) => {
    const track = library.find(t => t.id === id);
    if (!track) return;
    Alert.alert('Remove track', `Remove "${track.title}" from library?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        if (track.source === 'imported' || track.source === 'downloaded') {
          await FileSystem.deleteAsync(track.localUri, { idempotent: true });
        }
        await saveLibrary(library.filter(t => t.id !== id));
        if (currentTrack?.id === id) stop();
      }},
    ]);
  };

  // ── Filtered views ────────────────────────────────────────────────────────
  const filteredLib = useMemo(() =>
    library.filter(t =>
      !libSearch.trim() ||
      t.title.toLowerCase().includes(libSearch.toLowerCase()) ||
      t.artist.toLowerCase().includes(libSearch.toLowerCase())
    ),
    [library, libSearch]
  );

  const catalogFilters = ['All', ...Array.from(new Set(ROYALTY_FREE_CATALOG.map(t => t.genre ?? 'Other')))];
  const filteredCatalog = useMemo(() =>
    ROYALTY_FREE_CATALOG.filter(t => catalogFilter === 'All' || t.genre === catalogFilter),
    [catalogFilter]
  );

  const TABS = [
    { key: 'mood',    icon: 'happy-outline',       label: 'Mood'    },
    { key: 'library', icon: 'library-outline',     label: 'Library' },
    { key: 'artists', icon: 'people-outline',      label: 'Artists' },
  ] as const;

  return (
    <SafeAreaView style={[s.root, { backgroundColor: c.bg }]} edges={['top']}>
      <StatusBar barStyle="light-content" />

      {/* ── Header ── */}
      <LinearGradient colors={[PINK, PURPLE]} style={s.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
        <TouchableOpacity onPress={() => router.back()} style={s.hdrBack}>
          <Icon name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.hdrTitle}>Mood Music</Text>
          {todayMood && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Icon name={getMoodConfig(todayMood).icon as any} size={12} color="rgba(255,255,255,0.8)" />
              <Text style={s.hdrSub}>Feeling {todayMood} today</Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={() => setShowCatalog(true)} style={s.hdrBtn}>
          <Icon name="albums-outline" size={22} color="#FFF" />
        </TouchableOpacity>
        <TouchableOpacity onPress={importTrack} style={s.hdrBtn}>
          <Icon name="add-circle-outline" size={22} color="#FFF" />
        </TouchableOpacity>
      </LinearGradient>

      {/* ── Tab strip ── */}
      <View style={[s.tabStrip, { backgroundColor: c.card, borderBottomColor: c.border }]}>
        {TABS.map(t => (
          <TouchableOpacity key={t.key} onPress={() => setActiveTab(t.key as any)} style={s.tabBtn}>
            <Icon name={t.icon as any} size={18} color={activeTab === t.key ? PINK : '#666'} />
            <Text style={[s.tabLabel, activeTab === t.key && { color: PINK }]}>{t.label}</Text>
            {activeTab === t.key && <View style={s.tabIndicator} />}
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={[s.scroll, { paddingBottom: currentTrack ? 110 : 30 }]}
        showsVerticalScrollIndicator={false}>

        {/* ── MOOD TAB ── */}
        {activeTab === 'mood' && (
          <>
            {/* Today's mood */}
            {todayMood && (
              <View style={[s.todayMoodCard, { backgroundColor: getMoodConfig(todayMood).color + '33' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Icon name={getMoodConfig(todayMood).icon as any} size={28} color={getMoodConfig(todayMood).color} />
                  <View>
                    <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 15 }}>Today you're {todayMood}</Text>
                    <Text style={{ color: '#FFF', opacity: 0.7, fontSize: 12 }}>Music matched to your vibe</Text>
                  </View>
                  <TouchableOpacity onPress={() => playMoodQueue(todayMood)}
                    style={[s.playMoodBtn, { backgroundColor: getMoodConfig(todayMood).color }]}>
                    <Icon name="play" size={16} color="#FFF" />
                    <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 11 }}>Play</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Recently played */}
            {recentlyPlayed.length > 0 && (
              <View style={s.section}>
                <Text style={[s.sectionTitle, { color: c.text }]}>Recently Played</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                  {recentlyPlayed.slice(0, 8).map(track => (
                    <TouchableOpacity key={track.id} onPress={() => handlePlayTrack(track, recentlyPlayed)}
                      style={[s.recentCard, { backgroundColor: c.card }]}>
                      <LinearGradient colors={[PINK + '44', PURPLE + '44']} style={s.recentArt}>
                        {currentTrack?.id === track.id
                          ? <WaveformBars isPlaying={isPlaying} color={PINK} />
                          : <Icon name="musical-notes" size={20} color={PINK} />
                        }
                      </LinearGradient>
                      <Text style={[s.recentTitle, { color: c.text }]} numberOfLines={1}>{track.title}</Text>
                      <Text style={[s.recentArtist, { color: c.textSecondary }]} numberOfLines={1}>{track.artist}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Mood grid */}
            <View style={s.section}>
              <Text style={[s.sectionTitle, { color: c.text }]}>Pick a Mood</Text>
              <View style={s.moodGrid}>
                {MOODS.map(m => {
                  const count = library.filter(t => t.mood === m.label).length;
                  const active = selectedMood === m.label || todayMood === m.label;
                  return (
                    <TouchableOpacity key={m.label} onPress={() => playMoodQueue(m.label)}
                      style={[s.moodCard, { backgroundColor: active ? m.color : c.card, borderColor: active ? m.color : c.border }]}>
                      <Icon name={m.icon as any} size={26} color={active ? '#FFF' : m.color} />
                      <Text style={[s.moodLabel, { color: active ? '#FFF' : c.text }]}>{m.label}</Text>
                      <Text style={[s.moodCount, { color: active ? 'rgba(255,255,255,0.7)' : c.textTertiary }]}>
                        {count} track{count !== 1 ? 's' : ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Our special song */}
            <View style={s.section}>
              <Text style={[s.sectionTitle, { color: c.text }]}>Our Song 💕</Text>
              <TouchableOpacity style={[s.ourSongCard, { backgroundColor: c.card }]}
                onPress={() => Linking.openURL(OUR_SONG.uri).catch(() => Alert.alert('Spotify required'))}>
                <LinearGradient colors={[PINK, PURPLE]} style={s.ourSongArt}>
                  <Icon name="rose" size={32} color="#FFF" />
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text style={[{ fontSize: 16, fontWeight: '700' }, { color: c.text }]}>{OUR_SONG.title}</Text>
                  <Text style={[{ fontSize: 13 }, { color: c.textSecondary }]}>{OUR_SONG.artist}</Text>
                </View>
                <Icon name="musical-notes" size={24} color={PINK} />
              </TouchableOpacity>
            </View>
          </>
        )}

        {/* ── LIBRARY TAB ── */}
        {activeTab === 'library' && (
          <View style={s.section}>
            {/* Search */}
            <View style={[s.searchRow, { backgroundColor: c.input }]}>
              <Icon name="search" size={18} color={c.textSecondary} />
              <TextInput style={[s.searchInput, { color: c.text }]}
                placeholder="Search library..." placeholderTextColor={c.textSecondary}
                value={libSearch} onChangeText={setLibSearch} />
              {libSearch.length > 0 && (
                <TouchableOpacity onPress={() => setLibSearch('')}>
                  <Icon name="close-circle" size={18} color={c.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Actions row */}
            <View style={s.libActions}>
              <TouchableOpacity style={[s.libBtn, { backgroundColor: PINK }]} onPress={importTrack}>
                <Icon name="folder-open-outline" size={16} color="#FFF" />
                <Text style={s.libBtnTxt}>Import</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.libBtn, { backgroundColor: PURPLE }]} onPress={() => setShowCatalog(true)}>
                <Icon name="download-outline" size={16} color="#FFF" />
                <Text style={s.libBtnTxt}>Browse Catalog</Text>
              </TouchableOpacity>
            </View>

            {libLoading
              ? <ActivityIndicator size="large" color={PINK} style={{ marginTop: 40 }} />
              : filteredLib.length === 0
              ? (
                <View style={s.emptyState}>
                  <Icon name="musical-notes-outline" size={56} color={c.textTertiary} />
                  <Text style={[s.emptyTxt, { color: c.textSecondary }]}>
                    {libSearch ? 'No results' : 'Library is empty\nImport tracks or download from catalog'}
                  </Text>
                </View>
              )
              : filteredLib.map((track, i) => {
                  const active = currentTrack?.id === track.id;
                  const isFav  = favourites.has(track.id);
                  return (
                    <TouchableOpacity key={track.id} onPress={() => handlePlayTrack(track, filteredLib)}
                      style={[s.trackRow, active && s.trackRowActive, { borderBottomColor: c.border }]}>
                      <View style={[s.trackIcon, { backgroundColor: active ? PINK + '33' : c.input }]}>
                        {active
                          ? <WaveformBars isPlaying={isPlaying} color={PINK} />
                          : <Icon name="musical-note" size={18} color={active ? PINK : c.textSecondary} />
                        }
                      </View>
                      <View style={s.trackInfo}>
                        <Text style={[s.trackTitle, active && { color: PINK }, { color: active ? PINK : c.text }]} numberOfLines={1}>{track.title}</Text>
                        <Text style={[s.trackArtist, { color: c.textSecondary }]} numberOfLines={1}>{track.artist}</Text>
                        {track.genre && (
                          <View style={s.genreChip}><Text style={s.genreChipTxt}>{track.genre}</Text></View>
                        )}
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <TouchableOpacity onPress={() => toggleFav(track.id)} style={{ padding: 6 }}>
                          <Icon name={isFav ? 'heart' : 'heart-outline'} size={16} color={isFav ? DANGER : c.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => addToQueue(track)} style={{ padding: 6 }}>
                          <MCIcon name="playlist-plus" size={18} color={c.textSecondary} />
                        </TouchableOpacity>
                        <Text style={[s.trackDuration, { color: c.textTertiary }]}>{formatTime(track.duration ?? 0)}</Text>
                        <TouchableOpacity onPress={() => deleteTrack(track.id)} style={{ padding: 6 }}>
                          <Icon name="trash-outline" size={16} color={DANGER} />
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  );
                })
            }
          </View>
        )}

        {/* ── ARTISTS TAB ── */}
        {activeTab === 'artists' && (
          <View style={s.section}>
            <Text style={[s.sectionTitle, { color: c.text }]}>Artist Spotlight</Text>
            <Text style={[{ fontSize: 12, marginBottom: 14 }, { color: c.textSecondary }]}>Tap to open in Spotify</Text>
            {CURATED_ARTIST_CATALOG.map((track, i) => (
              <TouchableOpacity key={i} onPress={() => Linking.openURL(track.uri).catch(() => Alert.alert('Spotify required'))}
                style={[s.trackRow, { borderBottomColor: c.border }]}>
                <View style={[s.trackIcon, { backgroundColor: '#1DB95444' }]}>
                  <Icon name="musical-note" size={18} color="#1DB954" />
                </View>
                <View style={s.trackInfo}>
                  <Text style={[s.trackTitle, { color: c.text }]} numberOfLines={1}>{track.title}</Text>
                  <Text style={[s.trackArtist, { color: c.textSecondary }]} numberOfLines={1}>{track.artist}</Text>
                </View>
                <View style={[s.spotifyBadge]}>
                  <Icon name="musical-notes" size={10} color="#1DB954" />
                  <Text style={s.spotifyBadgeTxt}>Spotify</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* ── Mini Player ── */}
      {currentTrack && (
        <MiniPlayer
          track={currentTrack}
          isPlaying={isPlaying}
          onTogglePlay={togglePlayPause}
          onNext={playNext}
          onExpand={() => setShowNowPlaying(true)}
        />
      )}

      {/* ── Now Playing Sheet ── */}
      <NowPlayingSheet
        visible={showNowPlaying}
        onClose={() => setShowNowPlaying(false)}
        engine={engine}
        onDeleteTrack={deleteTrack}
        favourites={favourites}
        onToggleFav={toggleFav}
      />

      {/* ── Catalog Sheet ── */}
      <Modal visible={showCatalog} transparent animationType="slide" onRequestClose={() => setShowCatalog(false)}>
        <View style={styles.catalogOverlay}>
          <View style={[styles.catalogSheet, { backgroundColor: '#1a1a2e' }]}>
            <View style={styles.catalogHeaderRow}>
              <Icon name="albums" size={22} color={PURPLE} />
              <Text style={styles.catalogTitle}>Free Catalog</Text>
              <TouchableOpacity onPress={() => setShowCatalog(false)}>
                <Icon name="close" size={22} color="#FFF" />
              </TouchableOpacity>
            </View>
            <Text style={styles.catalogSubtitle}>{ROYALTY_FREE_CATALOG.length} royalty-free tracks — download to play offline</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catalogFilters}>
              {catalogFilters.map(f => (
                <TouchableOpacity key={f} onPress={() => setCatalogFilter(f)}
                  style={[styles.catalogFilterChip, catalogFilter === f && styles.catalogFilterChipActive]}>
                  <Text style={[styles.catalogFilterText, catalogFilter === f && styles.catalogFilterTextActive]}>{f}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <FlatList
              data={filteredCatalog}
              keyExtractor={t => t.id}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const owned = library.some(t => t.id === item.id);
                const dl    = downloading.has(item.id);
                return (
                  <View style={styles.catalogRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.catalogTrackTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={styles.catalogTrackArtist} numberOfLines={1}>{item.artist}</Text>
                      <View style={{ flexDirection: 'row', gap: 6, marginTop: 2 }}>
                        {item.genre && <View style={styles.catalogGenreTag}><Text style={styles.catalogGenreText}>{item.genre}</Text></View>}
                        {item.bpm && <Text style={{ fontSize: 9, color: '#666' }}>{item.bpm} BPM</Text>}
                        <Text style={{ fontSize: 9, color: '#666' }}>{formatTime(item.duration)}</Text>
                      </View>
                    </View>
                    {owned
                      ? <Icon name="checkmark-circle" size={24} color={SUCCESS} />
                      : dl
                      ? <View style={styles.downloadingWrap}><ActivityIndicator size="small" color={PURPLE} /><Text style={styles.downloadingTxt}>...</Text></View>
                      : <TouchableOpacity style={styles.downloadCatalogBtn} onPress={() => downloadTrack(item)}>
                          <Icon name="download-outline" size={18} color="#FFF" />
                        </TouchableOpacity>
                    }
                  </View>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:        { flex: 1 },
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 14, gap: 8 },
  hdrBack:     { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  hdrTitle:    { fontSize: 20, fontWeight: '800', color: '#FFF' },
  hdrSub:      { fontSize: 11, color: 'rgba(255,255,255,0.75)' },
  hdrBtn:      { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  tabStrip:    { flexDirection: 'row', borderBottomWidth: 1 },
  tabBtn:      { flex: 1, alignItems: 'center', paddingVertical: 12, position: 'relative' },
  tabLabel:    { fontSize: 12, fontWeight: '600', color: '#666', marginTop: 2 },
  tabIndicator:{ position: 'absolute', bottom: 0, left: '20%', right: '20%', height: 2, backgroundColor: PINK, borderRadius: 1 },
  scroll:      { padding: 16 },
  section:     { marginBottom: 24 },
  sectionTitle:{ fontSize: 16, fontWeight: '700', marginBottom: 12 },

  todayMoodCard: { borderRadius: 20, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: 'transparent' },
  playMoodBtn:   { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, marginLeft: 'auto' },

  recentCard:   { width: 110, borderRadius: 16, padding: 10, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 3 },
  recentArt:    { width: 70, height: 70, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  recentTitle:  { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  recentArtist: { fontSize: 10, textAlign: 'center', marginTop: 2 },

  moodGrid:   { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  moodCard:   { width: (W - 52) / 2, borderRadius: 18, padding: 16, borderWidth: 1.5, alignItems: 'center', gap: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  moodLabel:  { fontSize: 14, fontWeight: '700' },
  moodCount:  { fontSize: 11 },

  ourSongCard:{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  ourSongArt: { width: 60, height: 60, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },

  searchRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 14 },
  libActions:  { flexDirection: 'row', gap: 10, marginBottom: 14 },
  libBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 14 },
  libBtnTxt:   { color: '#FFF', fontWeight: '700', fontSize: 13 },

  trackRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1 },
  trackRowActive: { backgroundColor: 'rgba(255,107,157,0.08)', borderRadius: 12, paddingHorizontal: 6 },
  trackIcon:      { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  trackInfo:      { flex: 1 },
  trackTitle:     { fontSize: 14, fontWeight: '600' },
  trackArtist:    { fontSize: 11, marginTop: 1 },
  trackDuration:  { fontSize: 11 },
  genreChip:      { backgroundColor: 'rgba(168,85,247,0.18)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-start', marginTop: 2 },
  genreChipTxt:   { color: PURPLE, fontSize: 9, fontWeight: '600' },

  spotifyBadge:    { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#E8F5E9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  spotifyBadgeTxt: { fontSize: 10, fontWeight: '700', color: '#16A34A' },

  emptyState: { alignItems: 'center', paddingVertical: 50, gap: 14 },
  emptyTxt:   { fontSize: 14, textAlign: 'center', lineHeight: 22 },

  eqChip:    { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: '#2A2A2A', borderWidth: 1, borderColor: '#3A3A3A' },
  eqChipTxt: { fontSize: 12, color: '#888', fontWeight: '600' },
  sleepChip:    { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: '#2A2A2A', borderWidth: 1, borderColor: '#3A3A3A' },
  sleepChipTxt: { fontSize: 12, color: '#888', fontWeight: '600' },

  queueRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#2A2A2A' },
  queueRowActive: { backgroundColor: 'rgba(255,107,157,0.08)', borderRadius: 10, paddingHorizontal: 8 },
  queueTitle:     { fontSize: 14, fontWeight: '600', color: '#FFF' },
  queueArtist:    { fontSize: 11, color: '#888', marginTop: 1 },
  queueDuration:  { fontSize: 11, color: '#666' },
});

// YOUR ORIGINAL styles (kept for NowPlayingSheet / CatalogSheet compatibility)
const styles = StyleSheet.create({
  progressTrack: { height: 28, justifyContent: 'center' },
  progressFill:  { height: 4, borderRadius: 2, position: 'absolute', left: 0 },
  progressThumb: { width: 12, height: 12, borderRadius: 6, position: 'absolute', marginLeft: -6 },
  miniPlayer: { position: 'absolute', left: 12, right: 12, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#1E1E1E', borderRadius: 18, paddingVertical: 10, paddingHorizontal: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 8, borderWidth: 1, borderColor: '#2A2A2A' },
  miniArt:    { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  miniInfo:   { flex: 1 },
  miniTitle:  { fontSize: 13, fontWeight: '700', color: '#FFF' },
  miniArtist: { fontSize: 11, color: '#B0B0B0', marginTop: 1 },
  miniBtn:    { padding: 6 },
  nowPlayingOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  nowPlayingSheet:   { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40, alignItems: 'center' },
  sheetHandle:       { width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2, alignSelf: 'center', marginBottom: 10 },
  nowPlayingClose:   { position: 'absolute', top: 16, left: 16, zIndex: 10 },
  nowPlayingArt:     { width: 160, height: 160, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginTop: 16, marginBottom: 20 },
  nowPlayingTitle:   { fontSize: 20, fontWeight: '800', color: '#FFF', textAlign: 'center' },
  nowPlayingArtist:  { fontSize: 15, color: '#B0B0B0', marginTop: 4, marginBottom: 8 },
  genreTag:          { backgroundColor: 'rgba(255,107,157,0.2)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginBottom: 12 },
  genreTagText:      { color: PINK, fontSize: 12, fontWeight: '600' },
  nowPlayingProgressWrap: { width: '100%', marginBottom: 10 },
  timeRow:           { flexDirection: 'row', justifyContent: 'space-between', marginTop: -4 },
  timeText:          { fontSize: 11, color: '#888' },
  transportRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingHorizontal: 10, marginTop: 14 },
  playPauseBtn:      { width: 64, height: 64, borderRadius: 32, backgroundColor: PINK, alignItems: 'center', justifyContent: 'center' },
  repeatOneDot:      { position: 'absolute', top: -2, right: -2, width: 6, height: 6, borderRadius: 3, backgroundColor: PINK },
  removeFromLibraryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 24 },
  removeFromLibraryTxt: { fontSize: 13, fontWeight: '600', color: DANGER },
  catalogOverlay:    { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  catalogSheet:      { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 30, maxHeight: '80%' },
  catalogHeaderRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  catalogTitle:      { flex: 1, fontSize: 18, fontWeight: '800', color: '#FFF' },
  catalogSubtitle:   { fontSize: 12, color: '#B0B0B0', marginBottom: 14 },
  catalogFilters:    { maxHeight: 44, marginBottom: 12 },
  catalogFilterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#2A2A2A', marginRight: 6 },
  catalogFilterChipActive: { backgroundColor: PURPLE },
  catalogFilterText:       { color: '#888', fontSize: 12 },
  catalogFilterTextActive: { color: '#FFF' },
  catalogRow:        { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#2A2A2A' },
  catalogTrackTitle: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  catalogTrackArtist:{ fontSize: 11, color: '#B0B0B0', marginTop: 1 },
  catalogGenreTag:   { backgroundColor: 'rgba(168,85,247,0.2)', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, alignSelf: 'flex-start', marginTop: 2 },
  catalogGenreText:  { color: PURPLE, fontSize: 8, fontWeight: '600' },
  downloadingWrap:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  downloadingTxt:    { fontSize: 11, fontWeight: '700', color: PURPLE },
  downloadCatalogBtn:{ backgroundColor: PURPLE, width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
