// screens/MoodMusicScreen.tsx
// ─────────────────────────────────────────────────────────────────────────────
//  ✅ PRODUCTION-GRADE MUSIC PLAYER
//     - Auto-scan device music
//     - Background audio with Expo Audio
//     - Professional media-style UI
//     - Full playback controls with queue
//     - Sleep timer, EQ presets, favorites
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
  Animated,
  Platform,
  FlatList,
  Dimensions,
  StatusBar,
  AppState,
  RefreshControl,
  Linking,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import MusicNotificationBridge from '../../../../modules/expo-music-notification';
import { LinearGradient } from 'expo-linear-gradient';
import * as MediaLibrary from 'expo-media-library';
import * as Notifications from 'expo-notifications';
import { Audio } from 'expo-av';

const { width: W, height: H } = Dimensions.get('window');

// ── Design Tokens ──────────────────────────────────────────────────────────────
const PINK = '#FF6B9D';
const PURPLE = '#A855F7';
const SUCCESS = '#22C55E';
const DANGER = '#EF4444';
const WARNING = '#F59E0B';
const BLUE = '#3B82F6';
const ORANGE = '#F97316';

const COLORS = {
  light: {
    bg: '#F8F4F6', 
    card: '#FFFFFF', 
    text: '#1A0A14',
    textSecondary: '#7A5A6E', 
    textTertiary: '#B895A8',
    border: '#F0E8EA', 
    shadow: 'rgba(0,0,0,0.06)', 
    input: '#F5EEF0',
    surface: '#FDF9FB',
  },
  dark: {
    bg: '#0A0A0F', 
    card: '#181820', 
    text: '#FFFFFF',
    textSecondary: '#A8A8B8', 
    textTertiary: '#686878',
    border: '#282835', 
    shadow: 'rgba(0,0,0,0.5)', 
    input: '#20202A',
    surface: '#12121A',
  },
};

// ── Storage Keys ──────────────────────────────────────────────────────────────
const STORAGE = {
  LIBRARY: 'music_library_v2',
  FAVORITES: 'music_favorites_v2',
  RECENT: 'music_recent_v2',
  PLAYLISTS: 'music_playlists_v2',
  SETTINGS: 'music_settings_v2',
  CACHE: 'music_cache_v2',
};

// ── Types ─────────────────────────────────────────────────────────────────────
type RepeatMode = 'off' | 'all' | 'one';
type PlaybackSpeed = 0.5 | 0.75 | 1.0 | 1.25 | 1.5 | 2.0;

interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number;
  uri: string;
  artwork?: string;
  genre?: string;
  year?: string;
  bpm?: number;
  isFavorite?: boolean;
  playCount?: number;
  lastPlayed?: string;
  addedAt: string;
  source: 'device' | 'imported' | 'downloaded' | 'stream';
}

interface Playlist {
  id: string;
  name: string;
  description?: string;
  artwork?: string;
  tracks: string[];
  created: string;
  updated: string;
}

interface PlayerState {
  currentTrack: Track | null;
  queue: Track[];
  currentIndex: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  shuffle: boolean;
  repeatMode: RepeatMode;
  speed: PlaybackSpeed;
  volume: number;
}

// ── Audio Scanner ──────────────────────────────────────────────────────────────
class AudioScanner {
  private static instance: AudioScanner;
  private isScanning = false;

  static getInstance() {
    if (!AudioScanner.instance) {
      AudioScanner.instance = new AudioScanner();
    }
    return AudioScanner.instance;
  }

  async scanDeviceMusic(): Promise<Track[]> {
    if (this.isScanning) return [];
    this.isScanning = true;

    try {
      // Request permissions
      const [mediaPerm, notificationPerm] = await Promise.all([
        this.requestMediaPermissions(),
        this.requestNotificationPermissions(),
      ]);

      if (!mediaPerm) {
        throw new Error('Media library permission required');
      }

      // Get all audio assets
      const media = await MediaLibrary.getAssetsAsync({
        mediaType: ['audio'],
        sortBy: ['title'],
        first: 1000,
      });

      // Build an albumId -> artwork map ONCE up front. The previous version
      // called MediaLibrary.getAlbumsAsync() (which lists every album on the
      // device) separately for EACH track that had an albumId — for a
      // library of a few hundred songs that's hundreds of redundant, slow
      // native calls, which is what made scanning look like it hung forever.
      this.notifyProgress?.(0, media.assets.length);
      const albumArtworkMap = await this.buildAlbumArtworkMap();

      // Process tracks in small batches so we can report progress and avoid
      // hammering the native bridge with hundreds of concurrent calls at once.
      const tracks: Track[] = [];
      const batchSize = 25;

      for (let i = 0; i < media.assets.length; i += batchSize) {
        const batch = media.assets.slice(i, i + batchSize);
        const batchTracks = await Promise.all(
          batch.map(async (asset) => {
            let info: MediaLibrary.AssetInfo | null = null;
            try {
              info = await MediaLibrary.getAssetInfoAsync(asset);
            } catch (e) {
              // A single unreadable file shouldn't abort the whole scan.
              console.warn('[AudioScanner] Could not read asset info for', asset.filename, e);
            }
            return {
              id: asset.id,
              title: asset.filename?.replace(/\.[^/.]+$/, '') || 'Unknown Track',
              artist: this.extractMetadata(info, 'artist') || 'Unknown Artist',
              album: this.extractMetadata(info, 'album') || '',
              duration: asset.duration || 0,
              uri: info?.localUri || asset.uri,
              artwork: asset.albumId ? albumArtworkMap.get(asset.albumId) : undefined,
              genre: this.extractMetadata(info, 'genre') || '',
              year: this.extractMetadata(info, 'year') || '',
              addedAt: new Date().toISOString(),
              source: 'device' as const,
              playCount: 0,
            };
          })
        );
        tracks.push(...batchTracks);
        this.notifyProgress?.(Math.min(i + batchSize, media.assets.length), media.assets.length);
      }

      // Cache results
      await this.cacheTracks(tracks);
      return tracks;

    } catch (error) {
      console.error('[AudioScanner] Scan error:', error);
      throw error;
    } finally {
      this.isScanning = false;
    }
  }

  notifyProgress: ((done: number, total: number) => void) | null = null;

  private async buildAlbumArtworkMap(): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    try {
      const albums = await MediaLibrary.getAlbumsAsync({ includeSmartAlbums: true });
      await Promise.all(
        albums.map(async (album) => {
          if (!album.assetCount || album.assetCount === 0) return;
          try {
            const assets = await MediaLibrary.getAssetsAsync({ album, first: 1 });
            if (assets.assets.length > 0) {
              map.set(album.id, assets.assets[0].uri);
            }
          } catch {
            // Skip artwork for this album, non-fatal.
          }
        })
      );
    } catch (error) {
      console.warn('[AudioScanner] Could not load album artwork:', error);
    }
    return map;
  }

  private async requestMediaPermissions(): Promise<boolean> {
    try {
      // Use expo-media-library's own permission request on both platforms.
      // On Android 13+ (API 33) READ_EXTERNAL_STORAGE no longer grants media
      // access — the correct runtime permission is READ_MEDIA_AUDIO, which
      // MediaLibrary.requestPermissionsAsync() already requests internally.
      // Manually asking PermissionsAndroid for READ_EXTERNAL_STORAGE (as this
      // previously did) silently fails on modern Android, which is why the
      // scan never found anything and the screen looked stuck loading.
      const { status, canAskAgain } = await MediaLibrary.requestPermissionsAsync();

      if (status === 'granted') return true;

      if (!canAskAgain) {
        Alert.alert(
          'Permission Needed',
          'Music access was previously denied. Enable it in your device Settings to scan your library.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
      }

      return false;
    } catch (error) {
      console.error('[AudioScanner] Permission error:', error);
      return false;
    }
  }

  private async requestNotificationPermissions(): Promise<boolean> {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      return status === 'granted';
    } catch {
      return false;
    }
  }

  private extractMetadata(info: any, key: string): string | null {
    try {
      if (info?.exif?.common?.[key]) return info.exif.common[key];
      if (info?.exif?.common?.[key]?.[0]) return info.exif.common[key][0];
      return null;
    } catch {
      return null;
    }
  }

  private async cacheTracks(tracks: Track[]) {
    try {
      await AsyncStorage.setItem(STORAGE.CACHE, JSON.stringify({
        tracks,
        timestamp: Date.now(),
      }));
    } catch (error) {
      console.error('[AudioScanner] Cache error:', error);
    }
  }

  async getCachedTracks(): Promise<Track[] | null> {
    try {
      const cached = await AsyncStorage.getItem(STORAGE.CACHE);
      if (!cached) return null;
      const data = JSON.parse(cached);
      // Cache valid for 1 hour
      if (Date.now() - data.timestamp > 3600000) return null;
      return data.tracks;
    } catch {
      return null;
    }
  }
}

// ── Music Player Engine ──────────────────────────────────────────────────────
class MusicPlayerEngine {
  private static instance: MusicPlayerEngine;
  private player: Audio.Sound | null = null;
  private state: PlayerState = {
    currentTrack: null,
    queue: [],
    currentIndex: -1,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    shuffle: false,
    repeatMode: 'off',
    speed: 1.0,
    volume: 1.0,
  };
  private listeners: Set<(state: PlayerState) => void> = new Set();
  private progressInterval: NodeJS.Timeout | null = null;
  private isInitialized = false;
  private notifiedTrackId: string | null = null;
  private notificationSubs: { remove: () => void }[] = [];

  static getInstance() {
    if (!MusicPlayerEngine.instance) {
      MusicPlayerEngine.instance = new MusicPlayerEngine();
    }
    return MusicPlayerEngine.instance;
  }

  private constructor() {
    this.initAudioMode();
    this.setupNotificationListeners();
  }

  // Wires the MediaStyle notification's Play/Pause/Next/Previous buttons
  // (plus lock screen, headset button, and Bluetooth controls — all funneled
  // through the same MediaSessionCallback on the native side) back into the
  // exact same engine methods the in-app UI uses.
  private setupNotificationListeners() {
    if (!MusicNotificationBridge.isAvailable) return;
    this.notificationSubs.push(
      MusicNotificationBridge.onPlay(() => this.play()),
      MusicNotificationBridge.onPause(() => this.pause()),
      MusicNotificationBridge.onNext(() => this.skipNext()),
      MusicNotificationBridge.onPrevious(() => this.skipPrevious()),
      MusicNotificationBridge.onSeek(({ positionSeconds }) => this.seekTo(positionSeconds)),
      MusicNotificationBridge.onStop(() => this.pause())
    );
  }

  // Keeps the native notification in sync with every state change. Only
  // sends the (heavier) full track payload when the track actually changes;
  // routine progress ticks just update play/pause + position.
  private syncNotification() {
    if (!MusicNotificationBridge.isAvailable) return;
    const { currentTrack, isPlaying, currentTime, duration } = this.state;

    if (!currentTrack) {
      if (this.notifiedTrackId !== null) {
        MusicNotificationBridge.hideNotification();
        this.notifiedTrackId = null;
      }
      return;
    }

    if (currentTrack.id !== this.notifiedTrackId) {
      this.notifiedTrackId = currentTrack.id;
      MusicNotificationBridge.showNotification(
        {
          id: currentTrack.id,
          title: currentTrack.title,
          artist: currentTrack.artist,
          album: currentTrack.album,
          artworkUri: currentTrack.artwork,
          duration: duration || currentTrack.duration || 0,
        },
        isPlaying
      );
    } else {
      MusicNotificationBridge.updatePlaybackState(isPlaying, currentTime, duration);
    }
  }

  private async initAudioMode() {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        interruptionModeIOS: 1,
        interruptionModeAndroid: 1,
      });
      this.isInitialized = true;
    } catch (error) {
      console.error('[MusicPlayer] Audio mode init error:', error);
    }
  }

  async playTrack(track: Track, queue: Track[], index: number) {
    try {
      await this.cleanup();

      const sound = new Audio.Sound();
      await sound.loadAsync(
        { uri: track.uri },
        { shouldPlay: true, progressUpdateIntervalMillis: 500 }
      );

      await sound.setVolumeAsync(this.state.volume);
      await sound.setRateAsync(this.state.speed, true);

      this.player = sound;
      this.state.currentTrack = track;
      this.state.queue = queue;
      this.state.currentIndex = index;
      this.state.duration = track.duration || 0;
      this.state.isPlaying = true;

      this.startProgressTracking();
      this.notifyListeners();

      // Set up audio interruption handler
      sound.setOnPlaybackStatusUpdate(this.handlePlaybackStatus.bind(this));

      // Register for background playback
      this.setupBackgroundMode();

    } catch (error) {
      console.error('[MusicPlayer] Play error:', error);
      throw error;
    }
  }

  private handlePlaybackStatus(status: any) {
    if (!status.isLoaded) return;

    this.state.currentTime = status.positionMillis / 1000;
    this.state.duration = status.durationMillis / 1000;
    this.state.isPlaying = status.isPlaying;

    // Auto-advance when finished
    if (status.didJustFinish) {
      this.handleTrackEnd();
    }

    this.notifyListeners();
  }

  private async handleTrackEnd() {
    if (this.state.repeatMode === 'one') {
      await this.seekTo(0);
      await this.play();
      return;
    }

    const nextIndex = this.getNextIndex();
    if (nextIndex === -1) {
      await this.pause();
      this.state.currentIndex = -1;
      this.notifyListeners();
      return;
    }

    await this.playTrackAt(nextIndex);
  }

  private getNextIndex(): number {
    const { queue, currentIndex, shuffle, repeatMode } = this.state;
    if (queue.length === 0) return -1;

    if (shuffle) {
      let next = Math.floor(Math.random() * queue.length);
      while (next === currentIndex && queue.length > 1) {
        next = Math.floor(Math.random() * queue.length);
      }
      return next;
    }

    let next = currentIndex + 1;
    if (next >= queue.length) {
      if (repeatMode === 'all') {
        return 0;
      }
      return -1;
    }
    return next;
  }

  private async playTrackAt(index: number) {
    if (index < 0 || index >= this.state.queue.length) return;
    const track = this.state.queue[index];
    await this.playTrack(track, this.state.queue, index);
  }

  private startProgressTracking() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
    }
    this.progressInterval = setInterval(() => {
      if (this.state.isPlaying) {
        this.state.currentTime += 1;
        this.notifyListeners();
      }
    }, 1000);
  }

  private setupBackgroundMode() {
    // Ensure audio continues in background
    Audio.setAudioModeAsync({
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
    }).catch(console.warn);
  }

  async togglePlayPause() {
    if (!this.player) return;

    try {
      if (this.state.isPlaying) {
        await this.player.pauseAsync();
        this.state.isPlaying = false;
      } else {
        await this.player.playAsync();
        this.state.isPlaying = true;
      }
      this.notifyListeners();
    } catch (error) {
      console.error('[MusicPlayer] Toggle play error:', error);
    }
  }

  async play() {
    if (!this.player) return;
    try {
      await this.player.playAsync();
      this.state.isPlaying = true;
      this.notifyListeners();
    } catch (error) {
      console.error('[MusicPlayer] Play error:', error);
    }
  }

  async pause() {
    if (!this.player) return;
    try {
      await this.player.pauseAsync();
      this.state.isPlaying = false;
      this.notifyListeners();
    } catch (error) {
      console.error('[MusicPlayer] Pause error:', error);
    }
  }

  async seekTo(position: number) {
    if (!this.player) return;
    try {
      await this.player.setPositionAsync(position * 1000);
      this.state.currentTime = position;
      this.notifyListeners();
    } catch (error) {
      console.error('[MusicPlayer] Seek error:', error);
    }
  }

  async setSpeed(speed: PlaybackSpeed) {
    if (!this.player) return;
    try {
      await this.player.setRateAsync(speed, true);
      this.state.speed = speed;
      this.notifyListeners();
    } catch (error) {
      console.error('[MusicPlayer] Speed error:', error);
    }
  }

  async setVolume(volume: number) {
    if (!this.player) return;
    try {
      await this.player.setVolumeAsync(volume);
      this.state.volume = volume;
      this.notifyListeners();
    } catch (error) {
      console.error('[MusicPlayer] Volume error:', error);
    }
  }

  async skipNext() {
    const nextIndex = this.getNextIndex();
    if (nextIndex === -1) return;
    await this.playTrackAt(nextIndex);
  }

  async skipPrevious() {
    if (this.state.currentTime > 3) {
      await this.seekTo(0);
      return;
    }

    const prevIndex = this.state.currentIndex - 1;
    if (prevIndex >= 0) {
      await this.playTrackAt(prevIndex);
    } else if (this.state.repeatMode === 'all') {
      await this.playTrackAt(this.state.queue.length - 1);
    }
  }

  async addToQueue(track: Track) {
    const { queue, currentIndex } = this.state;
    const newQueue = [...queue];
    newQueue.splice(currentIndex + 1, 0, track);
    this.state.queue = newQueue;
    this.notifyListeners();
  }

  async removeFromQueue(index: number) {
    const { queue, currentIndex } = this.state;
    if (index === currentIndex) return;
    const newQueue = queue.filter((_, i) => i !== index);
    this.state.queue = newQueue;
    if (currentIndex > index) {
      this.state.currentIndex = currentIndex - 1;
    }
    this.notifyListeners();
  }

  async clearQueue() {
    const current = this.state.currentTrack;
    this.state.queue = current ? [current] : [];
    this.state.currentIndex = 0;
    this.notifyListeners();
  }

  setShuffle(shuffle: boolean) {
    this.state.shuffle = shuffle;
    this.notifyListeners();
  }

  setRepeatMode(mode: RepeatMode) {
    this.state.repeatMode = mode;
    this.notifyListeners();
  }

  private async cleanup() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
    if (this.player) {
      await this.player.unloadAsync();
      this.player = null;
    }
  }

  async destroy() {
    await this.cleanup();
    this.listeners.clear();
    this.isInitialized = false;
  }

  addListener(listener: (state: PlayerState) => void) {
    this.listeners.add(listener);
    listener({ ...this.state });
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    const state = { ...this.state };
    this.listeners.forEach(listener => listener(state));
    this.syncNotification();
  }

  getState(): PlayerState {
    return { ...this.state };
  }
}

// ── Memoized Components ──────────────────────────────────────────────────────

// Track Item Component
const TrackItem = memo(({ 
  track, 
  isCurrent, 
  isPlaying, 
  isFavorite,
  onPress, 
  onFavorite,
  onQueue,
  style,
}: {
  track: Track;
  isCurrent: boolean;
  isPlaying: boolean;
  isFavorite: boolean;
  onPress: () => void;
  onFavorite: () => void;
  onQueue: () => void;
  style?: any;
}) => {
  const { colors } = useTheme();
  
  return (
    <TouchableOpacity
      style={[styles.trackItem, { backgroundColor: colors.card }, style]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.trackArtWrapper}>
        {track.artwork ? (
          <Image source={{ uri: track.artwork }} style={styles.trackArt} />
        ) : (
          <LinearGradient
            colors={[PINK + '44', PURPLE + '44']}
            style={styles.trackArt}
          >
            {isCurrent && isPlaying ? (
              <WaveformBars isPlaying={isPlaying} color={PINK} />
            ) : (
              <Icon name={isCurrent ? 'pause' : 'musical-note'} size={20} color={isCurrent ? PINK : '#666'} />
            )}
          </LinearGradient>
        )}
        {isCurrent && isPlaying && (
          <View style={styles.playingIndicator}>
            <WaveformBars isPlaying={isPlaying} color="#FFF" />
          </View>
        )}
      </View>

      <View style={styles.trackInfo}>
        <Text style={[styles.trackTitle, { color: colors.text }]} numberOfLines={1}>
          {track.title}
        </Text>
        <Text style={[styles.trackArtist, { color: colors.textSecondary }]} numberOfLines={1}>
          {track.artist}
        </Text>
        {track.album && (
          <Text style={[styles.trackAlbum, { color: colors.textTertiary }]} numberOfLines={1}>
            {track.album}
          </Text>
        )}
      </View>

      <View style={styles.trackActions}>
        <TouchableOpacity onPress={onFavorite} style={styles.trackActionBtn}>
          <Icon 
            name={isFavorite ? 'heart' : 'heart-outline'} 
            size={18} 
            color={isFavorite ? DANGER : colors.textTertiary} 
          />
        </TouchableOpacity>
        <TouchableOpacity onPress={onQueue} style={styles.trackActionBtn}>
          <Icon name="add-circle-outline" size={18} color={colors.textTertiary} />
        </TouchableOpacity>
        <Text style={[styles.trackDuration, { color: colors.textTertiary }]}>
          {formatTime(track.duration)}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

TrackItem.displayName = 'TrackItem';

// Waveform Animation Component
const WaveformBars = memo(({ isPlaying, color = PINK }: { isPlaying: boolean; color?: string }) => {
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
        <Animated.View 
          key={i} 
          style={{ 
            width: 3, 
            height: 20, 
            borderRadius: 2, 
            backgroundColor: color, 
            transform: [{ scaleY: b }] 
          }} 
        />
      ))}
    </View>
  );
});

WaveformBars.displayName = 'WaveformBars';

// ── Theme Hook ──────────────────────────────────────────────────────────────
function useTheme() {
  const [isDark, setIsDark] = useState(true);
  const colors = isDark ? COLORS.dark : COLORS.light;
  return { colors, isDark, toggleTheme: () => setIsDark(!isDark) };
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatTime(secs: number): string {
  const s = Math.max(0, Math.floor(secs));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function getInitials(title: string): string {
  return title
    .split(' ')
    .slice(0, 2)
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ── Progress Bar Component ──────────────────────────────────────────────────
const ProgressBar = memo(({ 
  progress, 
  onSeek, 
  color = PINK 
}: { 
  progress: number; 
  onSeek: (value: number) => void; 
  color?: string;
}) => {
  const [barWidth, setBarWidth] = useState(1);
  const clamped = Math.max(0, Math.min(1, progress || 0));

  return (
    <View 
      style={styles.progressTrack}
      onLayout={e => setBarWidth(e.nativeEvent.layout.width || 1)}
      onTouchEnd={e => {
        const x = e.nativeEvent.locationX;
        const value = Math.max(0, Math.min(1, x / (barWidth || 1)));
        onSeek(value);
      }}
    >
      <View style={[styles.progressFill, { width: `${clamped * 100}%`, backgroundColor: color }]} />
      <View style={[styles.progressThumb, { left: `${clamped * 100}%`, backgroundColor: color }]} />
    </View>
  );
});

ProgressBar.displayName = 'ProgressBar';

// ── Now Playing Sheet ──────────────────────────────────────────────────────
const NowPlayingSheet = memo(({ 
  visible, 
  onClose,
  player,
  favorites,
  onToggleFavorite,
  onDeleteTrack,
}: {
  visible: boolean;
  onClose: () => void;
  player: MusicPlayerEngine;
  favorites: Set<string>;
  onToggleFavorite: (id: string) => void;
  onDeleteTrack: (id: string) => void;
}) => {
  const state = player.getState();
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<'player' | 'queue' | 'lyrics'>('player');
  const [eqPreset, setEqPreset] = useState('Flat');
  const [sleepMinutes, setSleepMinutes] = useState<number | null>(null);
  const sleepTimerRef = useRef<NodeJS.Timeout | null>(null);

  const track = state.currentTrack;
  if (!track) return null;

  const progress = state.duration > 0 ? state.currentTime / state.duration : 0;
  const isFavorite = favorites.has(track.id);

  const handleSleepTimer = (minutes: number) => {
    if (sleepTimerRef.current) {
      clearTimeout(sleepTimerRef.current);
      sleepTimerRef.current = null;
    }
    
    if (minutes === -1) {
      // End of current track
      setSleepMinutes(-1);
      return;
    }

    setSleepMinutes(minutes);
    sleepTimerRef.current = setTimeout(async () => {
      await player.pause();
      setSleepMinutes(null);
    }, minutes * 60000);
  };

  const cancelSleepTimer = () => {
    if (sleepTimerRef.current) {
      clearTimeout(sleepTimerRef.current);
      sleepTimerRef.current = null;
    }
    setSleepMinutes(null);
  };

  const handleSpeedChange = () => {
    const speeds: PlaybackSpeed[] = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
    const currentIndex = speeds.indexOf(state.speed);
    const nextIndex = (currentIndex + 1) % speeds.length;
    player.setSpeed(speeds[nextIndex]);
  };

  const SLEEP_OPTIONS = [
    { label: '15 min', minutes: 15 },
    { label: '30 min', minutes: 30 },
    { label: '1 hour', minutes: 60 },
    { label: 'End of song', minutes: -1 },
  ];

  const EQ_PRESETS = [
    { label: 'Flat', icon: 'remove-outline' },
    { label: 'Bass Boost', icon: 'pulse-outline' },
    { label: 'Vocal', icon: 'mic-outline' },
    { label: 'Electronic', icon: 'radio-outline' },
    { label: 'Classical', icon: 'musical-notes-outline' },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.nowPlayingOverlay}>
        <LinearGradient 
          colors={['#0A0A0F', '#181820', '#0A0A0F']}
          style={styles.nowPlayingSheet}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        >
          <View style={styles.sheetHandle} />
          
          <TouchableOpacity style={styles.nowPlayingClose} onPress={onClose}>
            <Icon name="chevron-down" size={24} color="#FFF" />
          </TouchableOpacity>

          {/* Tab Navigation */}
          <View style={styles.nowPlayingTabs}>
            {['player', 'queue', 'lyrics'].map((tab) => (
              <TouchableOpacity
                key={tab}
                onPress={() => setActiveTab(tab as any)}
                style={[
                  styles.nowPlayingTab,
                  activeTab === tab && styles.nowPlayingTabActive,
                ]}
              >
                <Icon
                  name={tab === 'player' ? 'musical-notes' : tab === 'queue' ? 'list' : 'text-outline'}
                  size={18}
                  color={activeTab === tab ? PINK : '#666'}
                />
                <Text style={[
                  styles.nowPlayingTabText,
                  activeTab === tab && { color: PINK }
                ]}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {activeTab === 'player' && (
            <>
              {/* Artwork */}
              <View style={styles.artworkContainer}>
                {track.artwork ? (
                  <Image source={{ uri: track.artwork }} style={styles.artworkImage} />
                ) : (
                  <LinearGradient
                    colors={[PINK, PURPLE]}
                    style={styles.artworkPlaceholder}
                  >
                    <Text style={styles.artworkInitials}>
                      {getInitials(track.title)}
                    </Text>
                  </LinearGradient>
                )}
                {state.isPlaying && (
                  <View style={styles.artworkOverlay}>
                    <WaveformBars isPlaying={state.isPlaying} color="#FFF" />
                  </View>
                )}
              </View>

              {/* Track Info */}
              <View style={styles.nowPlayingInfo}>
                <View style={styles.nowPlayingTitleRow}>
                  <Text style={styles.nowPlayingTitle} numberOfLines={1}>
                    {track.title}
                  </Text>
                  <TouchableOpacity onPress={() => onToggleFavorite(track.id)}>
                    <Icon
                      name={isFavorite ? 'heart' : 'heart-outline'}
                      size={24}
                      color={isFavorite ? DANGER : '#888'}
                    />
                  </TouchableOpacity>
                </View>
                <Text style={styles.nowPlayingArtist} numberOfLines={1}>
                  {track.artist}
                </Text>
                {track.album && (
                  <Text style={styles.nowPlayingAlbum} numberOfLines={1}>
                    {track.album}
                  </Text>
                )}
              </View>

              {/* Progress */}
              <View style={styles.nowPlayingProgress}>
                <ProgressBar progress={progress} onSeek={player.seekTo} color={PINK} />
                <View style={styles.timeRow}>
                  <Text style={styles.timeText}>{formatTime(state.currentTime)}</Text>
                  <Text style={styles.timeText}>{formatTime(state.duration)}</Text>
                </View>
              </View>

              {/* Controls */}
              <View style={styles.controlsRow}>
                <TouchableOpacity onPress={() => player.setShuffle(!state.shuffle)}>
                  <Icon
                    name="shuffle"
                    size={22}
                    color={state.shuffle ? PINK : '#666'}
                  />
                </TouchableOpacity>

                <TouchableOpacity onPress={() => player.skipPrevious()} style={styles.controlBtn}>
                  <Icon name="play-skip-back" size={30} color="#FFF" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.playBtn, { backgroundColor: PINK }]}
                  onPress={() => player.togglePlayPause()}
                >
                  <Icon name={state.isPlaying ? 'pause' : 'play'} size={32} color="#FFF" />
                </TouchableOpacity>

                <TouchableOpacity onPress={() => player.skipNext()} style={styles.controlBtn}>
                  <Icon name="play-skip-forward" size={30} color="#FFF" />
                </TouchableOpacity>

                <TouchableOpacity onPress={() => player.setRepeatMode(
                  state.repeatMode === 'off' ? 'all' : 
                  state.repeatMode === 'all' ? 'one' : 'off'
                )}>
                  <Icon
                    name={state.repeatMode === 'one' ? 'repeat' : 'repeat-outline'}
                    size={22}
                    color={state.repeatMode !== 'off' ? PINK : '#666'}
                  />
                </TouchableOpacity>
              </View>

              {/* Additional Controls */}
              <View style={styles.additionalControls}>
                <TouchableOpacity onPress={handleSpeedChange} style={styles.extraControl}>
                  <Text style={styles.extraControlText}>{state.speed}x</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => player.setVolume(Math.max(0, state.volume - 0.1))} style={styles.extraControl}>
                  <Icon name="volume-low" size={20} color="#888" />
                </TouchableOpacity>

                <View style={styles.volumeSlider}>
                  <View style={[styles.volumeFill, { width: `${state.volume * 100}%`, backgroundColor: PINK }]} />
                </View>

                <TouchableOpacity onPress={() => player.setVolume(Math.min(1, state.volume + 0.1))} style={styles.extraControl}>
                  <Icon name="volume-high" size={20} color="#888" />
                </TouchableOpacity>
              </View>

              {/* Sleep Timer */}
              <View style={styles.sleepTimerSection}>
                <Text style={styles.sleepTimerLabel}>Sleep Timer</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {SLEEP_OPTIONS.map(option => (
                    <TouchableOpacity
                      key={option.label}
                      onPress={() => handleSleepTimer(option.minutes)}
                      style={[
                        styles.sleepTimerOption,
                        sleepMinutes === option.minutes && styles.sleepTimerOptionActive,
                      ]}
                    >
                      <Icon name="moon-outline" size={14} color={sleepMinutes === option.minutes ? '#FFF' : '#888'} />
                      <Text style={[
                        styles.sleepTimerOptionText,
                        sleepMinutes === option.minutes && { color: '#FFF' }
                      ]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {sleepMinutes !== null && (
                    <TouchableOpacity onPress={cancelSleepTimer} style={styles.sleepTimerCancel}>
                      <Icon name="close-circle" size={20} color={DANGER} />
                    </TouchableOpacity>
                  )}
                </ScrollView>
              </View>

              {/* EQ Presets */}
              <View style={styles.eqSection}>
                <Text style={styles.eqLabel}>Equalizer</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {EQ_PRESETS.map(preset => (
                    <TouchableOpacity
                      key={preset.label}
                      onPress={() => setEqPreset(preset.label)}
                      style={[
                        styles.eqOption,
                        eqPreset === preset.label && styles.eqOptionActive,
                      ]}
                    >
                      <Icon name={preset.icon as any} size={14} color={eqPreset === preset.label ? '#FFF' : '#888'} />
                      <Text style={[
                        styles.eqOptionText,
                        eqPreset === preset.label && { color: '#FFF' }
                      ]}>
                        {preset.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </>
          )}

          {activeTab === 'queue' && (
            <FlatList
              data={state.queue}
              keyExtractor={(item) => item.id}
              style={styles.queueList}
              renderItem={({ item, index }) => {
                const isCurrent = index === state.currentIndex;
                return (
                  <View style={[
                    styles.queueItem,
                    isCurrent && styles.queueItemCurrent,
                  ]}>
                    {isCurrent ? (
                      <WaveformBars isPlaying={state.isPlaying} color={PINK} />
                    ) : (
                      <Icon name="musical-note" size={16} color="#666" />
                    )}
                    <View style={styles.queueItemInfo}>
                      <Text style={[
                        styles.queueItemTitle,
                        isCurrent && { color: PINK }
                      ]} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={styles.queueItemArtist} numberOfLines={1}>
                        {item.artist}
                      </Text>
                    </View>
                    <Text style={styles.queueItemDuration}>
                      {formatTime(item.duration)}
                    </Text>
                    {index !== state.currentIndex && (
                      <TouchableOpacity onPress={() => player.removeFromQueue(index)}>
                        <Icon name="close" size={16} color="#666" />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              }}
            />
          )}

          {activeTab === 'lyrics' && (
            <View style={styles.lyricsContainer}>
              <MCIcon name="text-box-outline" size={56} color="#444" />
              <Text style={styles.lyricsTitle}>Lyrics</Text>
              <Text style={styles.lyricsSubtext}>
                {track.title} by {track.artist}
              </Text>
              <Text style={styles.lyricsPlaceholder}>
                Lyrics for this track are not available{'\n'}
                Check back later for updates
              </Text>
            </View>
          )}
        </LinearGradient>
      </View>
    </Modal>
  );
});

NowPlayingSheet.displayName = 'NowPlayingSheet';

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN SCREEN
// ─────────────────────────────────────────────────────────────────────────────
export default function MoodMusicScreen() {
  const { colors, isDark } = useTheme();
  const playerRef = useRef<MusicPlayerEngine>(MusicPlayerEngine.getInstance());
  const [playerState, setPlayerState] = useState(playerRef.current.getState());
  
  const [library, setLibrary] = useState<Track[]>([]);
  const [filteredLibrary, setFilteredLibrary] = useState<Track[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [recentlyPlayed, setRecentlyPlayed] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState({ done: 0, total: 0 });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'library' | 'favorites' | 'playlists' | 'recent'>('library');
  const [showNowPlaying, setShowNowPlaying] = useState(false);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  
  const [refreshing, setRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState<'title' | 'artist' | 'duration' | 'recent'>('title');
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  // ── Effects ──────────────────────────────────────────────────────────────
  useEffect(() => {
    initializeApp();
    // Deliberately NOT calling playerRef.current.destroy() here.
    // MusicPlayerEngine is a singleton — destroying it on unmount would
    // stop playback and tear down the notification the instant the user
    // navigates away from this screen, which defeats the entire point of
    // a background-capable MediaSession/notification. Playback should
    // keep running (with working notification controls) until the user
    // explicitly stops it or the queue naturally ends.
  }, []);

  useEffect(() => {
    const unsubscribe = playerRef.current.addListener((state) => {
      setPlayerState(state);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    filterLibrary();
  }, [library, searchQuery, sortBy]);

  // ── Initialization ──────────────────────────────────────────────────────
  const initializeApp = async () => {
    try {
      setIsLoading(true);
      setLoadError(null);

      // Load saved data. loadLibrary() returns the tracks it found so we can
      // decide whether to scan without reading `library` state right after —
      // React state updates are async, so the old code always saw `library`
      // as the initial empty array here and re-scanned on every launch.
      // A hard timeout guarantees we never leave the user staring at a
      // spinner forever if a native call (permissions, media scan) hangs.
      const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> =>
        Promise.race([
          promise,
          new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Loading timed out')), ms)),
        ]);

      const [savedLibrary] = await withTimeout(
        Promise.all([
          loadLibrary(),
          loadFavorites(),
          loadRecentlyPlayed(),
          loadPlaylists(),
        ]),
        15000
      );

      if (savedLibrary && savedLibrary.length > 0) {
        // We already have a library — show it immediately, then quietly
        // refresh from the device in the background instead of blocking
        // the UI behind another full scan.
        scanDeviceMusic({ silent: true }).catch(() => {});
      } else {
        // Nothing saved yet: check the scanner's short-lived cache before
        // doing a full device scan (which is the slow path).
        const cached = await AudioScanner.getInstance().getCachedTracks();
        if (cached && cached.length > 0) {
          await saveLibrary(cached);
        } else {
          await withTimeout(scanDeviceMusic(), 60000);
        }
      }
    } catch (error: any) {
      console.error('[MoodMusic] Init error:', error);
      setLoadError(error?.message || 'Something went wrong while loading your music.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Library Management ──────────────────────────────────────────────────
  const loadLibrary = async (): Promise<Track[]> => {
    try {
      const data = await AsyncStorage.getItem(STORAGE.LIBRARY);
      if (data) {
        const parsed = JSON.parse(data);
        setLibrary(parsed);
        return parsed;
      }
      return [];
    } catch (error) {
      console.error('[MoodMusic] Load library error:', error);
      return [];
    }
  };

  const saveLibrary = async (tracks: Track[]) => {
    try {
      await AsyncStorage.setItem(STORAGE.LIBRARY, JSON.stringify(tracks));
      setLibrary(tracks);
    } catch (error) {
      console.error('[MoodMusic] Save library error:', error);
    }
  };

  const loadFavorites = async () => {
    try {
      const data = await AsyncStorage.getItem(STORAGE.FAVORITES);
      if (data) {
        setFavorites(new Set(JSON.parse(data)));
      }
    } catch (error) {
      console.error('[MoodMusic] Load favorites error:', error);
    }
  };

  const saveFavorites = async (favoritesSet: Set<string>) => {
    try {
      await AsyncStorage.setItem(STORAGE.FAVORITES, JSON.stringify([...favoritesSet]));
      setFavorites(favoritesSet);
    } catch (error) {
      console.error('[MoodMusic] Save favorites error:', error);
    }
  };

  const loadRecentlyPlayed = async () => {
    try {
      const data = await AsyncStorage.getItem(STORAGE.RECENT);
      if (data) {
        setRecentlyPlayed(JSON.parse(data));
      }
    } catch (error) {
      console.error('[MoodMusic] Load recent error:', error);
    }
  };

  const saveRecentlyPlayed = async (tracks: Track[]) => {
    try {
      await AsyncStorage.setItem(STORAGE.RECENT, JSON.stringify(tracks));
      setRecentlyPlayed(tracks);
    } catch (error) {
      console.error('[MoodMusic] Save recent error:', error);
    }
  };

  const loadPlaylists = async () => {
    try {
      const data = await AsyncStorage.getItem(STORAGE.PLAYLISTS);
      if (data) {
        setPlaylists(JSON.parse(data));
      }
    } catch (error) {
      console.error('[MoodMusic] Load playlists error:', error);
    }
  };

  const savePlaylists = async (playlistsData: Playlist[]) => {
    try {
      await AsyncStorage.setItem(STORAGE.PLAYLISTS, JSON.stringify(playlistsData));
      setPlaylists(playlistsData);
    } catch (error) {
      console.error('[MoodMusic] Save playlists error:', error);
    }
  };

  // ── Scanning ────────────────────────────────────────────────────────────
  const scanDeviceMusic = async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    const scanner = AudioScanner.getInstance();

    if (isScanning) return; // a scan is already running, don't stack another

    try {
      setIsScanning(true);
      setScanProgress({ done: 0, total: 0 });
      scanner.notifyProgress = (done, total) => setScanProgress({ done, total });

      const tracks = await scanner.scanDeviceMusic();

      if (tracks.length > 0) {
        await saveLibrary(tracks);
        if (!silent) {
          Alert.alert('✅ Music Scanned', `Found ${tracks.length} songs on your device`, [{ text: 'OK' }]);
        }
      } else if (!silent) {
        Alert.alert(
          'No Music Found',
          'Could not find any audio files on your device.\n\nTry importing manually.',
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      if (!silent) {
        const message = error?.message === 'Media library permission required'
          ? 'Music access permission is required to scan your device.\nYou can also import songs manually.'
          : 'Failed to scan device music.\nPlease check permissions and try again.';
        Alert.alert('Scan Error', message, [{ text: 'OK' }]);
      }
      console.error('[MoodMusic] Scan error:', error);
    } finally {
      scanner.notifyProgress = null;
      setIsScanning(false);
    }
  };

  // ── Track Operations ────────────────────────────────────────────────────
  const filterLibrary = () => {
    let filtered = [...library];
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(track =>
        track.title.toLowerCase().includes(query) ||
        track.artist.toLowerCase().includes(query) ||
        (track.album && track.album.toLowerCase().includes(query))
      );
    }

    // Sort
    switch (sortBy) {
      case 'title':
        filtered.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'artist':
        filtered.sort((a, b) => a.artist.localeCompare(b.artist));
        break;
      case 'duration':
        filtered.sort((a, b) => a.duration - b.duration);
        break;
      case 'recent':
        filtered.sort((a, b) => {
          const aTime = a.lastPlayed ? new Date(a.lastPlayed).getTime() : 0;
          const bTime = b.lastPlayed ? new Date(b.lastPlayed).getTime() : 0;
          return bTime - aTime;
        });
        break;
    }

    setFilteredLibrary(filtered);
  };

  const playTrack = async (track: Track, queue?: Track[]) => {
    try {
      const trackList = queue || library;
      const index = trackList.findIndex(t => t.id === track.id);
      
      await playerRef.current.playTrack(track, trackList, index);
      
      // Update recent
      const updatedRecent = [
        track,
        ...recentlyPlayed.filter(t => t.id !== track.id),
      ].slice(0, 50);
      await saveRecentlyPlayed(updatedRecent);

      // Update play count
      const updatedLibrary = library.map(t => {
        if (t.id === track.id) {
          return {
            ...t,
            playCount: (t.playCount || 0) + 1,
            lastPlayed: new Date().toISOString(),
          };
        }
        return t;
      });
      await saveLibrary(updatedLibrary);

      setShowNowPlaying(true);
    } catch (error) {
      Alert.alert('Play Error', 'Could not play this track');
      console.error('[MoodMusic] Play error:', error);
    }
  };

  const toggleFavorite = async (trackId: string) => {
    const newFavorites = new Set(favorites);
    if (newFavorites.has(trackId)) {
      newFavorites.delete(trackId);
    } else {
      newFavorites.add(trackId);
    }
    await saveFavorites(newFavorites);
  };

  const addToQueue = async (track: Track) => {
    await playerRef.current.addToQueue(track);
    Alert.alert('Added to Queue', `${track.title} added to queue`);
  };

  // ── Playlist Operations ────────────────────────────────────────────────
  const createPlaylist = async () => {
    if (!newPlaylistName.trim()) {
      Alert.alert('Error', 'Please enter a playlist name');
      return;
    }

    const playlist: Playlist = {
      id: `playlist_${Date.now()}`,
      name: newPlaylistName.trim(),
      tracks: [],
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    };

    await savePlaylists([...playlists, playlist]);
    setNewPlaylistName('');
    setShowPlaylistModal(false);
    Alert.alert('✅ Playlist Created', `"${playlist.name}" has been created`);
  };

  const addToPlaylist = async (playlistId: string, trackId: string) => {
    const playlist = playlists.find(p => p.id === playlistId);
    if (!playlist) return;

    if (playlist.tracks.includes(trackId)) {
      Alert.alert('Already Added', 'This track is already in the playlist');
      return;
    }

    const updated = {
      ...playlist,
      tracks: [...playlist.tracks, trackId],
      updated: new Date().toISOString(),
    };

    await savePlaylists(playlists.map(p => p.id === playlistId ? updated : p));
    Alert.alert('✅ Added', `Track added to "${playlist.name}"`);
  };

  const deletePlaylist = async (playlistId: string) => {
    Alert.alert(
      'Delete Playlist',
      'Are you sure you want to delete this playlist?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await savePlaylists(playlists.filter(p => p.id !== playlistId));
          }
        }
      ]
    );
  };

  const removeFromPlaylist = async (playlistId: string, trackId: string) => {
    const playlist = playlists.find(p => p.id === playlistId);
    if (!playlist) return;

    const updated = {
      ...playlist,
      tracks: playlist.tracks.filter(id => id !== trackId),
      updated: new Date().toISOString(),
    };

    await savePlaylists(playlists.map(p => p.id === playlistId ? updated : p));
  };

  // ── Import ──────────────────────────────────────────────────────────────
  const importTrack = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const newTrack: Track = {
        id: `imported_${Date.now()}`,
        title: asset.name.replace(/\.[^/.]+$/, ''),
        artist: 'Imported',
        duration: 0,
        uri: asset.uri,
        addedAt: new Date().toISOString(),
        source: 'imported',
        playCount: 0,
      };

      const updatedLibrary = [newTrack, ...library];
      await saveLibrary(updatedLibrary);
      Alert.alert('✅ Imported', `"${newTrack.title}" added to library`);
    } catch (error) {
      Alert.alert('Import Error', 'Failed to import file');
      console.error('[MoodMusic] Import error:', error);
    }
  };

  // ── Pull to refresh ──────────────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await scanDeviceMusic({ silent: true });
    } finally {
      setRefreshing(false);
    }
  }, []);

  // ── Render Helpers ──────────────────────────────────────────────────────
  const renderTrackGrid = (tracks: Track[]) => {
    return (
      <FlatList
        data={tracks}
        key="grid"
        numColumns={2}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.gridContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={PINK} colors={[PINK]} />
        }
        renderItem={({ item }) => {
          const isCurrent = playerState.currentTrack?.id === item.id;
          const isFavorite = favorites.has(item.id);
          return (
            <TouchableOpacity
              style={[styles.gridItem, { backgroundColor: colors.card }]}
              onPress={() => playTrack(item)}
              activeOpacity={0.7}
            >
              <View style={styles.gridArtworkWrapper}>
                {item.artwork ? (
                  <Image source={{ uri: item.artwork }} style={styles.gridArtwork} />
                ) : (
                  <LinearGradient
                    colors={[PINK + '44', PURPLE + '44']}
                    style={styles.gridArtwork}
                  >
                    <Text style={styles.gridInitials}>
                      {getInitials(item.title)}
                    </Text>
                  </LinearGradient>
                )}
                {isCurrent && playerState.isPlaying && (
                  <View style={styles.gridPlayingOverlay}>
                    <WaveformBars isPlaying={true} color="#FFF" />
                  </View>
                )}
              </View>
              <Text style={[styles.gridTitle, { color: colors.text }]} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={[styles.gridArtist, { color: colors.textSecondary }]} numberOfLines={1}>
                {item.artist}
              </Text>
              <TouchableOpacity
                style={styles.gridFavorite}
                onPress={() => toggleFavorite(item.id)}
              >
                <Icon
                  name={isFavorite ? 'heart' : 'heart-outline'}
                  size={16}
                  color={isFavorite ? DANGER : colors.textTertiary}
                />
              </TouchableOpacity>
            </TouchableOpacity>
          );
        }}
      />
    );
  };

  const renderTrackList = (tracks: Track[]) => {
    return (
      <FlatList
        data={tracks}
        key="list"
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={PINK} colors={[PINK]} />
        }
        renderItem={({ item }) => {
          const isCurrent = playerState.currentTrack?.id === item.id;
          const isFavorite = favorites.has(item.id);
          return (
            <TrackItem
              track={item}
              isCurrent={isCurrent}
              isPlaying={playerState.isPlaying}
              isFavorite={isFavorite}
              onPress={() => playTrack(item)}
              onFavorite={() => toggleFavorite(item.id)}
              onQueue={() => addToQueue(item)}
            />
          );
        }}
      />
    );
  };

  // ── Loading State ──────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={PINK} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          {scanProgress.total > 0
            ? `Scanning your music… ${scanProgress.done}/${scanProgress.total}`
            : 'Loading your music...'}
        </Text>
      </View>
    );
  }

  if (loadError && library.length === 0) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.bg }]}>
        <Icon name="alert-circle-outline" size={40} color={colors.textTertiary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>{loadError}</Text>
        <TouchableOpacity
          onPress={() => { setLoadError(null); initializeApp(); }}
          style={{ marginTop: 16, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: PINK }}
        >
          <Text style={{ color: '#FFF', fontWeight: '600' }}>Try Again</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={importTrack} style={{ marginTop: 12 }}>
          <Text style={{ color: colors.textSecondary, textDecorationLine: 'underline' }}>
            Import a song manually instead
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Main Render ────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <LinearGradient colors={[PINK, PURPLE]} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerBack}>
          <Icon name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>My Music</Text>
          <Text style={styles.headerSubtitle}>
            {library.length} songs • {formatTotalDuration(library)}
          </Text>
        </View>
        <TouchableOpacity onPress={scanDeviceMusic} style={styles.headerAction}>
          <Icon name="scan-outline" size={22} color="#FFF" />
        </TouchableOpacity>
        <TouchableOpacity onPress={importTrack} style={styles.headerAction}>
          <Icon name="add-outline" size={24} color="#FFF" />
        </TouchableOpacity>
      </LinearGradient>

      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: colors.card }]}>
        <Icon name="search" size={20} color={colors.textTertiary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search songs, artists, albums..."
          placeholderTextColor={colors.textTertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Icon name="close-circle" size={20} color={colors.textTertiary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Tab Navigation */}
      <View style={[styles.tabContainer, { borderBottomColor: colors.border }]}>
        {['library', 'favorites', 'playlists', 'recent'].map((tab) => {
          const counts = {
            library: library.length,
            favorites: favorites.size,
            playlists: playlists.length,
            recent: recentlyPlayed.length,
          };
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab as any)}
            >
              <Text style={[
                styles.tabText,
                activeTab === tab && { color: PINK }
              ]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
              <View style={[
                styles.tabBadge,
                activeTab === tab && styles.tabBadgeActive,
              ]}>
                <Text style={styles.tabBadgeText}>
                  {counts[tab as keyof typeof counts]}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Sort & View Controls */}
      <View style={[styles.filterControlsRow, { backgroundColor: colors.card }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {['title', 'artist', 'duration', 'recent'].map((sort) => (
            <TouchableOpacity
              key={sort}
              onPress={() => setSortBy(sort as any)}
              style={[
                styles.sortChip,
                sortBy === sort && { backgroundColor: PINK },
              ]}
            >
              <Text style={[
                styles.sortChipText,
                sortBy === sort && { color: '#FFF' }
              ]}>
                {sort.charAt(0).toUpperCase() + sort.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity
          onPress={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
          style={styles.viewToggle}
        >
          <Icon
            name={viewMode === 'list' ? 'grid-outline' : 'list-outline'}
            size={22}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {activeTab === 'library' && (
          filteredLibrary.length === 0 ? (
            <EmptyState
              icon="musical-notes-outline"
              title={searchQuery ? 'No results found' : 'Your library is empty'}
              subtitle={searchQuery ? 'Try a different search' : 'Scan your device or import music'}
              action={searchQuery ? undefined : scanDeviceMusic}
              actionLabel={searchQuery ? undefined : 'Scan Device'}
            />
          ) : viewMode === 'grid' ? (
            renderTrackGrid(filteredLibrary)
          ) : (
            renderTrackList(filteredLibrary)
          )
        )}

        {activeTab === 'favorites' && (
          favorites.size === 0 ? (
            <EmptyState
              icon="heart-outline"
              title="No favorites yet"
              subtitle="Like songs to see them here"
            />
          ) : viewMode === 'grid' ? (
            renderTrackGrid(library.filter(t => favorites.has(t.id)))
          ) : (
            renderTrackList(library.filter(t => favorites.has(t.id)))
          )
        )}

        {activeTab === 'playlists' && (
          playlists.length === 0 ? (
            <EmptyState
              icon="albums-outline"
              title="No playlists"
              subtitle="Create your first playlist"
              action={() => setShowPlaylistModal(true)}
              actionLabel="Create Playlist"
            />
          ) : (
            <FlatList
              data={playlists}
              keyExtractor={(item) => item.id}
              numColumns={2}
              contentContainerStyle={styles.playlistGrid}
              renderItem={({ item }) => {
                const tracks = item.tracks.map(id => library.find(t => t.id === id)).filter(Boolean) as Track[];
                return (
                  <TouchableOpacity
                    style={[styles.playlistCard, { backgroundColor: colors.card }]}
                    onPress={() => setSelectedPlaylist(item)}
                  >
                    <LinearGradient
                      colors={[PINK + '44', PURPLE + '44']}
                      style={styles.playlistArt}
                    >
                      <Icon name="musical-notes" size={32} color={PINK} />
                      <Text style={styles.playlistTrackCount}>
                        {tracks.length} tracks
                      </Text>
                    </LinearGradient>
                    <Text style={[styles.playlistName, { color: colors.text }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={[styles.playlistUpdated, { color: colors.textTertiary }]}>
                      Updated {formatDate(item.updated)}
                    </Text>
                    <TouchableOpacity
                      style={styles.playlistDelete}
                      onPress={() => deletePlaylist(item.id)}
                    >
                      <Icon name="trash-outline" size={16} color={DANGER} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              }}
            />
          )
        )}

        {activeTab === 'recent' && (
          recentlyPlayed.length === 0 ? (
            <EmptyState
              icon="time-outline"
              title="No recent songs"
              subtitle="Songs you play will appear here"
            />
          ) : viewMode === 'grid' ? (
            renderTrackGrid(recentlyPlayed)
          ) : (
            renderTrackList(recentlyPlayed)
          )
        )}
      </View>

      {/* Mini Player */}
      {playerState.currentTrack && (
        <MiniPlayer
          track={playerState.currentTrack}
          isPlaying={playerState.isPlaying}
          onTogglePlay={() => playerRef.current.togglePlayPause()}
          onNext={() => playerRef.current.skipNext()}
          onPrev={() => playerRef.current.skipPrevious()}
          onExpand={() => setShowNowPlaying(true)}
          colors={colors}
        />
      )}

      {/* Now Playing Sheet */}
      <NowPlayingSheet
        visible={showNowPlaying}
        onClose={() => setShowNowPlaying(false)}
        player={playerRef.current}
        favorites={favorites}
        onToggleFavorite={toggleFavorite}
        onDeleteTrack={(id) => {
          const updated = library.filter(t => t.id !== id);
          saveLibrary(updated);
          if (playerState.currentTrack?.id === id) {
            playerRef.current.pause();
          }
        }}
      />

      {/* Create Playlist Modal */}
      <Modal visible={showPlaylistModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Create Playlist
            </Text>
            <TextInput
              style={[styles.modalInput, { 
                backgroundColor: colors.input,
                color: colors.text,
                borderColor: colors.border,
              }]}
              placeholder="Playlist name"
              placeholderTextColor={colors.textTertiary}
              value={newPlaylistName}
              onChangeText={setNewPlaylistName}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancel]}
                onPress={() => setShowPlaylistModal(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: PINK }]}
                onPress={createPlaylist}
              >
                <Text style={styles.modalButtonText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Playlist Detail Modal */}
      <Modal visible={!!selectedPlaylist} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, maxHeight: '80%' }]}>
            <View style={styles.playlistDetailHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {selectedPlaylist?.name}
              </Text>
              <TouchableOpacity onPress={() => setSelectedPlaylist(null)}>
                <Icon name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={selectedPlaylist?.tracks.map(id => library.find(t => t.id === id)).filter(Boolean) as Track[] || []}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.playlistTrackItem}>
                  <TouchableOpacity
                    style={styles.playlistTrackContent}
                    onPress={() => playTrack(item)}
                  >
                    <Text style={[styles.playlistTrackTitle, { color: colors.text }]}>
                      {item.title}
                    </Text>
                    <Text style={[styles.playlistTrackArtist, { color: colors.textSecondary }]}>
                      {item.artist}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      if (selectedPlaylist) {
                        removeFromPlaylist(selectedPlaylist.id, item.id);
                        setSelectedPlaylist({
                          ...selectedPlaylist,
                          tracks: selectedPlaylist.tracks.filter(id => id !== item.id),
                        });
                      }
                    }}
                  >
                    <Icon name="close" size={20} color={colors.textTertiary} />
                  </TouchableOpacity>
                </View>
              )}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Mini Player Component ──────────────────────────────────────────────────
const MiniPlayer = memo(({ 
  track, 
  isPlaying, 
  onTogglePlay, 
  onNext, 
  onPrev, 
  onExpand,
  colors,
}: {
  track: Track;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  onExpand: () => void;
  colors: any;
}) => {
  return (
    <TouchableOpacity
      style={[styles.miniPlayer, { backgroundColor: colors.card }]}
      onPress={onExpand}
      activeOpacity={0.9}
    >
      <View style={styles.miniPlayerContent}>
        <View style={styles.miniArtworkWrapper}>
          {track.artwork ? (
            <Image source={{ uri: track.artwork }} style={styles.miniArtwork} />
          ) : (
            <LinearGradient
              colors={[PINK + '44', PURPLE + '44']}
              style={styles.miniArtwork}
            >
              <Text style={styles.miniInitials}>
                {getInitials(track.title)}
              </Text>
            </LinearGradient>
          )}
          {isPlaying && (
            <View style={styles.miniPlayingIndicator}>
              <WaveformBars isPlaying={isPlaying} color="#FFF" />
            </View>
          )}
        </View>

        <View style={styles.miniInfo}>
          <Text style={[styles.miniTitle, { color: colors.text }]} numberOfLines={1}>
            {track.title}
          </Text>
          <Text style={[styles.miniArtist, { color: colors.textSecondary }]} numberOfLines={1}>
            {track.artist}
          </Text>
        </View>

        <View style={styles.miniControls}>
          <TouchableOpacity onPress={onPrev} style={styles.miniControlBtn}>
            <Icon name="play-skip-back" size={20} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onTogglePlay}
            style={[styles.miniPlayBtn, { backgroundColor: PINK }]}
          >
            <Icon name={isPlaying ? 'pause' : 'play'} size={20} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={onNext} style={styles.miniControlBtn}>
            <Icon name="play-skip-forward" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
});

MiniPlayer.displayName = 'MiniPlayer';

// ── Empty State Component ──────────────────────────────────────────────────
const EmptyState = memo(({ 
  icon, 
  title, 
  subtitle, 
  action, 
  actionLabel 
}: {
  icon: string;
  title: string;
  subtitle: string;
  action?: () => void;
  actionLabel?: string;
}) => {
  const { colors } = useTheme();
  return (
    <View style={styles.emptyState}>
      <Icon name={icon} size={64} color={colors.textTertiary} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
      {action && actionLabel && (
        <TouchableOpacity
          style={[styles.emptyAction, { backgroundColor: PINK }]}
          onPress={action}
        >
          <Text style={styles.emptyActionText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

EmptyState.displayName = 'EmptyState';

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatTotalDuration(tracks: Track[]): string {
  const total = tracks.reduce((sum, t) => sum + (t.duration || 0), 0);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

// ── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 },
  
  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: -10,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 12 : 12,
    gap: 8,
  },
  headerBack: {
    padding: 4,
  },
  headerCenter: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  headerAction: {
    padding: 6,
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 4,
  },

  // Tabs
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    gap: 16,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: PINK,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#888',
  },
  tabBadge: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  tabBadgeActive: {
    backgroundColor: PINK + '33',
  },
  tabBadgeText: {
    fontSize: 10,
    color: '#888',
  },

  // Controls
  filterControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  sortChip: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
  },
  sortChipText: {
    fontSize: 12,
    color: '#888',
  },
  viewToggle: {
    padding: 6,
  },

  // Content
  content: {
    flex: 1,
  },

  // List
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  trackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
    gap: 10,
  },
  trackArtWrapper: {
    position: 'relative',
  },
  trackArt: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playingIndicator: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: PINK,
    borderRadius: 10,
    padding: 2,
  },
  trackInfo: {
    flex: 1,
    gap: 1,
  },
  trackTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  trackArtist: {
    fontSize: 12,
  },
  trackAlbum: {
    fontSize: 11,
  },
  trackActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trackActionBtn: {
    padding: 4,
  },
  trackDuration: {
    fontSize: 12,
    minWidth: 40,
    textAlign: 'right',
  },

  // Grid
  gridContainer: {
    paddingHorizontal: 12,
    paddingBottom: 100,
  },
  gridItem: {
    flex: 1,
    margin: 4,
    padding: 10,
    borderRadius: 12,
    alignItems: 'center',
    maxWidth: (W - 48) / 2,
  },
  gridArtworkWrapper: {
    position: 'relative',
    width: '100%',
    aspectRatio: 1,
  },
  gridArtwork: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridInitials: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFF',
  },
  gridPlayingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },
  gridArtist: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 1,
  },
  gridFavorite: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 4,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
  },

  // Playlists
  playlistGrid: {
    paddingHorizontal: 12,
    paddingBottom: 100,
  },
  playlistCard: {
    flex: 1,
    margin: 4,
    padding: 10,
    borderRadius: 12,
    maxWidth: (W - 48) / 2,
    position: 'relative',
  },
  playlistArt: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  playlistTrackCount: {
    fontSize: 11,
    color: '#FFF',
    fontWeight: '500',
  },
  playlistName: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
  },
  playlistUpdated: {
    fontSize: 10,
    marginTop: 1,
  },
  playlistDelete: {
    position: 'absolute',
    top: 14,
    right: 14,
    padding: 4,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
  },
  playlistDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  playlistTrackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  playlistTrackContent: {
    flex: 1,
  },
  playlistTrackTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  playlistTrackArtist: {
    fontSize: 12,
  },

  // Empty State
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  emptyAction: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 8,
  },
  emptyActionText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },

  // Mini Player
  miniPlayer: {
    position: 'absolute',
    bottom: 73,
    left: 0,
    right: 0,
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 20 : 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
    // ✅ Curved top edges
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',  
    // ✅ Curved top edges
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
},
  miniPlayerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  miniArtworkWrapper: {
    position: 'relative',
  },
  miniArtwork: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniInitials: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  miniPlayingIndicator: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: PINK,
    borderRadius: 8,
    padding: 2,
  },
  miniInfo: {
    flex: 1,
    gap: 1,
  },
  miniTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  miniArtist: {
    fontSize: 11,
  },
  miniControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  miniControlBtn: {
    padding: 4,
  },
  miniPlayBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Now Playing Sheet
  nowPlayingOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  nowPlayingSheet: {
    height: Platform.OS === 'ios' ? '90%' : '95%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  nowPlayingClose: {
    alignSelf: 'flex-end',
    padding: 4,
  },
  nowPlayingTabs: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 16,
  },
  nowPlayingTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  nowPlayingTabActive: {
    backgroundColor: 'rgba(255,107,157,0.2)',
  },
  nowPlayingTabText: {
    fontSize: 12,
    color: '#888',
    fontWeight: '500',
  },
  artworkContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  artworkImage: {
    width: 240,
    height: 240,
    borderRadius: 16,
  },
  artworkPlaceholder: {
    width: 240,
    height: 240,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  artworkInitials: {
    fontSize: 64,
    fontWeight: '700',
    color: '#FFF',
  },
  artworkOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nowPlayingInfo: {
    marginBottom: 16,
    gap: 2,
  },
  nowPlayingTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nowPlayingTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  nowPlayingArtist: {
    fontSize: 15,
    color: '#AAA',
  },
  nowPlayingAlbum: {
    fontSize: 13,
    color: '#666',
  },
  nowPlayingProgress: {
    marginBottom: 16,
    gap: 4,
  },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    position: 'relative',
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
  },
  progressThumb: {
    position: 'absolute',
    top: -4,
    width: 12,
    height: 12,
    borderRadius: 6,
    transform: [{ translateX: -6 }],
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeText: {
    color: '#888',
    fontSize: 11,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 20,
  },
  controlBtn: {
    padding: 4,
  },
  playBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  additionalControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  extraControl: {
    padding: 4,
  },
  extraControlText: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
  },
  volumeSlider: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  volumeFill: {
    height: 4,
    borderRadius: 2,
  },
  sleepTimerSection: {
    marginBottom: 16,
    gap: 6,
  },
  sleepTimerLabel: {
    color: '#888',
    fontSize: 11,
    fontWeight: '500',
  },
  sleepTimerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#333',
  },
  sleepTimerOptionActive: {
    backgroundColor: PURPLE,
    borderColor: PURPLE,
  },
  sleepTimerOptionText: {
    color: '#888',
    fontSize: 11,
  },
  sleepTimerCancel: {
    padding: 4,
  },
  eqSection: {
    gap: 6,
  },
  eqLabel: {
    color: '#888',
    fontSize: 11,
    fontWeight: '500',
  },
  eqOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#333',
  },
  eqOptionActive: {
    backgroundColor: PINK,
    borderColor: PINK,
  },
  eqOptionText: {
    color: '#888',
    fontSize: 11,
  },

  // Queue
  queueList: {
    flex: 1,
    marginTop: 8,
  },
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 2,
  },
  queueItemCurrent: {
    backgroundColor: 'rgba(255,107,157,0.1)',
  },
  queueItemInfo: {
    flex: 1,
    gap: 1,
  },
  queueItemTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFF',
  },
  queueItemArtist: {
    fontSize: 12,
    color: '#888',
  },
  queueItemDuration: {
    fontSize: 12,
    color: '#666',
  },

  // Lyrics
  lyricsContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  lyricsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
  },
  lyricsSubtext: {
    fontSize: 14,
    color: '#888',
  },
  lyricsPlaceholder: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 12,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    borderRadius: 20,
    padding: 20,
    gap: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalInput: {
    fontSize: 16,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalCancel: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  modalButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },
});
