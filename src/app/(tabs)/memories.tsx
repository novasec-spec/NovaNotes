// screens/MemoriesScreen.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, Image, TouchableOpacity, StyleSheet,
  Modal, TextInput, Alert, ScrollView, Animated, Dimensions,
  ActivityIndicator, KeyboardAvoidingView, Platform, RefreshControl,
  Share, Pressable,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../config/supabase';
import { useTheme } from '../../contexts/ThemeContext';
import { PremiumGuard } from '../../components/PremiumGuard'

const { width: W } = Dimensions.get('window');

// ── Design tokens ─────────────────────────────────────────────────────────────
const PINK  = '#FF6B9D';
const BG    = '#FFF5F7';
const WHITE = '#FFFFFF';
const DARK  = '#2D1B25';
const MID   = '#9A7090';
const SOFT  = '#C4A0B8';

// ── Supabase config ──────────────────────────────────────────────────────────
const BUCKET_NAME   = 'test-bucket';
const STORAGE_KEY   = 'memories_data';
const META_KEY      = 'memories_metadata';

// ── Grid column options ───────────────────────────────────────────────────────
const COL_OPTIONS = [1, 2, 3] as const;
type ColCount = typeof COL_OPTIONS[number];

// ── Mood / category config ────────────────────────────────────────────────────
const MOODS = [
  { key: 'love',      label: 'Love',      icon: 'heart',    color: '#EF4444', bg: '#FFF0F0' },
  { key: 'adventure', label: 'Adventure', icon: 'compass',  color: '#F97316', bg: '#FFF4ED' },
  { key: 'happy',     label: 'Happy',     icon: 'sunny',    color: '#F59E0B', bg: '#FFFBEB' },
  { key: 'milestone', label: 'Milestone', icon: 'star',     color: '#A855F7', bg: '#F5F0FF' },
  { key: 'chill',     label: 'Chill',     icon: 'cafe',     color: '#22C55E', bg: '#F0FDF4' },
  { key: 'random',    label: 'Random',    icon: 'sparkles', color: '#3B82F6', bg: '#EFF6FF' },
] as const;

type MoodKey = typeof MOODS[number]['key'];
type ViewMode = 'grid' | 'timeline';

function getMood(key?: string) {
  return MOODS.find(m => m.key === key) ?? MOODS[5];
}

// ── Interfaces ────────────────────────────────────────────────────────────────
interface Comment {
  id: string;
  text: string;
  author: string;   // could be 'You' or partner name from profile
  createdAt: string;
}

interface Memory {
  id: string;
  uri: string;
  fileName: string;
  caption: string;
  date: string;
  location?: string;
  mood?: MoodKey;
  fav?: boolean;
  mediaType: 'image' | 'video';
  comments: Comment[];
  likes: number;
  liked: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}

function formatRelative(dateString: string) {
  const diff = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function isOnThisDay(dateStr: string) {
  const d = new Date(dateStr);
  const t = new Date();
  return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() < t.getFullYear();
}

function isVideo(uri: string) {
  return /\.(mp4|mov|avi|mkv|webm|m4v)$/i.test(uri);
}

// ── Animated card wrapper ─────────────────────────────────────────────────────
function FadeCard({ index, children }: { index: number; children: React.ReactNode }) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 320, delay: Math.min(index * 45, 400), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 320, delay: Math.min(index * 45, 400), useNativeDriver: true }),
    ]).start();
  }, []);

  return <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>;
}

// ── Video thumbnail with play button ─────────────────────────────────────────
function VideoThumb({ uri, style }: { uri: string; style: any }) {
  return (
    <View style={[style, { backgroundColor: '#111', overflow: 'hidden' }]}>
      <Video
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        resizeMode={ResizeMode.COVER}
        isMuted
        shouldPlay={false}
      />
      <View style={videoThumbStyles.overlay}>
        <Icon name="play-circle" size={36} color="rgba(255,255,255,0.9)" />
      </View>
    </View>
  );
}

const videoThumbStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
});

// ── Full-screen video player ──────────────────────────────────────────────────
function VideoPlayer({ uri, onClose }: { uri: string; onClose: () => void }) {
  const [status, setStatus] = useState<AVPlaybackStatus | null>(null);
  const videoRef = useRef<Video>(null);

  const isPlaying = status?.isLoaded ? status.isPlaying : false;

  const togglePlay = async () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      await videoRef.current.pauseAsync();
    } else {
      await videoRef.current.playAsync();
    }
  };

  return (
    <View style={vpStyles.container}>
      <Video
        ref={videoRef}
        source={{ uri }}
        style={vpStyles.video}
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay
        isLooping
        onPlaybackStatusUpdate={s => setStatus(s)}
      />
      <TouchableOpacity style={vpStyles.playOverlay} onPress={togglePlay} activeOpacity={0.85}>
        {!isPlaying && <Icon name="play-circle" size={64} color="rgba(255,255,255,0.9)" />}
      </TouchableOpacity>
      <TouchableOpacity style={vpStyles.close} onPress={onClose}>
        <Icon name="close-circle" size={40} color={WHITE} />
      </TouchableOpacity>
    </View>
  );
}

const vpStyles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  video:       { width: W, height: W * (9 / 16) },
  playOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  close:       { position: 'absolute', top: 50, right: 20 },
});

// ══════════════════════════════════════════════════════════════════════════════
export default function MemoriesScreen() {
  const { colors } = useTheme();

  // ── STATE ──────────────────────────────────────────────────────────────────
  const [memories,          setMemories]         = useState<Memory[]>([]);
  const [selectedMemory,    setSelectedMemory]   = useState<Memory | null>(null);
  const [showCaptionModal,  setShowCaptionModal] = useState(false);
  const [showCommentModal,  setShowCommentModal] = useState(false);
  const [showVideoPlayer,   setShowVideoPlayer]  = useState(false);
  const [commentMemory,     setCommentMemory]    = useState<Memory | null>(null);
  const [newComment,        setNewComment]       = useState('');
  const [tempCaption,       setTempCaption]      = useState('');
  const [tempLocation,      setTempLocation]     = useState('');
  const [newMediaUri,       setNewMediaUri]      = useState('');
  const [newMediaType,      setNewMediaType]     = useState<'image' | 'video'>('image');
  const [viewMode,          setViewMode]         = useState<ViewMode>('grid');
  const [numColumns,        setNumColumns]       = useState<ColCount>(2);
  const [search,            setSearch]           = useState('');
  const [showSearch,        setShowSearch]       = useState(false);
  const [filterMood,        setFilterMood]       = useState<string>('all');
  const [filterFav,         setFilterFav]        = useState(false);
  const [filterMedia,       setFilterMedia]      = useState<'all' | 'image' | 'video'>('all');
  const [tempMood,          setTempMood]         = useState<MoodKey>('random');
  const [loading,           setLoading]          = useState(true);
  const [refreshing,        setRefreshing]       = useState(false);
  const [uploading,         setUploading]        = useState(false);
  const [uploadProgress,    setUploadProgress]   = useState(0);
  const [error,             setError]            = useState<string | null>(null);
  // For grid column cycling we keep a ref for FlatList key-forcing
  const [listKey,           setListKey]          = useState('grid-2');

  const searchAnim = useRef(new Animated.Value(0)).current;

  // ── HELPERS: card width by column count ──────────────────────────────────
  const cardWidth = useCallback(
    (cols: ColCount) => (W - 32 - (cols - 1) * 8) / cols,
    []
  );

  // ── LOAD ──────────────────────────────────────────────────────────────────
  const loadMemories = async () => {
    try {
      setLoading(true);
      setError(null);

      const cached = await AsyncStorage.getItem(STORAGE_KEY);
      if (cached) setMemories(JSON.parse(cached));

      const { data: files, error: listError } = await supabase
        .storage.from(BUCKET_NAME).list();

      if (listError) {
        setError(
          listError.message.includes('Bucket not found')
            ? 'Storage bucket not found. Please set up Supabase storage.'
            : 'Failed to reach storage'
        );
        return;
      }

      const mediaFiles = files?.filter(f =>
        f.name.startsWith('memory_') &&
        f.name.match(/\.(jpg|jpeg|png|gif|webp|bmp|mp4|mov|avi|webm|m4v)$/i)
      ) ?? [];

      let memoryData: Memory[] = [];
      const meta = await AsyncStorage.getItem(META_KEY);
      if (meta) {
        const parsed: Memory[] = JSON.parse(meta);
        memoryData = parsed.filter(m => mediaFiles.some(f => f.name === m.fileName));
      }

      if (memoryData.length === 0 && mediaFiles.length > 0) {
        memoryData = mediaFiles.map(file => {
          const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(file.name);
          return {
            id: file.id || file.name,
            fileName: file.name,
            uri: urlData.publicUrl,
            caption: 'Untitled memory',
            date: file.created_at || new Date().toISOString(),
            mood: 'random',
            fav: false,
            mediaType: isVideo(file.name) ? 'video' : 'image',
            comments: [],
            likes: 0,
            liked: false,
          };
        });
        await AsyncStorage.setItem(META_KEY, JSON.stringify(memoryData));
      }

      const updated: Memory[] = memoryData.map(m => {
        const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(m.fileName);
        return { ...m, uri: urlData.publicUrl };
      });

      setMemories(updated);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Load error:', e);
      setError('Failed to load memories');
    } finally {
      setLoading(false);
    }
  };

  const saveMemories = async (next: Memory[]) => {
    setMemories(next);
    await AsyncStorage.setItem(META_KEY, JSON.stringify(next));
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  // ── UPLOAD ────────────────────────────────────────────────────────────────
  const uploadMediaToSupabase = async (
    mediaUri: string,
    mType: 'image' | 'video'
  ): Promise<{ url: string; fileName: string } | null> => {
    try {
      setUploading(true);
      setUploadProgress(0);

      const rawExt = mediaUri.split('.').pop()?.toLowerCase() || (mType === 'video' ? 'mp4' : 'jpg');
      const ext = rawExt.split('?')[0]; // strip query strings from URI
      const fileName = `memory_${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

      const base64 = await FileSystem.readAsStringAsync(mediaUri, { encoding: 'base64' });
      setUploadProgress(40);

      const byteChars = atob(base64);
      const byteArr = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteArr[i] = byteChars.charCodeAt(i);
      }
      setUploadProgress(70);

      const contentType = mType === 'video' ? `video/${ext}` : `image/${ext}`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(fileName, byteArr, { contentType, cacheControl: '3600' });

      if (uploadError) throw uploadError;
      setUploadProgress(95);

      const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);
      setUploadProgress(100);

      return { url: urlData.publicUrl, fileName };
    } catch (e: any) {
      console.error('Upload error:', e);
      Alert.alert('Upload failed', e?.message ?? 'Unknown error');
      return null;
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const deleteImageFromSupabase = async (fileName: string) => {
    try {
      const { error } = await supabase.storage.from(BUCKET_NAME).remove([fileName]);
      if (error) throw error;
      return true;
    } catch {
      return false;
    }
  };

  // ── PERMISSIONS ─────────────────────────────────────────────────────────
  const requestPermissions = async () => {
    await ImagePicker.requestMediaLibraryPermissionsAsync();
  };

  // ── PICK MEDIA (image OR video) ─────────────────────────────────────────
  const pickMedia = async (type: 'image' | 'video' | 'any' = 'any') => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes:
          type === 'image'
            ? ImagePicker.MediaTypeOptions.Images
            : type === 'video'
            ? ImagePicker.MediaTypeOptions.Videos
            : ImagePicker.MediaTypeOptions.All,
        allowsEditing: type !== 'video',
        quality: 0.85,
        videoMaxDuration: 120, // 2 min cap
      });

      if (!result.canceled) {
        const asset = result.assets[0];
        const mType = asset.type === 'video' ? 'video' : 'image';
        setNewMediaUri(asset.uri);
        setNewMediaType(mType);
        setTempMood('random');
        setTempCaption('');
        setTempLocation('');
        setShowCaptionModal(true);
      }
    } catch (e) {
      Alert.alert('Error', 'Could not open media picker');
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera access is required');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.85 });
      if (!result.canceled) {
        setNewMediaUri(result.assets[0].uri);
        setNewMediaType('image');
        setTempMood('random');
        setTempCaption('');
        setTempLocation('');
        setShowCaptionModal(true);
      }
    } catch {
      Alert.alert('Error', 'Could not open camera');
    }
  };

  // ── ADD MEMORY ────────────────────────────────────────────────────────────
  const addMemory = async () => {
    if (!tempCaption.trim()) {
      Alert.alert('Caption required', 'Add a caption for this memory ✨');
      return;
    }

    const result = await uploadMediaToSupabase(newMediaUri, newMediaType);
    if (!result) return;

    const newMemory: Memory = {
      id: Date.now().toString(),
      uri: result.url,
      fileName: result.fileName,
      caption: tempCaption.trim(),
      date: new Date().toISOString(),
      location: tempLocation.trim() || undefined,
      mood: tempMood,
      fav: false,
      mediaType: newMediaType,
      comments: [],
      likes: 0,
      liked: false,
    };

    await saveMemories([newMemory, ...memories]);
    setShowCaptionModal(false);
    setTempCaption('');
    setTempLocation('');
    setNewMediaUri('');
    setTempMood('random');
    Alert.alert('Saved! 💫', 'Memory added to the cloud.');
  };

  // ── DELETE MEMORY ─────────────────────────────────────────────────────────
  const deleteMemory = (id: string) => {
    Alert.alert('Delete Memory', 'Remove this from cloud storage?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const m = memories.find(x => x.id === id);
          if (m) {
            await deleteImageFromSupabase(m.fileName);
            await saveMemories(memories.filter(x => x.id !== id));
            if (selectedMemory?.id === id) setSelectedMemory(null);
          }
        },
      },
    ]);
  };

  // ── TOGGLE FAVOURITE ──────────────────────────────────────────────────────
  const toggleFav = async (id: string) => {
    const next = memories.map(m => (m.id === id ? { ...m, fav: !m.fav } : m));
    await saveMemories(next);
    if (selectedMemory?.id === id) {
      setSelectedMemory(prev => prev ? { ...prev, fav: !prev.fav } : null);
    }
  };

  // ── TOGGLE LIKE ───────────────────────────────────────────────────────────
  const toggleLike = async (id: string) => {
    const next = memories.map(m =>
      m.id === id
        ? { ...m, liked: !m.liked, likes: m.liked ? m.likes - 1 : m.likes + 1 }
        : m
    );
    await saveMemories(next);
    if (selectedMemory?.id === id) {
      setSelectedMemory(prev =>
        prev ? { ...prev, liked: !prev.liked, likes: prev.liked ? prev.likes - 1 : prev.likes + 1 } : null
      );
    }
  };

  // ── ADD COMMENT ───────────────────────────────────────────────────────────
  const addComment = async () => {
    if (!newComment.trim() || !commentMemory) return;
    const comment: Comment = {
      id: Date.now().toString(),
      text: newComment.trim(),
      author: 'You',
      createdAt: new Date().toISOString(),
    };
    const next = memories.map(m =>
      m.id === commentMemory.id
        ? { ...m, comments: [...(m.comments ?? []), comment] }
        : m
    );
    await saveMemories(next);
    setCommentMemory(next.find(m => m.id === commentMemory.id) ?? null);
    setNewComment('');
  };

  const deleteComment = async (memoryId: string, commentId: string) => {
    const next = memories.map(m =>
      m.id === memoryId
        ? { ...m, comments: m.comments.filter(c => c.id !== commentId) }
        : m
    );
    await saveMemories(next);
    setCommentMemory(next.find(m => m.id === memoryId) ?? null);
  };

  // ── SHARE ─────────────────────────────────────────────────────────────────
  const shareMemory = async (m: Memory) => {
    try {
      await Share.share({ message: `${m.caption} 📍${m.location ?? ''}\n${m.uri}` });
    } catch {}
  };

  // ── SEARCH TOGGLE ─────────────────────────────────────────────────────────
  const toggleSearch = () => {
    const toValue = showSearch ? 0 : 1;
    setShowSearch(!showSearch);
    if (showSearch) setSearch('');
    Animated.spring(searchAnim, { toValue, useNativeDriver: false, friction: 8 }).start();
  };

  // ── COLUMN CYCLE ─────────────────────────────────────────────────────────
  const cycleColumns = () => {
    const nextIdx = (COL_OPTIONS.indexOf(numColumns) + 1) % COL_OPTIONS.length;
    const next = COL_OPTIONS[nextIdx];
    setNumColumns(next);
    setListKey(`grid-${next}`);
  };

  // ── REFRESH ───────────────────────────────────────────────────────────────
  const onRefresh = async () => {
    setRefreshing(true);
    await loadMemories();
    setRefreshing(false);
  };

  // ── EFFECTS ───────────────────────────────────────────────────────────────
  useEffect(() => {
    loadMemories();
    requestPermissions();
  }, []);

  // ── FILTERED MEMORIES ─────────────────────────────────────────────────────
  const filteredMemories = memories.filter(m => {
    if (filterFav && !m.fav) return false;
    if (filterMood !== 'all' && m.mood !== filterMood) return false;
    if (filterMedia !== 'all' && m.mediaType !== filterMedia) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        m.caption.toLowerCase().includes(q) ||
        (m.location ?? '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const onThisDayMemories = memories.filter(m => isOnThisDay(m.date));
  const searchBarHeight   = searchAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 56] });

  // ── COLUMN ICON ───────────────────────────────────────────────────────────
  const colIcon = numColumns === 1 ? 'square' : numColumns === 2 ? 'grid' : 'apps';

  // ── MEDIA THUMB ───────────────────────────────────────────────────────────
  const renderMediaThumb = (item: Memory, style: any) =>
    item.mediaType === 'video'
      ? <VideoThumb uri={item.uri} style={style} />
      : <Image source={{ uri: item.uri }} style={style} resizeMode="cover"
          onError={() => console.warn('Image error:', item.uri)} />;

  // ── RENDER GRID ITEM ──────────────────────────────────────────────────────
  const renderGridItem = ({ item, index }: { item: Memory; index: number }) => {
    const mood  = getMood(item.mood);
    const onTD  = isOnThisDay(item.date);
    const cW    = cardWidth(numColumns);
    const imgH  = numColumns === 1 ? 220 : numColumns === 2 ? 160 : 120;

    return (
      <FadeCard index={index}>
        <TouchableOpacity
          style={[
            styles.memoryCard,
            { width: cW, borderColor: mood.color + '55' },
          ]}
          onPress={() => {
            if (item.mediaType === 'video') {
              setSelectedMemory(item);
              setShowVideoPlayer(true);
            } else {
              setSelectedMemory(item);
            }
          }}
          onLongPress={() => deleteMemory(item.id)}
          activeOpacity={0.9}
        >
          {renderMediaThumb(item, { width: '100%', height: imgH })}

          {/* On-this-day ribbon */}
          {onTD && (
            <View style={[styles.ribbon, { backgroundColor: mood.color }]}>
              <Text style={styles.ribbonTxt}>On this day</Text>
            </View>
          )}

          {/* Mood pill */}
          <View style={[styles.moodPill, { backgroundColor: mood.color }]}>
            <Icon name={mood.icon as any} size={10} color={WHITE} />
          </View>

          {/* Video badge */}
          {item.mediaType === 'video' && (
            <View style={styles.videoBadge}>
              <Icon name="videocam" size={10} color={WHITE} />
            </View>
          )}

          {/* Fav */}
          <TouchableOpacity style={styles.favBtn} onPress={() => toggleFav(item.id)}>
            <Icon
              name={item.fav ? 'heart' : 'heart-outline'}
              size={16}
              color={item.fav ? '#EF4444' : WHITE}
            />
          </TouchableOpacity>

          {/* Caption overlay */}
          <View style={[styles.captionOverlay, { borderTopColor: mood.color + '88' }]}>
            <Text style={styles.captionText} numberOfLines={numColumns === 1 ? 3 : 2}>
              {item.caption}
            </Text>
            <View style={styles.cardMeta}>
              <Text style={styles.dateText}>{formatDate(item.date)}</Text>
              <View style={styles.cardMetaRight}>
                {/* Like */}
                <TouchableOpacity style={styles.microAction} onPress={() => toggleLike(item.id)}>
                  <Icon name={item.liked ? 'heart' : 'heart-outline'} size={12} color={item.liked ? '#EF4444' : SOFT} />
                  {item.likes > 0 && <Text style={styles.microCount}>{item.likes}</Text>}
                </TouchableOpacity>
                {/* Comment */}
                <TouchableOpacity
                  style={styles.microAction}
                  onPress={() => { setCommentMemory(item); setShowCommentModal(true); }}
                >
                  <Icon name="chatbubble-outline" size={12} color={SOFT} />
                  {(item.comments?.length ?? 0) > 0 && (
                    <Text style={styles.microCount}>{item.comments.length}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </FadeCard>
   );
  };

  // ── RENDER TIMELINE ITEM ──────────────────────────────────────────────────
  const renderTimelineItem = ({ item, index }: { item: Memory; index: number }) => {
    const mood = getMood(item.mood);
    const onTD = isOnThisDay(item.date);
    return (
      <FadeCard index={index}>
        <View style={styles.timelineRow}>
          <View style={styles.spineCol}>
            <View style={[styles.spineDot, { backgroundColor: mood.color }]} />
            {index < filteredMemories.length - 1 && (
              <View style={[styles.spineLine, { backgroundColor: mood.color + '44' }]} />
            )}
          </View>
          <TouchableOpacity
            style={[styles.timelineCard, { borderLeftColor: mood.color }]}
            onPress={() => {
              if (item.mediaType === 'video') {
                setSelectedMemory(item);
                setShowVideoPlayer(true);
              } else {
                setSelectedMemory(item);
              }
            }}
            onLongPress={() => deleteMemory(item.id)}
            activeOpacity={0.9}
          >
            {renderMediaThumb(item, styles.timelineImage)}
            <View style={styles.timelineInfo}>
              <View style={[styles.timelineMoodBadge, { backgroundColor: mood.bg }]}>
                <Icon name={mood.icon as any} size={12} color={mood.color} />
                <Text style={[styles.timelineMoodTxt, { color: mood.color }]}>{mood.label}</Text>
                {item.mediaType === 'video' && (
                  <Icon name="videocam" size={11} color={mood.color} style={{ marginLeft: 4 }} />
                )}
              </View>
              <Text style={styles.timelineCaption} numberOfLines={3}>{item.caption}</Text>
              {item.location ? (
                <View style={styles.locationRow}>
                  <Icon name="location-outline" size={11} color={MID} />
                  <Text style={styles.locationText}>{item.location}</Text>
                </View>
              ) : null}
              <View style={styles.timelineBottom}>
                <Text style={styles.timelineDate}>{formatDate(item.date)}</Text>
                {onTD && (
                  <View style={[styles.onThisDayBadge, { backgroundColor: mood.color + '22' }]}>
                    <Text style={[styles.onThisDayBadgeTxt, { color: mood.color }]}>On this day</Text>
                  </View>
                )}
                <View style={styles.timelineActions}>
                  <TouchableOpacity onPress={() => toggleFav(item.id)}>
                    <Icon name={item.fav ? 'heart' : 'heart-outline'} size={16}
                      color={item.fav ? '#EF4444' : SOFT} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => toggleLike(item.id)}>
                    <Icon name={item.liked ? 'thumbs-up' : 'thumbs-up-outline'} size={16}
                      color={item.liked ? PINK : SOFT} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setCommentMemory(item); setShowCommentModal(true); }}>
                    <Icon name="chatbubble-outline" size={16} color={SOFT} />
                    {(item.comments?.length ?? 0) > 0 && (
                      <View style={styles.commentBadge}>
                        <Text style={styles.commentBadgeTxt}>{item.comments.length}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => shareMemory(item)}>
                    <Icon name="share-outline" size={16} color={SOFT} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </FadeCard>
    );
  };

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
<PremiumGuard>
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background ?? BG }]} edges={['top']}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.text ?? DARK }]}>Our Memories</Text>
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
            <Icon name={filterFav ? 'heart' : 'heart-outline'} size={20}
              color={filterFav ? WHITE : PINK} />
          </TouchableOpacity>
          {/* Column count toggle — only in grid view */}
          {viewMode === 'grid' && (
            <TouchableOpacity style={styles.iconBtn} onPress={cycleColumns}>
              <Icon name={colIcon} size={18} color={PINK} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.iconBtn}
            onPress={() => setViewMode(v => v === 'grid' ? 'timeline' : 'grid')}>
            <Icon name={viewMode === 'grid' ? 'list' : 'grid'} size={20} color={PINK} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Search bar ── */}
      <Animated.View style={{ height: searchBarHeight, overflow: 'hidden' }}>
        <View style={styles.searchRow}>
          <Icon name="search-outline" size={16} color={SOFT} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by caption or location..."
            placeholderTextColor={SOFT}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Icon name="close-circle" size={18} color={SOFT} />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      {/* ── Media type filter ── */}
      <View style={styles.mediaFilterRow}>
        {(['all', 'image', 'video'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.mediaFilterBtn, filterMedia === t && styles.mediaFilterBtnActive]}
            onPress={() => setFilterMedia(t)}
          >
            <Icon
              name={t === 'all' ? 'albums-outline' : t === 'image' ? 'image-outline' : 'videocam-outline'}
              size={13}
              color={filterMedia === t ? WHITE : MID}
            />
            <Text style={[styles.mediaFilterTxt, filterMedia === t && styles.mediaFilterTxtActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

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
            style={[styles.moodTab, filterMood === m.key && { backgroundColor: m.color, borderColor: m.color }]}
            onPress={() => setFilterMood(filterMood === m.key ? 'all' : m.key)}
          >
            <Icon name={m.icon as any} size={13} color={filterMood === m.key ? WHITE : m.color} />
            <Text style={[styles.moodTabTxt, filterMood === m.key && styles.moodTabTxtActive]}>
              {m.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── On-this-day banner ── */}
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

      {/* ── Upload progress bar ── */}
      {uploading && (
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { width: `${uploadProgress}%` }]} />
          <Text style={styles.progressTxt}>
            Uploading… {Math.round(uploadProgress)}%
          </Text>
        </View>
      )}

      {/* ── Error state ── */}
      {error && (
        <View style={styles.errorBox}>
          <Icon name="alert-circle" size={20} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={loadMemories}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Add buttons ── */}
      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.actionButton} onPress={() => pickMedia('image')} disabled={uploading}>
          <Icon name="images" size={20} color={WHITE} />
          <Text style={styles.buttonText}>Photo</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => pickMedia('video')} disabled={uploading}>
          <Icon name="videocam" size={20} color={WHITE} />
          <Text style={styles.buttonText}>Video</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={takePhoto} disabled={uploading}>
          <Icon name="camera" size={20} color={WHITE} />
          <Text style={styles.buttonText}>Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionButton, styles.refreshButton]} onPress={onRefresh}>
          <Icon name="refresh" size={20} color={WHITE} />
          <Text style={styles.buttonText}>Sync</Text>
        </TouchableOpacity>
      </View>

      {/* ── Content ── */}
      {loading && memories.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PINK} />
          <Text style={styles.loadingText}>Loading memories…</Text>
        </View>
      ) : filteredMemories.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📷</Text>
          <Text style={styles.emptyTitle}>No memories yet</Text>
          <Text style={styles.emptySub}>
            {filterFav || filterMood !== 'all' || filterMedia !== 'all' || search
              ? 'Try adjusting your filters'
              : 'Start capturing your special moments'}
          </Text>
        </View>
      ) : viewMode === 'grid' ? (
        <FlatList
          key={listKey}
          data={filteredMemories}
          keyExtractor={item => item.id}
          numColumns={numColumns}
          columnWrapperStyle={numColumns > 1 ? styles.columnWrapper : undefined}
          contentContainerStyle={styles.gridContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PINK} />}
          renderItem={renderGridItem}
        />
      ) : (
        <FlatList
          data={filteredMemories}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={PINK} />}
          renderItem={renderTimelineItem}
        />
      )}

      {/* ── Full-screen viewer (image) ── */}
      <Modal visible={!!selectedMemory && !showVideoPlayer} transparent animationType="fade">
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.modalClose} onPress={() => setSelectedMemory(null)}>
            <Icon name="close-circle" size={40} color={WHITE} />
          </TouchableOpacity>
          {selectedMemory && (() => {
            const mood = getMood(selectedMemory.mood);
            return (
              <ScrollView
                style={{ width: '100%' }}
                contentContainerStyle={styles.viewerScrollContent}
                showsVerticalScrollIndicator={false}
              >
                <Image
                  source={{ uri: selectedMemory.uri }}
                  style={styles.fullImage}
                  resizeMode="contain"
                  onError={() => console.warn('Modal image error')}
                />

                <View style={[styles.viewerMoodBadge, { backgroundColor: mood.color }]}>
                  <Icon name={mood.icon as any} size={14} color={WHITE} />
                  <Text style={styles.viewerMoodTxt}>{mood.label}</Text>
                </View>

                <Text style={styles.modalCaption}>{selectedMemory.caption}</Text>
                <Text style={styles.modalDate}>{formatDate(selectedMemory.date)}</Text>

                {selectedMemory.location ? (
                  <View style={styles.modalLocation}>
                    <Icon name="location-outline" size={14} color={SOFT} />
                    <Text style={styles.modalLocationTxt}>{selectedMemory.location}</Text>
                  </View>
                ) : null}

                {isOnThisDay(selectedMemory.date) && (
                  <Text style={[styles.modalDate, { color: mood.color, marginTop: 4 }]}>
                    🌸 On this day last year
                  </Text>
                )}

                {/* Action row */}
                <View style={styles.viewerActions}>
                  <TouchableOpacity style={styles.viewerActionBtn}
                    onPress={() => toggleFav(selectedMemory.id)}>
                    <Icon name={selectedMemory.fav ? 'heart' : 'heart-outline'} size={22}
                      color={selectedMemory.fav ? '#EF4444' : WHITE} />
                    <Text style={styles.viewerActionTxt}>
                      {selectedMemory.fav ? 'Unfav' : 'Fav'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.viewerActionBtn}
                    onPress={() => toggleLike(selectedMemory.id)}>
                    <Icon name={selectedMemory.liked ? 'thumbs-up' : 'thumbs-up-outline'} size={22}
                      color={selectedMemory.liked ? PINK : WHITE} />
                    <Text style={styles.viewerActionTxt}>
                      {selectedMemory.likes > 0 ? selectedMemory.likes : ''} Like
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.viewerActionBtn}
                    onPress={() => { setCommentMemory(selectedMemory); setShowCommentModal(true); }}>
                    <Icon name="chatbubble-outline" size={22} color={WHITE} />
                    <Text style={styles.viewerActionTxt}>
                      {(selectedMemory.comments?.length ?? 0) > 0
                        ? selectedMemory.comments.length
                        : ''} Comment
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.viewerActionBtn}
                    onPress={() => shareMemory(selectedMemory)}>
                    <Icon name="share-outline" size={22} color={WHITE} />
                    <Text style={styles.viewerActionTxt}>Share</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.viewerActionBtn}
                    onPress={() => deleteMemory(selectedMemory.id)}>
                    <Icon name="trash-outline" size={22} color="#EF4444" />
                    <Text style={[styles.viewerActionTxt, { color: '#EF4444' }]}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            );
          })()}
        </View>
      </Modal>

      {/* ── Full-screen video player modal ── */}
      <Modal visible={!!selectedMemory && showVideoPlayer} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          {selectedMemory && (
            <VideoPlayer
              uri={selectedMemory.uri}
              onClose={() => { setShowVideoPlayer(false); setSelectedMemory(null); }}
            />
          )}
          {selectedMemory && (
            <View style={styles.videoCaption}>
              <Text style={styles.videoCaptionTxt}>{selectedMemory.caption}</Text>
              {selectedMemory.location ? (
                <View style={styles.locationRow}>
                  <Icon name="location-outline" size={12} color={SOFT} />
                  <Text style={[styles.locationText, { color: SOFT }]}>{selectedMemory.location}</Text>
                </View>
              ) : null}
              <View style={styles.viewerActions}>
                <TouchableOpacity style={styles.viewerActionBtn}
                  onPress={() => toggleFav(selectedMemory.id)}>
                  <Icon name={selectedMemory.fav ? 'heart' : 'heart-outline'} size={20}
                    color={selectedMemory.fav ? '#EF4444' : WHITE} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.viewerActionBtn}
                  onPress={() => { setCommentMemory(selectedMemory); setShowCommentModal(true); }}>
                  <Icon name="chatbubble-outline" size={20} color={WHITE} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.viewerActionBtn}
                  onPress={() => shareMemory(selectedMemory)}>
                  <Icon name="share-outline" size={20} color={WHITE} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.viewerActionBtn}
                  onPress={() => deleteMemory(selectedMemory.id)}>
                  <Icon name="trash-outline" size={20} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>

      {/* ── Comments modal ── */}
      <Modal visible={showCommentModal} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.commentModalWrap}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.commentSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.commentTitle}>
              💬 Comments {commentMemory?.comments?.length ? `(${commentMemory.comments.length})` : ''}
            </Text>

            <ScrollView style={styles.commentList} showsVerticalScrollIndicator={false}>
              {(commentMemory?.comments ?? []).length === 0 ? (
                <Text style={styles.noComments}>No comments yet — be the first 💕</Text>
              ) : (
                (commentMemory?.comments ?? []).map(c => (
                  <View key={c.id} style={styles.commentItem}>
                    <View style={styles.commentAvatar}>
                      <Text style={styles.commentAvatarTxt}>{c.author[0]}</Text>
                    </View>
                    <View style={styles.commentBody}>
                      <View style={styles.commentHeader}>
                        <Text style={styles.commentAuthor}>{c.author}</Text>
                        <Text style={styles.commentTime}>{formatRelative(c.createdAt)}</Text>
                      </View>
                      <Text style={styles.commentText}>{c.text}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => deleteComment(commentMemory!.id, c.id)}
                      style={styles.commentDelete}
                    >
                      <Icon name="trash-outline" size={14} color={SOFT} />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>

            <View style={styles.commentInputRow}>
              <TextInput
                style={styles.commentInput}
                placeholder="Write a comment… 💬"
                placeholderTextColor={SOFT}
                value={newComment}
                onChangeText={setNewComment}
                returnKeyType="send"
                onSubmitEditing={addComment}
                maxLength={300}
              />
              <TouchableOpacity
                style={[styles.commentSendBtn, { opacity: newComment.trim() ? 1 : 0.5 }]}
                onPress={addComment}
                disabled={!newComment.trim()}
              >
                <Icon name="send" size={18} color={WHITE} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.commentClose} onPress={() => setShowCommentModal(false)}>
              <Text style={styles.commentCloseTxt}>Close</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Add-memory caption modal ── */}
      <Modal visible={showCaptionModal} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.captionModal}>
            <View style={styles.sheetHandle} />

            {/* Preview */}
            {!!newMediaUri && (
              newMediaType === 'video'
                ? <VideoThumb uri={newMediaUri} style={styles.captionPreview} />
                : <Image source={{ uri: newMediaUri }} style={styles.captionPreview} resizeMode="cover" />
            )}

            <Text style={styles.captionTitle}>
              {newMediaType === 'video' ? '🎬 New Video Memory' : '📸 New Photo Memory'}
            </Text>

            {/* Caption */}
            <TextInput
              style={styles.captionInput}
              placeholder="What happened on this day? ✨"
              placeholderTextColor={SOFT}
              value={tempCaption}
              onChangeText={setTempCaption}
              multiline
              maxLength={250}
            />

            {/* Location */}
            <TextInput
              style={[styles.captionInput, { height: 44, marginTop: 10 }]}
              placeholder="📍 Location (optional)"
              placeholderTextColor={SOFT}
              value={tempLocation}
              onChangeText={setTempLocation}
              maxLength={80}
            />

            {/* Mood selector */}
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

            {/* Buttons */}
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setShowCaptionModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={addMemory} disabled={uploading}>
                {uploading ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <ActivityIndicator color={WHITE} size="small" />
                    <Text style={styles.saveText}>{Math.round(uploadProgress)}%</Text>
                  </View>
                ) : (
                  <Text style={styles.saveText}>Save Memory</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
</PremiumGuard> 
 );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG, paddingBottom: 100 },

  // Header
  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle:    { fontSize: 22, fontWeight: '800', color: DARK, letterSpacing: -0.5 },
  headerSub:      { fontSize: 12, color: MID, marginTop: 2 },
  headerActions:  { flexDirection: 'row', gap: 6 },
  iconBtn:        { width: 36, height: 36, borderRadius: 18, backgroundColor: WHITE, justifyContent: 'center', alignItems: 'center', elevation: 2, shadowColor: PINK, shadowOpacity: 0.15, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  iconBtnActive:  { backgroundColor: PINK },

  // Search
  searchRow:    { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 6, backgroundColor: WHITE, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, elevation: 1 },
  searchInput:  { flex: 1, fontSize: 14, color: DARK, padding: 0 },

  // Media filter
  mediaFilterRow:       { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 4 },
  mediaFilterBtn:       { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16, backgroundColor: WHITE, borderWidth: 1.5, borderColor: '#EDD8E8' },
  mediaFilterBtnActive: { backgroundColor: PINK, borderColor: PINK },
  mediaFilterTxt:       { fontSize: 11, fontWeight: '600', color: MID },
  mediaFilterTxtActive: { color: WHITE },

  // Mood filter tabs
  moodTabsScroll:   { flexGrow: 0, marginBottom: 4 },
  moodTabsContent:  { paddingHorizontal: 16, gap: 8, paddingVertical: 6 },
  moodTab:          { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: WHITE, borderWidth: 1.5, borderColor: '#EDD8E8' },
  moodTabActive:    { backgroundColor: PINK, borderColor: PINK },
  moodTabTxt:       { fontSize: 12, fontWeight: '600', color: MID },
  moodTabTxtActive: { color: WHITE },

  // On this day banner
  onThisDayBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 8, backgroundColor: '#FFF0F7', borderRadius: 12, padding: 12, borderLeftWidth: 3, borderLeftColor: PINK },
  onThisDayText:   { flex: 1, fontSize: 13, color: PINK, fontWeight: '600' },

  // Upload progress
  progressContainer: { marginHorizontal: 16, marginBottom: 8, height: 28, backgroundColor: '#FFF0F7', borderRadius: 10, overflow: 'hidden', justifyContent: 'center' },
  progressBar:       { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: PINK, borderRadius: 10 },
  progressTxt:       { textAlign: 'center', fontSize: 11, fontWeight: '700', color: DARK },

  // Error
  errorBox:  { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 8, backgroundColor: '#FEE2E2', borderRadius: 12, padding: 12, gap: 8 },
  errorText: { flex: 1, fontSize: 13, color: '#EF4444' },
  retryText: { fontSize: 13, color: '#3B82F6', fontWeight: '600' },

  // Add buttons
  buttonRow:     { flexDirection: 'row', justifyContent: 'space-around', marginHorizontal: 16, marginBottom: 10, gap: 6 },
  actionButton:  { flex: 1, flexDirection: 'row', backgroundColor: PINK, paddingVertical: 10, borderRadius: 22, alignItems: 'center', justifyContent: 'center', gap: 5, elevation: 3, shadowColor: PINK, shadowOpacity: 0.35, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  refreshButton: { backgroundColor: '#007AFF' },
  buttonText:    { color: WHITE, fontWeight: '700', fontSize: 12 },

  // Loading
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText:      { marginTop: 12, fontSize: 16, color: MID },

  // Empty
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 80 },
  emptyIcon:  { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: DARK },
  emptySub:   { fontSize: 14, color: MID, marginTop: 6 },

  // Grid
  gridContent:   { paddingHorizontal: 16, paddingBottom: 24 },
  columnWrapper: { justifyContent: 'space-between', marginBottom: 8 },

  // Grid card
  memoryCard:     { marginBottom: 8, borderRadius: 16, overflow: 'hidden', backgroundColor: WHITE, elevation: 3, shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, borderWidth: 1.5 },
  ribbon:         { position: 'absolute', top: 10, left: 0, paddingHorizontal: 8, paddingVertical: 3, borderTopRightRadius: 8, borderBottomRightRadius: 8 },
  ribbonTxt:      { color: WHITE, fontSize: 9, fontWeight: '700' },
  moodPill:       { position: 'absolute', top: 10, right: 34, width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  videoBadge:     { position: 'absolute', top: 10, left: 50, width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center' },
  favBtn:         { position: 'absolute', top: 8, right: 8, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center' },
  captionOverlay: { padding: 8, backgroundColor: 'rgba(0,0,0,0.68)', borderTopWidth: 1.5 },
  captionText:    { color: WHITE, fontSize: 11, fontWeight: '500', lineHeight: 15 },
  cardMeta:       { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  dateText:       { color: PINK, fontSize: 9, flex: 1 },
  cardMetaRight:  { flexDirection: 'row', gap: 8 },
  microAction:    { flexDirection: 'row', alignItems: 'center', gap: 2 },
  microCount:     { color: SOFT, fontSize: 9, fontWeight: '700' },

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
  timelineBottom:    { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6, flexWrap: 'wrap' },
  timelineDate:      { fontSize: 11, color: MID },
  timelineActions:   { flexDirection: 'row', gap: 14, marginLeft: 'auto' },
  onThisDayBadge:    { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  onThisDayBadgeTxt: { fontSize: 10, fontWeight: '700' },
  locationRow:       { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  locationText:      { fontSize: 11, color: MID },
  commentBadge:      { position: 'absolute', top: -4, right: -4, width: 12, height: 12, borderRadius: 6, backgroundColor: PINK, justifyContent: 'center', alignItems: 'center' },
  commentBadgeTxt:   { color: WHITE, fontSize: 8, fontWeight: '800' },

  // Viewer modal
  modalContainer:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.97)', justifyContent: 'center', alignItems: 'center' },
  modalClose:           { position: 'absolute', top: 50, right: 20, zIndex: 10 },
  viewerScrollContent:  { alignItems: 'center', paddingTop: 80, paddingBottom: 40, paddingHorizontal: 16 },
  fullImage:            { width: W - 32, height: (W - 32) * 0.75, borderRadius: 18 },
  viewerMoodBadge:      { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20, marginTop: 16 },
  viewerMoodTxt:        { color: WHITE, fontSize: 13, fontWeight: '700' },
  modalCaption:         { color: WHITE, fontSize: 18, marginTop: 14, textAlign: 'center', fontWeight: '600' },
  modalDate:            { color: PINK, fontSize: 14, marginTop: 8 },
  modalLocation:        { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  modalLocationTxt:     { color: SOFT, fontSize: 13 },
  viewerActions:        { flexDirection: 'row', gap: 20, marginTop: 20, flexWrap: 'wrap', justifyContent: 'center' },
  viewerActionBtn:      { alignItems: 'center', gap: 4 },
  viewerActionTxt:      { color: WHITE, fontSize: 11, fontWeight: '600' },

  // Video caption
  videoCaption:    { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.75)', padding: 16 },
  videoCaptionTxt: { color: WHITE, fontSize: 15, fontWeight: '600', marginBottom: 8 },

  // Caption modal
  captionModal:      { backgroundColor: WHITE, borderRadius: 24, padding: 20, width: '94%', maxHeight: '92%' },
  sheetHandle:       { width: 40, height: 4, backgroundColor: '#EDD8E8', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  captionPreview:    { width: '100%', height: 140, borderRadius: 16, marginBottom: 16, backgroundColor: '#111', overflow: 'hidden' },
  captionTitle:      { fontSize: 18, fontWeight: '800', color: DARK, marginBottom: 12, textAlign: 'center' },
  captionInput:      { borderWidth: 1.5, borderColor: '#EDD8E8', borderRadius: 14, padding: 14, height: 90, textAlignVertical: 'top', fontSize: 15, color: DARK },
  moodSelectorLabel: { fontSize: 14, fontWeight: '700', color: DARK, marginTop: 12, marginBottom: 8 },
  moodSelectBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 2 },
  moodSelectTxt:     { fontSize: 12, fontWeight: '700' },
  modalButtons:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
  cancelText:        { color: MID, fontSize: 16 },
  saveBtn:           { backgroundColor: PINK, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 22, elevation: 3, minWidth: 120, alignItems: 'center' },
  saveText:          { color: WHITE, fontSize: 15, fontWeight: '700' },

  // Comments modal
  commentModalWrap:  { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  commentSheet:      { backgroundColor: WHITE, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '80%' },
  commentTitle:      { fontSize: 18, fontWeight: '800', color: DARK, marginBottom: 12 },
  commentList:       { maxHeight: 320, marginBottom: 12 },
  noComments:        { textAlign: 'center', color: MID, fontSize: 14, paddingVertical: 20 },
  commentItem:       { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 14, gap: 10 },
  commentAvatar:     { width: 32, height: 32, borderRadius: 16, backgroundColor: PINK, justifyContent: 'center', alignItems: 'center' },
  commentAvatarTxt:  { color: WHITE, fontWeight: '800', fontSize: 13 },
  commentBody:       { flex: 1, backgroundColor: '#FFF5F7', borderRadius: 12, padding: 10 },
  commentHeader:     { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  commentAuthor:     { fontSize: 12, fontWeight: '700', color: DARK },
  commentTime:       { fontSize: 10, color: SOFT },
  commentText:       { fontSize: 13, color: DARK, lineHeight: 18 },
  commentDelete:     { paddingTop: 6 },
  commentInputRow:   { flexDirection: 'row', gap: 10, marginBottom: 10 },
  commentInput:      { flex: 1, borderWidth: 1.5, borderColor: '#EDD8E8', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: DARK },
  commentSendBtn:    { width: 44, height: 44, borderRadius: 22, backgroundColor: PINK, justifyContent: 'center', alignItems: 'center' },
  commentClose:      { alignSelf: 'center', paddingVertical: 10 },
  commentCloseTxt:   { color: MID, fontSize: 15, fontWeight: '600' },
});
