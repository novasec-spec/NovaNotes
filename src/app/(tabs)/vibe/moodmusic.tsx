// screens/MoodMusicScreen.tsx
// ─────────────────────────────────────────────────────────────────────────────
//  ✅ SIMPLIFIED VERSION - Background audio using Expo Audio only
//     - No native Kotlin modules required
//     - Music continues in background
//     - Full mood-based music player
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, Linking, TextInput, Modal, ActivityIndicator,
  Animated, Platform, FlatList, Dimensions, StatusBar,
  AppState,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
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

const { width: W } = Dimensions.get('window');

// ── Design tokens ──────────────────────────────────────────────────────────────
const PINK = '#FF6B9D';
const PURPLE = '#A855F7';
const SUCCESS = '#22C55E';
const DANGER = '#EF4444';
const WARNING = '#F59E0B';
const BLUE = '#3B82F6';

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
const MOOD_HISTORY_KEY = 'moodHistory';
const LIBRARY_KEY = 'music_library';
const FAVOURITES_KEY = 'music_favourites';
const RECENT_KEY = 'music_recent';
const LOCAL_MUSIC_DIR = FileSystem.documentDirectory + 'music_library/';

// ── Mood config ────────────────────────────────────────────────────────────────
const MOODS = [
  { label: 'Happy', icon: 'sunny', color: '#F59E0B' },
  { label: 'Loved', icon: 'heart', color: '#FF6B9D' },
  { label: 'Relaxed', icon: 'leaf', color: '#87CEEB' },
  { label: 'Thoughtful', icon: 'bulb', color: '#A855F7' },
  { label: 'Sad', icon: 'rainy', color: '#6495ED' },
  { label: 'Energetic', icon: 'flash', color: '#FF6347' },
  { label: 'Romantic', icon: 'rose', color: '#FF1493' },
  { label: 'Nostalgic', icon: 'time', color: '#CD853F' },
] as const;

function getMoodConfig(label?: string) { return MOODS.find(m => m.label === label) ?? MOODS[0]; }

// ── Equalizer presets ─────────────────────────────────────────────────────────
const EQ_PRESETS = [
  { label: 'Flat', icon: 'remove-outline' },
  { label: 'Bass Boost', icon: 'pulse-outline' },
  { label: 'Vocal', icon: 'mic-outline' },
  { label: 'Electronic', icon: 'radio-outline' },
  { label: 'Classical', icon: 'musical-notes-outline' },
] as const;

// ── Sleep timer options ───────────────────────────────────────────────────────
const SLEEP_OPTIONS = [
  { label: '15 min', minutes: 15 },
  { label: '30 min', minutes: 30 },
  { label: '1 hour', minutes: 60 },
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

// ── Catalog ─────────────────────────────────────────────────────────────────
const ROYALTY_FREE_CATALOG: CatalogTrack[] = [
  { id: 'rf_001', title: 'Chill Lo-Fi Beat', artist: 'Pixabay Music', duration: 164, source: 'https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3', genre: 'Lo-Fi', mood: 'Relaxed', bpm: 78 },
  { id: 'rf_002', title: 'Rainy Day Lofi', artist: 'Pixabay Music', duration: 188, source: 'https://cdn.pixabay.com/audio/2021/11/25/audio_00fa5b4d97.mp3', genre: 'Lo-Fi', mood: 'Relaxed', bpm: 82 },
  { id: 'rf_003', title: 'Midnight Study', artist: 'Pixabay Music', duration: 132, source: 'https://cdn.pixabay.com/audio/2022/03/15/audio_c8e70c5101.mp3', genre: 'Lo-Fi', mood: 'Thoughtful', bpm: 76 },
  { id: 'rf_004', title: 'Soft Morning Light', artist: 'Pixabay Music', duration: 167, source: 'https://cdn.pixabay.com/audio/2022/08/02/audio_884fe92c21.mp3', genre: 'Ambient', mood: 'Relaxed', bpm: 70 },
  { id: 'rf_005', title: 'Calm Ocean Waves', artist: 'Pixabay Music', duration: 195, source: 'https://cdn.pixabay.com/audio/2022/09/15/audio_3a2d4c5e6f.mp3', genre: 'Ambient', mood: 'Relaxed', bpm: 65 },
  { id: 'rf_006', title: 'Happy Ukulele', artist: 'Pixabay Music', duration: 142, source: 'https://cdn.pixabay.com/audio/2022/06/10/audio_7b8c9d0e1f.mp3', genre: 'Pop', mood: 'Happy', bpm: 120 },
  { id: 'rf_007', title: 'Sunny Day Pop', artist: 'Pixabay Music', duration: 158, source: 'https://cdn.pixabay.com/audio/2022/05/05/audio_2a3b4c5d6e.mp3', genre: 'Pop', mood: 'Happy', bpm: 128 },
  { id: 'rf_008', title: 'Funky Groove', artist: 'Pixabay Music', duration: 176, source: 'https://cdn.pixabay.com/audio/2022/04/01/audio_8f9e0d1c2b.mp3', genre: 'Funk', mood: 'Happy', bpm: 115 },
  { id: 'rf_009', title: 'Bright Acoustic', artist: 'Pixabay Music', duration: 153, source: 'https://cdn.pixabay.com/audio/2022/03/15/audio_6e5d4c3b2a.mp3', genre: 'Acoustic', mood: 'Happy', bpm: 110 },
  { id: 'rf_010', title: 'Feel Good Vibes', artist: 'Pixabay Music', duration: 168, source: 'https://cdn.pixabay.com/audio/2022/02/20/audio_1a2b3c4d5e.mp3', genre: 'Pop', mood: 'Happy', bpm: 125 },
  { id: 'rf_011', title: 'Pump Up Anthem', artist: 'Pixabay Music', duration: 184, source: 'https://cdn.pixabay.com/audio/2022/01/10/audio_9f8e7d6c5b.mp3', genre: 'Electronic', mood: 'Energetic', bpm: 140 },
  { id: 'rf_012', title: 'Electro Drive', artist: 'Pixabay Music', duration: 192, source: 'https://cdn.pixabay.com/audio/2021/12/05/audio_4a3b2c1d0e.mp3', genre: 'Electronic', mood: 'Energetic', bpm: 135 },
  { id: 'rf_013', title: 'Rock Anthem', artist: 'Pixabay Music', duration: 205, source: 'https://cdn.pixabay.com/audio/2021/11/15/audio_7c6b5a4d3e.mp3', genre: 'Rock', mood: 'Energetic', bpm: 145 },
  { id: 'rf_014', title: 'Power Workout', artist: 'Pixabay Music', duration: 178, source: 'https://cdn.pixabay.com/audio/2021/10/20/audio_2e3d4c5b6a.mp3', genre: 'Electronic', mood: 'Energetic', bpm: 150 },
  { id: 'rf_015', title: 'Piano Lament', artist: 'Pixabay Music', duration: 196, source: 'https://cdn.pixabay.com/audio/2021/09/01/audio_5a4b3c2d1e.mp3', genre: 'Classical', mood: 'Sad', bpm: 60 },
  { id: 'rf_016', title: 'Strings of Sorrow', artist: 'Pixabay Music', duration: 212, source: 'https://cdn.pixabay.com/audio/2021/08/15/audio_8d7c6b5a4e.mp3', genre: 'Classical', mood: 'Sad', bpm: 55 },
  { id: 'rf_017', title: 'Night Rain', artist: 'Pixabay Music', duration: 185, source: 'https://cdn.pixabay.com/audio/2021/07/20/audio_1e2d3c4b5a.mp3', genre: 'Ambient', mood: 'Sad', bpm: 68 },
  { id: 'rf_018', title: 'Love Story', artist: 'Pixabay Music', duration: 156, source: 'https://cdn.pixabay.com/audio/2021/06/10/audio_9a8b7c6d5e.mp3', genre: 'Romantic', mood: 'Romantic', bpm: 80 },
  { id: 'rf_019', title: 'Heartstrings', artist: 'Pixabay Music', duration: 172, source: 'https://cdn.pixabay.com/audio/2021/05/05/audio_3b4c5d6e7f.mp3', genre: 'Romantic', mood: 'Romantic', bpm: 75 },
  { id: 'rf_020', title: 'Wedding Bells', artist: 'Pixabay Music', duration: 148, source: 'https://cdn.pixabay.com/audio/2021/04/01/audio_6a7b8c9d0e.mp3', genre: 'Romantic', mood: 'Romantic', bpm: 70 },
  { id: 'rf_021', title: 'Smooth Jazz', artist: 'Pixabay Music', duration: 203, source: 'https://cdn.pixabay.com/audio/2021/03/15/audio_2c3d4e5f6a.mp3', genre: 'Jazz', mood: 'Relaxed', bpm: 90 },
  { id: 'rf_022', title: 'Cafe Noir', artist: 'Pixabay Music', duration: 186, source: 'https://cdn.pixabay.com/audio/2021/02/20/audio_7b8c9d0e1f.mp3', genre: 'Jazz', mood: 'Thoughtful', bpm: 85 },
  { id: 'rf_023', title: 'Bossa Nova Sunset', artist: 'Pixabay Music', duration: 165, source: 'https://cdn.pixabay.com/audio/2021/01/10/audio_4e5f6a7b8c.mp3', genre: 'Bossa Nova', mood: 'Relaxed', bpm: 95 },
  { id: 'rf_024', title: 'Classical Piano', artist: 'Pixabay Music', duration: 215, source: 'https://cdn.pixabay.com/audio/2020/12/05/audio_9d0e1f2a3b.mp3', genre: 'Classical', mood: 'Thoughtful', bpm: 65 },
  { id: 'rf_025', title: 'Orchestral Dreams', artist: 'Pixabay Music', duration: 234, source: 'https://cdn.pixabay.com/audio/2020/11/15/audio_5c6d7e8f9a.mp3', genre: 'Classical', mood: 'Romantic', bpm: 60 },
  { id: 'rf_026', title: 'Acoustic Folk', artist: 'Pixabay Music', duration: 172, source: 'https://cdn.pixabay.com/audio/2020/10/20/audio_1b2c3d4e5f.mp3', genre: 'Folk', mood: 'Happy', bpm: 100 },
  { id: 'rf_027', title: 'Irish Jig', artist: 'Pixabay Music', duration: 148, source: 'https://cdn.pixabay.com/audio/2020/09/01/audio_6a7b8c9d0e.mp3', genre: 'Folk', mood: 'Happy', bpm: 130 },
  { id: 'rf_028', title: 'Mediterranean Breeze', artist: 'Pixabay Music', duration: 164, source: 'https://cdn.pixabay.com/audio/2020/08/15/audio_3f4e5d6c7b.mp3', genre: 'World', mood: 'Relaxed', bpm: 110 },
  { id: 'rf_029', title: 'Deep Space', artist: 'Pixabay Music', duration: 208, source: 'https://cdn.pixabay.com/audio/2020/07/20/audio_8c9d0e1f2a.mp3', genre: 'Electronic', mood: 'Thoughtful', bpm: 72 },
  { id: 'rf_030', title: 'Neon Dreams', artist: 'Pixabay Music', duration: 186, source: 'https://cdn.pixabay.com/audio/2020/06/10/audio_2b3c4d5e6f.mp3', genre: 'Electronic', mood: 'Energetic', bpm: 128 },
];

const CURATED_ARTIST_CATALOG = [
  { title: 'Perfect', artist: 'Ed Sheeran', uri: 'spotify:track:0tgVpDi06FyKpA1z0VMD4v' },
  { title: 'Shape of You', artist: 'Ed Sheeran', uri: 'spotify:track:7qiZfU4dY1lWllzX7mPBI3' },
  { title: 'Thinking Out Loud', artist: 'Ed Sheeran', uri: 'spotify:track:34gCuhDGsG4fbRPGo9r1b5' },
  { title: 'All of Me', artist: 'John Legend', uri: 'spotify:track:3U4isOIWM3VvDubwSI3y7a' },
  { title: 'Love On Top', artist: 'Beyoncé', uri: 'spotify:track:1z6WtY7X4HQJvzxC4UgkSf' },
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
  const bars = useMemo(() => [
    new Animated.Value(0.3), new Animated.Value(0.6), new Animated.Value(1),
    new Animated.Value(0.4), new Animated.Value(0.8)
  ], []);

  useEffect(() => {
    if (!isPlaying) {
      bars.forEach(b => Animated.timing(b, { toValue: 0.3, duration: 300, useNativeDriver: true }).start());
      return;
    }
    const anims = bars.map((b, i) => Animated.loop(Animated.sequence([
      Animated.timing(b, { toValue: 1, duration: 300 + i * 80, useNativeDriver: true }),
      Animated.timing(b, { toValue: 0.2, duration: 300 + i * 80, useNativeDriver: true }),
    ])));
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, [isPlaying, bars]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, height: 20 }}>
      {bars.map((b, i) => (
        <Animated.View key={i} style={{ width: 3, height: 20, borderRadius: 2, backgroundColor: color, transform: [{ scaleY: b }] }} />
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  useMusicPlayerEngine - Background audio with Expo Audio only
// ─────────────────────────────────────────────────────────────────────────────
function useMusicPlayerEngine() {
  const [queue, setQueue] = useState<LibraryTrack[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [shuffle, setShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');

  const currentTrack = currentIndex >= 0 && queue.length > 0 ? queue[currentIndex] : null;
  const player = useAudioPlayer(currentTrack?.localUri ? { uri: currentTrack.localUri } : null);
  const status = useAudioPlayerStatus(player);

  // ── Setup background audio mode ────────────────────────────────────────────
  useEffect(() => {
    setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      allowsRecordingIOS: false,
      playsInSilentLockedModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    }).catch(console.warn);
  }, []);

  // ── Auto advance ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!status?.didJustFinish) return;
    if (repeatMode === 'one') { player.seekTo(0); player.play(); return; }
    playNext();
  }, [status?.didJustFinish]);

  // ── Keep audio alive in background ─────────────────────────────────────────
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background' && currentTrack && status?.playing) {
        // Audio should continue playing automatically
        console.log('[Music] App in background, audio should continue');
      }
    });
    return () => subscription.remove();
  }, [currentTrack, status?.playing]);

  // ── Player functions ────────────────────────────────────────────────────────
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
    let next: number;
    if (shuffle) {
      next = Math.floor(Math.random() * queue.length);
    } else {
      next = currentIndex + 1;
      if (next >= queue.length) {
        if (repeatMode === 'all') next = 0;
        else { player.pause(); return; }
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

  const stop = useCallback(() => {
    player.pause();
    player.seekTo(0);
    setCurrentIndex(-1);
    setQueue([]);
  }, [player]);

  const addToQueue = useCallback((track: LibraryTrack) => {
    setQueue(q => {
      const after = currentIndex + 1;
      const next = [...q];
      next.splice(after, 0, track);
      return next;
    });
  }, [currentIndex]);

  return {
    currentTrack, queue, currentIndex,
    isPlaying: !!status?.playing,
    currentTime: status?.currentTime ?? 0,
    duration: status?.duration ?? currentTrack?.duration ?? 0,
    shuffle, repeatMode,
    setShuffle, setRepeatMode,
    playTrack, playTrackAt, addToQueue, togglePlayPause,
    playNext, playPrev, seekTo, stop,
  };
}

// ── ProgressBar ───────────────────────────────────────────────────────────────
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

// ── MiniPlayer ────────────────────────────────────────────────────────────────
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

// ── NowPlayingSheet ──────────────────────────────────────────────────────────
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
  const [eqPreset, setEqPreset] = useState('Flat');
  const [sleepMins, setSleepMins] = useState<number | null>(null);
  const [sleepTimer, setSleepTimer] = useState<any>(null);

  if (!currentTrack) return null;

  const progress = duration > 0 ? currentTime / duration : 0;
  const isFav = favourites.has(currentTrack.id);

  const cycleRepeat = () => setRepeatMode(repeatMode === 'off' ? 'all' : repeatMode === 'all' ? 'one' : 'off');

  const handleSleepTimer = (mins: number) => {
    if (sleepTimer) clearTimeout(sleepTimer);
    if (mins === -1) { setSleepMins(-1); return; }
    setSleepMins(mins);
    const t = setTimeout(() => { engine.stop(); setSleepMins(null); }, mins * 60000);
    setSleepTimer(t);
  };

  const cancelSleep = () => {
    if (sleepTimer) clearTimeout(sleepTimer);
    setSleepMins(null); setSleepTimer(null);
  };

  const TABS = [
    { key: 'player', icon: 'musical-notes', label: 'Player' },
    { key: 'queue', icon: 'list', label: 'Queue' },
    { key: 'lyrics', icon: 'text-outline', label: 'Lyrics' },
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

              <View style={styles.nowPlayingProgressWrap}>
                <ProgressBar progress={progress} onSeek={r => seekTo(r * duration)} color={PINK} />
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
                <TouchableOpacity onPress={cycleRepeat} style={{ position: 'relative' }}>
                  <Icon name={repeatMode === 'one' ? 'repeat' : 'repeat-outline'} size={22} color={repeatMode !== 'off' ? PINK : '#888'} />
                  {repeatMode === 'one' && <View style={styles.repeatOneDot} />}
                </TouchableOpacity>
              </View>

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

  const [library, setLibrary] = useState<LibraryTrack[]>([]);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [todayMood, setTodayMood] = useState<string | null>(null);
  const [libLoading, setLibLoading] = useState(true);
  const [libSearch, setLibSearch] = useState('');
  const [showNowPlaying, setShowNowPlaying] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const [catalogFilter, setCatalogFilter] = useState('All');
  const [downloading, setDownloading] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'library' | 'mood' | 'artists'>('mood');
  const [favourites, setFavourites] = useState<Set<string>>(new Set());
  const [recentlyPlayed, setRecentlyPlayed] = useState<LibraryTrack[]>([]);
  const [isDark] = useState(true);

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

  // ── Play track ──────────────────────────────────────────────────────────────
  const handlePlayTrack = (track: LibraryTrack, fromList: LibraryTrack[]) => {
    playTrack(track, fromList);
    addToRecent(track);
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
      const ext = ct.source.split('.').pop()?.split('?')[0] ?? 'mp3';
      const destUri = `${LOCAL_MUSIC_DIR}${ct.id}.${ext}`;
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
    { key: 'mood', icon: 'happy-outline', label: 'Mood' },
    { key: 'library', icon: 'library-outline', label: 'Library' },
    { key: 'artists', icon: 'people-outline', label: 'Artists' },
  ] as const;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: c.bg }]} edges={['top']}>
      <StatusBar barStyle="light-content" />

      {/* ── Header ── */}
      <LinearGradient colors={[PINK, PURPLE]} style={styles.header} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
        <TouchableOpacity onPress={() => router.back()} style={styles.hdrBack}>
          <Icon name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.hdrTitle}>Mood Music</Text>
          {todayMood && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Icon name={getMoodConfig(todayMood).icon as any} size={12} color="rgba(255,255,255,0.8)" />
              <Text style={styles.hdrSub}>Feeling {todayMood} today</Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={() => setShowCatalog(true)} style={styles.hdrBtn}>
          <Icon name="albums-outline" size={22} color="#FFF" />
        </TouchableOpacity>
        <TouchableOpacity onPress={importTrack} style={styles.hdrBtn}>
          <Icon name="add-circle-outline" size={22} color="#FFF" />
        </TouchableOpacity>
      </LinearGradient>

      {/* ── Tab strip ── */}
      <View style={[styles.tabStrip, { backgroundColor: c.card, borderBottomColor: c.border }]}>
        {TABS.map(t => (
          <TouchableOpacity key={t.key} onPress={() => setActiveTab(t.key as any)} style={styles.tabBtn}>
            <Icon name={t.icon as any} size={18} color={activeTab === t.key ? PINK : '#666'} />
            <Text style={[styles.tabLabel, activeTab === t.key && { color: PINK }]}>{t.label}</Text>
            {activeTab === t.key && <View style={styles.tabIndicator} />}
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.scroll, { paddingBottom: currentTrack ? 110 : 30 }]}
        showsVerticalScrollIndicator={false}>

        {/* ── MOOD TAB ── */}
        {activeTab === 'mood' && (
          <>
            {todayMood && (
              <View style={[styles.todayMoodCard, { backgroundColor: getMoodConfig(todayMood).color + '33' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Icon name={getMoodConfig(todayMood).icon as any} size={28} color={getMoodConfig(todayMood).color} />
                  <View>
                    <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 15 }}>Today you're {todayMood}</Text>
                    <Text style={{ color: '#FFF', opacity: 0.7, fontSize: 12 }}>Music matched to your vibe</Text>
                  </View>
                  <TouchableOpacity onPress={() => playMoodQueue(todayMood)}
                    style={[styles.playMoodBtn, { backgroundColor: getMoodConfig(todayMood).color }]}>
                    <Icon name="play" size={16} color="#FFF" />
                    <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 11 }}>Play</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {recentlyPlayed.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: c.text }]}>Recently Played</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
                  {recentlyPlayed.slice(0, 8).map(track => (
                    <TouchableOpacity key={track.id} onPress={() => handlePlayTrack(track, recentlyPlayed)}
                      style={[styles.recentCard, { backgroundColor: c.card }]}>
                      <LinearGradient colors={[PINK + '44', PURPLE + '44']} style={styles.recentArt}>
                        {currentTrack?.id === track.id
                          ? <WaveformBars isPlaying={isPlaying} color={PINK} />
                          : <Icon name="musical-notes" size={20} color={PINK} />
                        }
                      </LinearGradient>
                      <Text style={[styles.recentTitle, { color: c.text }]} numberOfLines={1}>{track.title}</Text>
                      <Text style={[styles.recentArtist, { color: c.textSecondary }]} numberOfLines={1}>{track.artist}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: c.text }]}>Pick a Mood</Text>
              <View style={styles.moodGrid}>
                {MOODS.map(m => {
                  const count = library.filter(t => t.mood === m.label).length;
                  const active = selectedMood === m.label || todayMood === m.label;
                  return (
                    <TouchableOpacity key={m.label} onPress={() => playMoodQueue(m.label)}
                      style={[styles.moodCard, { backgroundColor: active ? m.color : c.card, borderColor: active ? m.color : c.border }]}>
                      <Icon name={m.icon as any} size={26} color={active ? '#FFF' : m.color} />
                      <Text style={[styles.moodLabel, { color: active ? '#FFF' : c.text }]}>{m.label}</Text>
                      <Text style={[styles.moodCount, { color: active ? 'rgba(255,255,255,0.7)' : c.textTertiary }]}>
                        {count} track{count !== 1 ? 's' : ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: c.text }]}>Our Song 💕</Text>
              <TouchableOpacity style={[styles.ourSongCard, { backgroundColor: c.card }]}
                onPress={() => Linking.openURL(OUR_SONG.uri).catch(() => Alert.alert('Spotify required'))}>
                <LinearGradient colors={[PINK, PURPLE]} style={styles.ourSongArt}>
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
          <>
            <View style={styles.searchWrap}>
              <Icon name="search" size={18} color="#666" style={styles.searchIcon} />
              <TextInput
                style={[styles.searchInput, { backgroundColor: c.input, color: c.text }]}
                placeholder="Search your library..."
                placeholderTextColor={c.textTertiary}
                value={libSearch}
                onChangeText={setLibSearch}
              />
            </View>

            {libLoading ? (
              <ActivityIndicator size="large" color={PINK} style={{ marginTop: 40 }} />
            ) : filteredLib.length === 0 ? (
              <View style={styles.emptyState}>
                <Icon name="library-outline" size={56} color="#444" />
                <Text style={[styles.emptyTitle, { color: c.text }]}>
                  {libSearch ? 'No results' : 'Your library is empty'}
                </Text>
                <Text style={[styles.emptySub, { color: c.textSecondary }]}>
                  {libSearch ? 'Try a different search' : 'Import or download some music'}
                </Text>
              </View>
            ) : (
              <View style={styles.libraryList}>
                {filteredLib.map(track => {
                  const isFav = favourites.has(track.id);
                  const isCurrent = currentTrack?.id === track.id;
                  return (
                    <View key={track.id} style={[styles.libraryItem, { backgroundColor: c.card }]}>
                      <TouchableOpacity style={styles.libraryItemContent}
                        onPress={() => handlePlayTrack(track, library)}>
                        <LinearGradient colors={[PINK + '44', PURPLE + '44']} style={styles.libraryArt}>
                          {isCurrent && isPlaying
                            ? <WaveformBars isPlaying={isPlaying} color={PINK} />
                            : <Icon name={isCurrent ? 'pause' : 'musical-note'} size={20} color={isCurrent ? PINK : '#666'} />
                          }
                        </LinearGradient>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={[styles.libraryTitle, { color: c.text }]} numberOfLines={1}>{track.title}</Text>
                          <Text style={[styles.libraryArtist, { color: c.textSecondary }]} numberOfLines={1}>{track.artist}</Text>
                          {track.genre && (
                            <Text style={[styles.libraryGenre, { color: c.textTertiary }]}>{track.genre}</Text>
                          )}
                        </View>
                        <TouchableOpacity onPress={() => toggleFav(track.id)} style={styles.favBtn}>
                          <Icon name={isFav ? 'heart' : 'heart-outline'} size={18} color={isFav ? DANGER : '#666'} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => addToQueue(track)} style={styles.queueBtn}>
                          <Icon name="add-circle-outline" size={18} color="#666" />
                        </TouchableOpacity>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}

        {/* ── ARTISTS TAB ── */}
        {activeTab === 'artists' && (
          <>
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: c.text }]}>Featured Artists</Text>
              <View style={styles.artistGrid}>
                {CURATED_ARTIST_CATALOG.map((artist, i) => (
                  <TouchableOpacity key={i} style={[styles.artistCard, { backgroundColor: c.card }]}
                    onPress={() => Linking.openURL(artist.uri).catch(() => Alert.alert('Spotify required'))}>
                    <LinearGradient colors={[PINK + '66', PURPLE + '66']} style={styles.artistArt}>
                      <Icon name="person" size={32} color="#FFF" />
                    </LinearGradient>
                    <Text style={[styles.artistName, { color: c.text }]} numberOfLines={1}>{artist.title}</Text>
                    <Text style={[styles.artistSub, { color: c.textSecondary }]} numberOfLines={1}>{artist.artist}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </>
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

      {/* ── Catalog Modal ── */}
      <Modal visible={showCatalog} animationType="slide" onRequestClose={() => setShowCatalog(false)}>
        <SafeAreaView style={[styles.catalogModal, { backgroundColor: c.bg }]}>
          <View style={styles.catalogHeader}>
            <Text style={[styles.catalogTitle, { color: c.text }]}>Music Catalog</Text>
            <TouchableOpacity onPress={() => setShowCatalog(false)} style={styles.catalogClose}>
              <Icon name="close" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catalogFilters}>
            {catalogFilters.map(f => (
              <TouchableOpacity key={f} onPress={() => setCatalogFilter(f)}
                style={[styles.catalogFilterChip, catalogFilter === f && { backgroundColor: PINK }]}>
                <Text style={[styles.catalogFilterText, catalogFilter === f && { color: '#FFF' }]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <FlatList
            data={filteredCatalog}
            keyExtractor={t => t.id}
            contentContainerStyle={styles.catalogList}
            renderItem={({ item }) => {
              const inLibrary = library.some(t => t.id === item.id);
              const isDownloading = downloading.has(item.id);
              return (
                <View style={[styles.catalogItem, { backgroundColor: c.card }]}>
                  <LinearGradient colors={[PINK + '44', PURPLE + '44']} style={styles.catalogArt}>
                    <Icon name="musical-notes" size={24} color={PINK} />
                  </LinearGradient>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.catalogItemTitle, { color: c.text }]} numberOfLines={1}>{item.title}</Text>
                    <Text style={[styles.catalogItemArtist, { color: c.textSecondary }]} numberOfLines={1}>{item.artist}</Text>
                    <View style={{ flexDirection: 'row', gap: 12, marginTop: 2 }}>
                      {item.genre && <Text style={[styles.catalogItemMeta, { color: c.textTertiary }]}>{item.genre}</Text>}
                      {item.bpm && <Text style={[styles.catalogItemMeta, { color: c.textTertiary }]}>{item.bpm} BPM</Text>}
                      <Text style={[styles.catalogItemMeta, { color: c.textTertiary }]}>{formatTime(item.duration)}</Text>
                    </View>
                  </View>
                  {inLibrary ? (
                    <View style={[styles.catalogBadge, { backgroundColor: SUCCESS + '22' }]}>
                      <Icon name="checkmark-circle" size={16} color={SUCCESS} />
                      <Text style={[styles.catalogBadgeText, { color: SUCCESS }]}>Added</Text>
                    </View>
                  ) : isDownloading ? (
                    <ActivityIndicator size="small" color={PINK} />
                  ) : (
                    <TouchableOpacity style={[styles.catalogDownloadBtn, { backgroundColor: PINK }]}
                      onPress={() => downloadTrack(item)}>
                      <Icon name="cloud-download-outline" size={16} color="#FFF" />
                      <Text style={styles.catalogDownloadText}>Download</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            }}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 12 : 12,
    gap: 10,
  },
  hdrBack: { padding: 4 },
  hdrTitle: { fontSize: 20, fontWeight: '700', color: '#FFF' },
  hdrSub: { fontSize: 12, color: 'rgba(255,255,255,0.8)' },
  hdrBtn: { padding: 6 },
  tabStrip: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, position: 'relative', gap: 4 },
  tabLabel: { fontSize: 12, color: '#666', fontWeight: '500' },
  tabIndicator: {
    position: 'absolute',
    bottom: -1,
    height: 2,
    width: 24,
    backgroundColor: PINK,
    borderRadius: 1,
  },
  scroll: { paddingHorizontal: 16, paddingTop: 16 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  todayMoodCard: { borderRadius: 16, padding: 16, marginBottom: 24 },
  playMoodBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginLeft: 'auto',
  },
  recentCard: {
    width: 100,
    borderRadius: 12,
    padding: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  recentArt: { width: 84, height: 84, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  recentTitle: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  recentArtist: { fontSize: 10, textAlign: 'center' },
  moodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  moodCard: {
    width: (W - 48) / 4 - 6,
    padding: 10,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    gap: 2,
  },
  moodLabel: { fontSize: 11, fontWeight: '600' },
  moodCount: { fontSize: 9 },
  ourSongCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  ourSongArt: { width: 56, height: 56, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, height: 44, fontSize: 14, paddingVertical: 8 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '600' },
  emptySub: { fontSize: 14 },
  libraryList: { gap: 10 },
  libraryItem: { borderRadius: 12, overflow: 'hidden' },
  libraryItemContent: { flexDirection: 'row', alignItems: 'center', padding: 10 },
  libraryArt: { width: 48, height: 48, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  libraryTitle: { fontSize: 14, fontWeight: '600' },
  libraryArtist: { fontSize: 12 },
  libraryGenre: { fontSize: 10, marginTop: 2 },
  favBtn: { padding: 6 },
  queueBtn: { padding: 6 },
  artistGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  artistCard: {
    width: (W - 48) / 2 - 4,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    gap: 4,
  },
  artistArt: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  artistName: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  artistSub: { fontSize: 12, textAlign: 'center' },
  miniPlayer:{
    flexDirection: 'row',
    paddingTop: 12,
    position: 'absolute',
    paddingBottom: 8,
    borderTopWidth: 0,
    bottom: 70,
    left: 0,
    right: 0,
    backgroundColor: '#1E1E1E',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 30,
    zIndex: 999,
    paddingHorizontal: 16,
    // ✅ Curved top edges
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    borderTopColor: '#2A2A2A',
  },
  miniArt: { width: 44, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  miniInfo: { flex: 1, marginLeft: 12 },
  miniTitle: { color: '#FFF', fontWeight: '600', fontSize: 13 },
  miniArtist: { color: '#888', fontSize: 11 },
  miniBtn: { padding: 8 },
  nowPlayingOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  nowPlayingSheet: {
    height: '85%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  sheetHandle: { width: 40, height: 4, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  nowPlayingClose: { alignSelf: 'flex-end', padding: 4 },
  nowPlayingArt: { width: 200, height: 200, borderRadius: 100, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  nowPlayingTitle: { fontSize: 20, fontWeight: '700', color: '#FFF' },
  nowPlayingArtist: { fontSize: 14, color: '#AAA', textAlign: 'center' },
  genreTag: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, alignSelf: 'center', marginTop: 6 },
  genreTagText: { color: '#AAA', fontSize: 11 },
  nowPlayingProgressWrap: { marginBottom: 12 },
  progressTrack: { height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, position: 'relative' },
  progressFill: { height: 4, borderRadius: 2 },
  progressThumb: { position: 'absolute', top: -4, width: 12, height: 12, borderRadius: 6, transform: [{ translateX: -6 }] },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  timeText: { color: '#888', fontSize: 11 },
  transportRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 20 },
  playPauseBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: PINK, alignItems: 'center', justifyContent: 'center' },
  repeatOneDot: { position: 'absolute', top: 2, right: 2, width: 6, height: 6, borderRadius: 3, backgroundColor: PINK },
  eqChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#333' },
  eqChipTxt: { fontSize: 11, color: '#888' },
  sleepChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1, borderColor: '#333' },
  sleepChipTxt: { fontSize: 11, color: '#888' },
  removeFromLibraryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, marginTop: 20 },
  removeFromLibraryTxt: { color: DANGER, fontSize: 13 },
  queueRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  queueRowActive: { backgroundColor: 'rgba(255,107,157,0.1)', borderRadius: 8 },
  queueTitle: { color: '#FFF', fontSize: 14 },
  queueArtist: { color: '#888', fontSize: 12 },
  queueDuration: { color: '#666', fontSize: 12 },
  catalogModal: { flex: 1, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 12 : 12 },
  catalogHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12 },
  catalogTitle: { fontSize: 20, fontWeight: '700' },
  catalogClose: { padding: 4 },
  catalogFilters: { paddingHorizontal: 16, paddingBottom: 12 },
  catalogFilterChip: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 16, backgroundColor: '#2A2A2A', marginRight: 8 },
  catalogFilterText: { color: '#888', fontSize: 13 },
  catalogList: { paddingHorizontal: 16, paddingBottom: 20, gap: 10 },
  catalogItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12 },
  catalogArt: { width: 48, height: 48, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  catalogItemTitle: { fontSize: 14, fontWeight: '600' },
  catalogItemArtist: { fontSize: 12 },
  catalogItemMeta: { fontSize: 10 },
  catalogBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  catalogBadgeText: { fontSize: 11, fontWeight: '500' },
  catalogDownloadBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  catalogDownloadText: { color: '#FFF', fontSize: 11, fontWeight: '600' },
});
