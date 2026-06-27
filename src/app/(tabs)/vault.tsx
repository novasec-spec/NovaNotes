// screens/SecretVaultScreen.tsx
// ═══════════════════════════════════════════════════════════════════════════
//  🔐 THE SECRET VAULT — all-in-one file
//  Features: OTA love notes, time capsules, heartbeat pulse, daily surprise,
//  shake easter egg, anniversary counter, search, pin/unpin, idle Supabase sync
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet,
  Alert, Modal, Animated, ScrollView, KeyboardAvoidingView,
  Platform, Dimensions, ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import DeveloperInfoModal from '../developer';

// ─── Optional deps (won't crash if not installed) ───────────────────────
let Accelerometer: any = null;
try { Accelerometer = require('expo-sensors').Accelerometer; } catch {}

let NetInfo: any = null;
try { NetInfo = require('@react-native-community/netinfo').default; } catch {}

let supabase: any = null;
try { supabase = require('../../services/supabase').supabase; } catch {}

const { width: W } = Dimensions.get('window');

// ═════════════════════════════════════════════════════════════════════════
//  🔐 VAULT PASSWORD
// ═════════════════════════════════════════════════════════════════════════
const VAULT_PASSWORD = 'munga';

// ═════════════════════════════════════════════════════════════════════════
//  💌 YOUR SECRET LOVE NOTES — edit these, push OTA, she gets them magic
// ═════════════════════════════════════════════════════════════════════════
type CategoryKey = 'love' | 'memory' | 'milestone' | 'promise' | 'thought' | 'secret';

interface SecretNote {
  id:         string;
  title:      string;
  text:       string;
  date:       string;
  category?:  CategoryKey;
  fromMe?:    boolean;
  pinned?:    boolean;  unlocksAt?: string; // 🕰️ time capsule — locked until this date
}

// 💕 Reasons I love her — one random one shows each day
const REASONS_I_LOVE_YOU = [
  "The way your eyes light up when you laugh",
  "How you make even boring days feel special",
  "Your terrible puns that somehow make me smile",
  "The way you scrunch your nose when you're thinking",
  "How safe I feel when you're holding my hand",
  "Your kindness to strangers",
  "The sound of your voice first thing in the morning",
  "How you remember the little things I say",
  "Your courage to be exactly who you are",
  "The way you look at me like I'm enough",
  "How you sing off-key and don't care",
  "Your laugh — it's my favorite sound",
];

// 🎯 YOUR FIRST DATE — for the anniversary counter
const RELATIONSHIP_START = '2024-02-14T00:00:00.000Z';

// 📱 SHAKE EASTER EGG
const SHAKE_SECRET = {
  title: "You found the hidden one 🤫",
  text:  "This is the note I wrote at 3am when I couldn't sleep because I was thinking about how lucky I am. You're my favorite human. Always.",
};

// 💌 MESSAGES FROM YOU — add more anytime, push OTA update
const MESSAGES_FROM_ME: SecretNote[] = [
  {
    id:       'from-me-001',
    title:    'Just thinking of you 💭',
    text:     'I wanted you to find this. You are the most beautiful thing that has ever happened to me. I love you more than any words in here could ever explain.',
    date:     '2026-06-04T08:00:00.000Z',
    category: 'love',
    fromMe:   true,
    pinned:   true,
  },
  {
    id:       'from-me-002',
    title:    'Happy short girls my love 🎂',
    text:     'Today is your day, but every day with you feels like a celebration. You deserve the world and more.',
    date:     '2026-06-05T00:00:00.000Z',
    category: 'milestone',
    fromMe:   true,
  },
  {
    id:        'from-me-003',
    title:     'Open on a rainy day 🌧️',    text:      "If you're reading this, it's raining. I hope you're curled up somewhere warm. I wish I was there with you. Remember — every storm passes, and I'm always your umbrella.",
    date:      '2026-06-10T00:00:00.000Z',
    category:  'secret',
    fromMe:    true,
    unlocksAt: '2026-06-25T00:00:00.000Z',
  },
  {
    id:        'from-me-004',
    title:     'Our anniversary 💍',
    text:      'Another year of you. Another year of me being the luckiest person alive.',
    date:      '2026-06-15T00:00:00.000Z',
    category:  'milestone',
    fromMe:    true,
    unlocksAt: '2026-11-14T00:00:00.000Z',
  },
];

// ═════════════════════════════════════════════════════════════════════════
//  COLORS + CATEGORIES
// ═════════════════════════════════════════════════════════════════════════
const PINK  = '#FF6B9D';
const ROSE  = '#FFE4ED';
const BG    = '#FFF5F7';
const WHITE = '#FFFFFF';
const DARK  = '#2D1B25';
const MID   = '#9A7090';
const SOFT  = '#C4A0B8';

const CATEGORIES = [
  { key: 'love',      label: 'Love',      icon: 'heart',       color: '#EF4444', bg: '#FFF0F0' },
  { key: 'memory',    label: 'Memory',    icon: 'image',       color: '#F59E0B', bg: '#FFFBEB' },
  { key: 'milestone', label: 'Milestone', icon: 'star',        color: '#A855F7', bg: '#F5F0FF' },
  { key: 'promise',   label: 'Promise',   icon: 'ribbon',      color: '#3B82F6', bg: '#EFF6FF' },
  { key: 'thought',   label: 'Thought',   icon: 'bulb',        color: '#22C55E', bg: '#F0FDF4' },
  { key: 'secret',    label: 'Secret',    icon: 'lock-closed', color: '#EC4899', bg: '#FDF2F8' },
] as const;

function getCat(key?: string) {
  return CATEGORIES.find(c => c.key === key) ?? CATEGORIES[5];
}

// ═════════════════════════════════════════════════════════════════════════
//  ☁️ SUPABASE SYNC — runs quietly in background
// ═════════════════════════════════════════════════════════════════════════
const SYNC_KEY  = '@vault_last_sync';
const DIRTY_KEY = '@vault_dirty_ids';
const DEBOUNCE_MS = 45_000;

let syncTimer: ReturnType<typeof setTimeout> | null = null;
async function markDirty(noteId: string) {
  try {
    const raw = await AsyncStorage.getItem(DIRTY_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    if (!ids.includes(noteId)) ids.push(noteId);
    await AsyncStorage.setItem(DIRTY_KEY, JSON.stringify(ids));
    scheduleIdleSync();
  } catch {}
}

function scheduleIdleSync() {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => trySync('idle'), DEBOUNCE_MS);
}

async function trySync(reason: 'idle' | 'foreground' | 'manual' = 'manual') {
  if (!supabase) return; // no supabase configured — graceful fallback
  try {
    // Check network
    if (NetInfo && reason !== 'manual') {
      const net = await NetInfo.fetch();
      if (!net.isConnected) return;
      if (reason === 'idle' && net.type !== 'wifi') return; // idle = wifi only
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 1. Upload dirty local notes
    const dirtyRaw = await AsyncStorage.getItem(DIRTY_KEY);
    const dirtyIds: string[] = dirtyRaw ? JSON.parse(dirtyRaw) : [];
    const localRaw = await AsyncStorage.getItem('secretMessages');
    const localNotes: SecretNote[] = localRaw ? JSON.parse(localRaw) : [];

    for (const id of dirtyIds) {
      const note = localNotes.find(n => n.id === id);
      if (!note) continue;
      await supabase.from('vault_notes').upsert({
        id:         note.id,
        user_id:    user.id,
        title:      note.title,
        text:       note.text,
        date:       note.date,
        category:   note.category ?? 'secret',
        from_me:    !!note.fromMe,
        pinned:     !!note.pinned,
        unlocks_at: note.unlocksAt ?? null,
        updated_at: new Date().toISOString(),
      });
    }    await AsyncStorage.setItem(DIRTY_KEY, JSON.stringify([]));

    // 2. Download remote notes and merge
    const { data: remote } = await supabase
      .from('vault_notes')
      .select('*')
      .eq('user_id', user.id);

    if (remote && remote.length) {
      const remoteNotes: SecretNote[] = remote.map((r: any) => ({
        id:        r.id,
        title:     r.title,
        text:      r.text,
        date:      r.date,
        category:  r.category,
        fromMe:    r.from_me,
        pinned:    r.pinned,
        unlocksAt: r.unlocks_at ?? undefined,
      }));
      const merged = mergeNotes(MESSAGES_FROM_ME, localNotes, remoteNotes);
      await AsyncStorage.setItem('secretMessages', JSON.stringify(merged));
    }
    await AsyncStorage.setItem(SYNC_KEY, new Date().toISOString());
  } catch (e) {
    console.warn('[vaultSync] failed:', e);
  }
}

function mergeNotes(ota: SecretNote[], local: SecretNote[], remote: SecretNote[]): SecretNote[] {
  const map = new Map<string, SecretNote>();
  ota.forEach(n    => map.set(n.id, n));
  local.forEach(n  => { if (!map.has(n.id)) map.set(n.id, n); });
  remote.forEach(n => map.set(n.id, n));
  return Array.from(map.values());
}

// ═════════════════════════════════════════════════════════════════════════
//  💓 HEARTBEAT BADGE
// ═════════════════════════════════════════════════════════════════════════
function HeartbeatBadge() {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.25, duration: 200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 200, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.15, duration: 180, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 180, useNativeDriver: true }),
      ])
    );    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View style={{ transform: [{ scale: pulse }] }}>
      <View style={styles.fromMeBadge}>
        <Icon name="heart" size={10} color={WHITE} />
        <Text style={styles.fromMeTxt}>from him</Text>
      </View>
    </Animated.View>
  );
}

// ═════════════════════════════════════════════════════════════════════════
//  📇 NOTE CARD
// ═════════════════════════════════════════════════════════════════════════
function NoteCard({
  item, index, onPress, onLongPress, onTogglePin,
}: {
  item: SecretNote; index: number;
  onPress: () => void; onLongPress: () => void; onTogglePin: () => void;
}) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 380, delay: Math.min(index * 60, 500), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 380, delay: Math.min(index * 60, 500), useNativeDriver: true }),
    ]).start();
  }, []);

  const cat = getCat(item.category);
  const isLocked = item.unlocksAt && new Date(item.unlocksAt) > new Date();

  const timeLeft = () => {
    if (!item.unlocksAt) return '';
    const diff = new Date(item.unlocksAt).getTime() - Date.now();
    if (diff <= 0) return '';
    const days = Math.floor(diff / 86400000);
    if (days > 30) return `${Math.floor(days / 30)}mo`;
    return `${days}d`;
  };

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <TouchableOpacity
        style={[styles.noteCard, { borderLeftColor: cat.color }, isLocked && styles.noteCardLocked]}
        onPress={onPress}
        onLongPress={() => {          if (item.fromMe) return; // can't pin OTA notes
          onTogglePin();
        }}
        activeOpacity={0.88}
      >
        {/* Top row */}
        <View style={styles.noteCardTop}>
          <View style={[styles.catBadge, { backgroundColor: cat.bg }]}>
            <Icon name={cat.icon as any} size={12} color={cat.color} />
            <Text style={[styles.catBadgeTxt, { color: cat.color }]}>{cat.label}</Text>
          </View>
          <View style={styles.noteCardIcons}>
            {item.pinned && <Icon name="pin" size={13} color={PINK} />}
            {item.fromMe ? <HeartbeatBadge /> : null}
          </View>
        </View>

        {/* Title */}
        <Text style={styles.noteTitle} numberOfLines={1}>{item.title}</Text>

        {/* Preview OR lock */}
        {isLocked ? (
          <View style={styles.capsuleLock}>
            <Icon name="hourglass" size={16} color="#A855F7" />
            <Text style={styles.capsuleText}>
              Locked · opens in {timeLeft()}
            </Text>
          </View>
        ) : (
          <Text style={styles.notePreview} numberOfLines={2}>{item.text}</Text>
        )}

        {/* Date */}
        <Text style={styles.noteDate}>
          {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ═════════════════════════════════════════════════════════════════════════
//  🏛️ MAIN SCREEN
// ═════════════════════════════════════════════════════════════════════════
export default function SecretVaultScreen() {
  const { colors } = useTheme();

  // ── Core state ──
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pin, setPin] = useState('');  const [secretMessages, setSecretMessages] = useState<SecretNote[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [filterCat, setFilterCat] = useState<string>('all');
  const [viewingNote, setViewingNote] = useState<SecretNote | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<CategoryKey>('secret');
  const [pinError, setPinError] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [showShakeSecret, setShowShakeSecret] = useState(false);
  const [dailyReason, setDailyReason] = useState<string | null>(null);
  const [anniversary, setAnniversary] = useState({ years: 0, months: 0, days: 0 });
  const [syncing, setSyncing] = useState(false);

  const shakeAnim   = useRef(new Animated.Value(0)).current;
  const lockScale   = useRef(new Animated.Value(0.8)).current;
  const lockOpacity = useRef(new Animated.Value(0)).current;
  const lastShake   = useRef(0);
  const subRef      = useRef<any>(null);

  // ── Entrance animation ──
  useEffect(() => {
    Animated.parallel([
      Animated.spring(lockScale,   { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
      Animated.timing(lockOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  // ── Load + anniversary + daily reason + shake ──
  useEffect(() => {
    if (isUnlocked) {
      loadSecretMessages();
      trySync('foreground');
    }
  }, [isUnlocked]);

  useEffect(() => {
    // Anniversary counter
    const tick = () => {
      const start = new Date(RELATIONSHIP_START).getTime();
      const diff = Date.now() - start;
      const days = Math.floor(diff / 86400000);
      const years = Math.floor(days / 365.25);
      const months = Math.floor((days % 365.25) / 30.44);
      const d = Math.floor((days % 365.25) % 30.44);
      setAnniversary({ years, months, days: d });
    };
    tick();    const t = setInterval(tick, 60_000);

    // Daily love reason (deterministic per day)
    const dayIdx = Math.floor(Date.now() / 86400000) % REASONS_I_LOVE_YOU.length;
    setDailyReason(REASONS_I_LOVE_YOU[dayIdx]);

    // Shake detector
    if (Accelerometer && isUnlocked) {
      try {
        Accelerometer.setUpdateInterval(200);
        subRef.current = Accelerometer.addListener(({ x, y, z }: any) => {
          const g = Math.sqrt(x * x + y * y + z * z);
          if (g > 2.2 && Date.now() - lastShake.current > 2500) {
            lastShake.current = Date.now();
            setShowShakeSecret(true);
          }
        });
      } catch {}
    }

    return () => {
      clearInterval(t);
      subRef.current?.remove?.();
    };
  }, [isUnlocked]);

  // ── Verify PIN ──
  const verifyPin = async () => {
    if (pin === VAULT_PASSWORD) {
      setIsUnlocked(true);
      setPin('');
      setPinError(false);
      setAttempts(0);
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setPinError(true);
      setPin('');
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 10,  duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 8,   duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -8,  duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0,   duration: 60, useNativeDriver: true }),
      ]).start();
      if (newAttempts >= 5) {
        Alert.alert('Too many attempts', 'Wait a moment before trying again 💕');
        setAttempts(0);
      }
    }  };

  // ── Load notes (merge OTA + local) ──
  const loadSecretMessages = async () => {
    const saved = await AsyncStorage.getItem('secretMessages');
    const userNotes: SecretNote[] = saved ? JSON.parse(saved) : [];
    const userIds = new Set(userNotes.map(n => n.id));
    const newOTA = MESSAGES_FROM_ME.filter(m => !userIds.has(m.id));
    const merged = [...MESSAGES_FROM_ME, ...userNotes.filter(n => !n.fromMe)];

    if (newOTA.length > 0) {
      const all = [...userNotes, ...newOTA];
      await AsyncStorage.setItem('secretMessages', JSON.stringify(all));
    }
    setSecretMessages(merged);
  };

  // ── Add note ──
  const addSecretMessage = async () => {
    if (!newMessage.trim()) return;
    const note: SecretNote = {
      id:       Date.now().toString(),
      title:    newTitle.trim() || 'My secret',
      text:     newMessage.trim(),
      date:     new Date().toISOString(),
      category: newCategory,
      fromMe:   false,
      pinned:   false,
    };
    const userNotes = secretMessages.filter(n => !n.fromMe);
    const updatedUser = [note, ...userNotes];
    await AsyncStorage.setItem('secretMessages', JSON.stringify(updatedUser));
    setSecretMessages([...MESSAGES_FROM_ME, ...updatedUser]);
    setNewMessage('');
    setNewTitle('');
    setNewCategory('secret');
    setShowAddModal(false);
    markDirty(note.id);
  };

  // ── Toggle pin ──
  const togglePin = async (id: string) => {
    const updated = secretMessages.map(n =>
      n.id === id ? { ...n, pinned: !n.pinned } : n
    );
    const userNotes = updated.filter(n => !n.fromMe);
    await AsyncStorage.setItem('secretMessages', JSON.stringify(userNotes));
    setSecretMessages(updated);
    markDirty(id);
  };
  // ── Delete note ──
  const deleteNote = (id: string) => {
    Alert.alert('Delete Note', "Are you sure? This can't be undone 💔", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          const userNotes = secretMessages.filter(n => !n.fromMe && n.id !== id);
          const otaNotes = secretMessages.filter(n => n.fromMe);
          await AsyncStorage.setItem('secretMessages', JSON.stringify(userNotes));
          setSecretMessages([...otaNotes, ...userNotes]);
          setViewingNote(null);
          markDirty(id);
        },
      },
    ]);
  };

  const lockVault = () => {
    Alert.alert('Lock Vault', 'Lock the secret vault?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Lock', onPress: () => { setIsUnlocked(false); setFilterCat('all'); setSearchQuery(''); } },
    ]);
  };

  const manualSync = async () => {
    setSyncing(true);
    await trySync('manual');
    await loadSecretMessages();
    setSyncing(false);
    Alert.alert('Synced ☁️', 'Your vault is backed up safely 💕');
  };

  // ── Filtered + sorted ──
  const displayed = secretMessages
    .filter(n => filterCat === 'all' || n.category === filterCat)
    .filter(n =>
      !searchQuery.trim() ||
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.text.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

  const fromMeCount   = secretMessages.filter(n => n.fromMe).length;
  const userNoteCount = secretMessages.filter(n => !n.fromMe).length;
  // ═══════════════════════════════════════════════════════════════════════
  //  🔒 LOCKED SCREEN
  // ═══════════════════════════════════════════════════════════════════════
  if (!isUnlocked) {
    return (
      <View style={[styles.lockedBg, { backgroundColor: colors.background }]}>
        <Animated.View style={[
          styles.lockedCard, { backgroundColor: colors.card },
          { opacity: lockOpacity, transform: [{ scale: lockScale }, { translateX: shakeAnim }] },
        ]}>
          <View style={styles.lockIconWrap}>
            <Icon name="lock-closed" size={36} color={PINK} />
          </View>
          <Text style={[styles.lockedTitle, { color: colors.text }]}>Secret Vault</Text>
          <Text style={styles.lockedSub}>Your private space 💕</Text>

          <TextInput
            style={[styles.pinInput, pinError && styles.pinInputError]}
            placeholder="Enter password"
            placeholderTextColor={SOFT}
            secureTextEntry
            autoCapitalize="none"
            value={pin}
            onChangeText={t => { setPin(t); setPinError(false); }}
            onSubmitEditing={verifyPin}
          />

          {pinError && (
            <Text style={styles.pinErrorTxt}>Wrong password 💔 Try again</Text>
          )}

          <TouchableOpacity style={styles.unlockButton} onPress={verifyPin}>
            <Icon name="lock-open" size={18} color={WHITE} />
            <Text style={styles.unlockText}>Unlock</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.iconBtn, { marginTop: 16, backgroundColor: 'transparent', elevation: 0, shadowOpacity: 0 }]}
            onPress={() => router.push('/tokenmanager')}
          >
            <Icon name="settings-outline" size={16} color={SOFT} />
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  🔓 UNLOCKED SCREEN  // ═══════════════════════════════════════════════════════════════════════
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Secret Vault</Text>
          <Text style={styles.headerSub}>{secretMessages.length} private notes</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setShowAddModal(true)}>
            <Icon name="add" size={22} color={PINK} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={manualSync} disabled={syncing}>
            {syncing
              ? <ActivityIndicator size="small" color={PINK} />
              : <Icon name="cloud-upload" size={18} color={PINK} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={lockVault}>
            <Icon name="lock-closed" size={18} color={PINK} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setShowInfoModal(true)}>
            <Icon name="information-circle" size={18} color={PINK} />
          </TouchableOpacity>
        </View>
      </View>

      {/* 💍 Anniversary banner */}
      <View style={styles.anniBanner}>
        <Icon name="heart" size={16} color={PINK} />
        <Text style={styles.anniText}>
          {anniversary.years}y {anniversary.months}m {anniversary.days}d of us 💕
        </Text>
      </View>

      {/* 🎲 Daily reason */}
      {dailyReason && (
        <View style={styles.dailyReason}>
          <Text style={styles.dailyLabel}>Today's reason I love you</Text>
          <Text style={styles.dailyText}>"{dailyReason}"</Text>
        </View>
      )}

      {/* Stats banner */}
      <View style={styles.statsBanner}>
        <View style={styles.statItem}>
          <Icon name="heart" size={16} color={PINK} />
          <Text style={styles.statVal}>{fromMeCount}</Text>
          <Text style={styles.statLbl}>from him</Text>
        </View>        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Icon name="journal" size={16} color={MID} />
          <Text style={styles.statVal}>{userNoteCount}</Text>
          <Text style={styles.statLbl}>your notes</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Icon name="pin" size={16} color="#A855F7" />
          <Text style={styles.statVal}>{secretMessages.filter(n => n.pinned).length}</Text>
          <Text style={styles.statLbl}>pinned</Text>
        </View>
      </View>

      {/* 🔍 Search */}
      <View style={styles.searchWrap}>
        <Icon name="search" size={16} color={MID} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search your secrets..."
          placeholderTextColor={SOFT}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Icon name="close-circle" size={16} color={SOFT} />
          </TouchableOpacity>
        )}
      </View>

      {/* Category filter tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.catTabsScroll}
        contentContainerStyle={styles.catTabsContent}
      >
        <TouchableOpacity
          style={[styles.catTab, filterCat === 'all' && styles.catTabActive]}
          onPress={() => setFilterCat('all')}
        >
          <Text style={[styles.catTabTxt, filterCat === 'all' && styles.catTabTxtActive]}>All</Text>
        </TouchableOpacity>
        {CATEGORIES.map(c => (
          <TouchableOpacity
            key={c.key}
            style={[styles.catTab, filterCat === c.key && { backgroundColor: c.color, borderColor: c.color }]}
            onPress={() => setFilterCat(filterCat === c.key ? 'all' : c.key)}
          >            <Icon name={c.icon as any} size={12} color={filterCat === c.key ? WHITE : c.color} />
            <Text style={[styles.catTabTxt, filterCat === c.key && styles.catTabTxtActive]}>{c.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Notes list */}
      {displayed.length === 0 ? (
        <View style={styles.emptyState}>
          <Icon name="lock-closed-outline" size={44} color={SOFT} />
          <Text style={styles.emptyTitle}>Nothing here yet</Text>
          <Text style={styles.emptySub}>Add your first secret note 💕</Text>
        </View>
      ) : (
        <FlatList
          data={displayed}
          keyExtractor={item => item.id}
          contentContainerStyle={{ padding: 16, paddingTop: 8 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <NoteCard
              item={item}
              index={index}
              onPress={() => setViewingNote(item)}
              onLongPress={() => !item.fromMe && deleteNote(item.id)}
              onTogglePin={() => togglePin(item.id)}
            />
          )}
        />
      )}

      {/* Add note modal */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalBg}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.modalTitle}>Add Secret Note</Text>

            <TextInput
              style={styles.titleInput}
              placeholder="Title (optional)"
              placeholderTextColor={SOFT}
              value={newTitle}
              onChangeText={setNewTitle}
              maxLength={60}
            />
            <TextInput
              style={styles.secretInput}
              placeholder="Something only we know..."
              placeholderTextColor={SOFT}
              value={newMessage}
              onChangeText={setNewMessage}
              multiline
              maxLength={600}
            />

            <Text style={styles.catSelectorLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {CATEGORIES.map(c => (
                  <TouchableOpacity
                    key={c.key}
                    onPress={() => setNewCategory(c.key)}
                    style={[
                      styles.catSelectBtn,
                      { backgroundColor: c.bg, borderColor: newCategory === c.key ? c.color : 'transparent' },
                    ]}
                  >
                    <Icon name={c.icon as any} size={15} color={c.color} />
                    <Text style={[styles.catSelectTxt, { color: c.color }]}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={addSecretMessage}>
                <Icon name="lock-closed" size={14} color={WHITE} />
                <Text style={styles.saveText}>Save Note</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Full-screen note viewer */}
      <Modal visible={!!viewingNote} transparent animationType="fade">
        <View style={styles.viewerBg}>
          <SafeAreaView style={{ flex: 1 }}>
            {viewingNote && (() => {
              const cat = getCat(viewingNote.category);
              const isLocked = viewingNote.unlocksAt && new Date(viewingNote.unlocksAt) > new Date();
              return (                <View style={styles.viewerCard}>
                  <View style={styles.viewerHeader}>
                    <TouchableOpacity onPress={() => setViewingNote(null)} style={styles.viewerBack}>
                      <Icon name="arrow-back" size={20} color={DARK} />
                    </TouchableOpacity>
                    <View style={[styles.catBadge, { backgroundColor: cat.bg }]}>
                      <Icon name={cat.icon as any} size={13} color={cat.color} />
                      <Text style={[styles.catBadgeTxt, { color: cat.color }]}>{cat.label}</Text>
                    </View>
                    {!viewingNote.fromMe && (
                      <TouchableOpacity onPress={() => deleteNote(viewingNote.id)} style={styles.viewerDelete}>
                        <Icon name="trash-outline" size={18} color="#EF4444" />
                      </TouchableOpacity>
                    )}
                  </View>

                  {viewingNote.fromMe && (
                    <View style={styles.fromMeFullBadge}>
                      <Icon name="heart" size={14} color={WHITE} />
                      <Text style={styles.fromMeFullTxt}>A message from him 💕</Text>
                    </View>
                  )}

                  {isLocked ? (
                    <View style={styles.lockedCapsule}>
                      <Icon name="hourglass" size={48} color="#A855F7" />
                      <Text style={styles.lockedCapsuleTitle}>This note is locked 🔒</Text>
                      <Text style={styles.lockedCapsuleDate}>
                        Opens on{' '}
                        {new Date(viewingNote.unlocksAt!).toLocaleDateString('en-US', {
                          weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
                        })}
                      </Text>
                      <Text style={styles.lockedCapsuleSub}>
                        Some things are worth waiting for 💜
                      </Text>
                    </View>
                  ) : (
                    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                      <Text style={styles.viewerTitle}>{viewingNote.title}</Text>
                      <Text style={styles.viewerDate}>
                        {new Date(viewingNote.date).toLocaleDateString('en-US', {
                          weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
                        })}
                      </Text>
                      <Text style={styles.viewerText}>{viewingNote.text}</Text>
                    </ScrollView>
                  )}
                </View>
              );            })()}
          </SafeAreaView>
        </View>
      </Modal>

      {/* 📱 Shake easter egg modal */}
      <Modal visible={showShakeSecret} transparent animationType="fade">
        <View style={styles.shakeBg}>
          <View style={styles.shakeCard}>
            <Icon name="heart" size={40} color={PINK} />
            <Text style={styles.shakeTitle}>{SHAKE_SECRET.title}</Text>
            <Text style={styles.shakeText}>{SHAKE_SECRET.text}</Text>
            <TouchableOpacity
              style={styles.shakeClose}
              onPress={() => setShowShakeSecret(false)}
            >
              <Text style={{ color: WHITE, fontWeight: '700' }}>I love you too 💕</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <DeveloperInfoModal visible={showInfoModal} onClose={() => setShowInfoModal(false)} />
    </SafeAreaView>
  );
}

// ═════════════════════════════════════════════════════════════════════════
//  STYLES
// ═════════════════════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  // Lock screen
  lockedBg:      { flex: 1, backgroundColor: BG, justifyContent: 'center', alignItems: 'center' },
  lockedCard:    { width: W * 0.88, backgroundColor: WHITE, borderRadius: 28, padding: 32, alignItems: 'center', elevation: 6, shadowColor: PINK, shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
  lockIconWrap:  { width: 72, height: 72, borderRadius: 36, backgroundColor: ROSE, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  lockedTitle:   { fontSize: 24, fontWeight: '800', color: DARK, letterSpacing: -0.4 },
  lockedSub:     { fontSize: 14, color: MID, marginTop: 4, marginBottom: 20 },
  pinInput:      { borderWidth: 2, borderColor: '#F3D6E8', borderRadius: 16, padding: 14, width: '100%', textAlign: 'center', fontSize: 18, color: DARK, letterSpacing: 2, marginBottom: 6 },
  pinInputError: { borderColor: '#EF4444' },
  pinErrorTxt:   { color: '#EF4444', fontSize: 13, marginBottom: 12 },
  unlockButton:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: PINK, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 26, marginTop: 10, elevation: 3, shadowColor: PINK, shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  unlockText:    { color: WHITE, fontSize: 17, fontWeight: '700' },

  // Header
  header:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  headerTitle:   { fontSize: 22, fontWeight: '800', color: DARK, letterSpacing: -0.4 },
  headerSub:     { fontSize: 12, color: MID, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 8 },  iconBtn:       { width: 38, height: 38, borderRadius: 19, backgroundColor: WHITE, justifyContent: 'center', alignItems: 'center', elevation: 2, shadowColor: PINK, shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },

  // Anniversary
  anniBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginBottom: 10, backgroundColor: ROSE, padding: 12, borderRadius: 16, justifyContent: 'center' },
  anniText:   { fontSize: 14, fontWeight: '700', color: PINK },

  // Daily reason
  dailyReason: { marginHorizontal: 20, marginBottom: 12, backgroundColor: '#FFF0F6', padding: 14, borderRadius: 16, borderLeftWidth: 4, borderLeftColor: PINK },
  dailyLabel:  { fontSize: 11, color: MID, fontWeight: '700', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  dailyText:   { fontSize: 14, color: DARK, fontStyle: 'italic', lineHeight: 20 },

  // Stats banner
  statsBanner: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 10, backgroundColor: WHITE, borderRadius: 18, padding: 14, alignItems: 'center', justifyContent: 'space-around', elevation: 1 },
  statItem:    { alignItems: 'center', gap: 3 },
  statVal:     { fontSize: 18, fontWeight: '800', color: DARK },
  statLbl:     { fontSize: 10, color: MID, fontWeight: '600' },
  statDivider: { width: 1, height: 32, backgroundColor: '#F3E8EF' },

  // Search
  searchWrap:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginBottom: 10, backgroundColor: WHITE, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1, borderColor: '#EDD8E8' },
  searchInput: { flex: 1, fontSize: 14, color: DARK },

  // Category tabs
  catTabsScroll:   { flexGrow: 0, marginBottom: 4 },
  catTabsContent:  { paddingHorizontal: 16, gap: 8, paddingVertical: 6 },
  catTab:          { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: WHITE, borderWidth: 1.5, borderColor: '#EDD8E8' },
  catTabActive:    { backgroundColor: PINK, borderColor: PINK },
  catTabTxt:       { fontSize: 12, fontWeight: '600', color: MID },
  catTabTxtActive: { color: WHITE },

  // Empty state
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: DARK },
  emptySub:   { fontSize: 14, color: MID },

  // Note card
  noteCard:       { backgroundColor: WHITE, borderRadius: 18, padding: 16, marginBottom: 12, borderLeftWidth: 4, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  noteCardLocked: { opacity: 0.85, backgroundColor: '#FAFAFA' },
  noteCardTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  noteCardIcons:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  catBadge:       { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10 },
  catBadgeTxt:    { fontSize: 11, fontWeight: '700' },
  fromMeBadge:    { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: PINK, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  fromMeTxt:      { color: WHITE, fontSize: 10, fontWeight: '700' },
  noteTitle:      { fontSize: 15, fontWeight: '800', color: DARK, marginBottom: 5 },
  notePreview:    { fontSize: 13, color: MID, lineHeight: 19, marginBottom: 8 },
  noteDate:       { fontSize: 11, color: SOFT },

  // Time capsule
  capsuleLock: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F5F0FF', padding: 8, borderRadius: 10, alignSelf: 'flex-start', marginBottom: 8 },  capsuleText: { fontSize: 12, color: '#A855F7', fontWeight: '600' },

  // Add modal
  modalBg:          { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalSheet:       { backgroundColor: WHITE, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, maxHeight: '90%' },
  sheetHandle:      { width: 40, height: 4, backgroundColor: '#EDD8E8', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle:       { fontSize: 20, fontWeight: '800', color: DARK, textAlign: 'center', marginBottom: 16 },
  titleInput:       { borderWidth: 1.5, borderColor: '#EDD8E8', borderRadius: 14, padding: 13, fontSize: 15, color: DARK, marginBottom: 10 },
  secretInput:      { borderWidth: 1.5, borderColor: '#EDD8E8', borderRadius: 14, padding: 14, height: 110, textAlignVertical: 'top', fontSize: 14, color: DARK, marginBottom: 14 },
  catSelectorLabel: { fontSize: 13, fontWeight: '700', color: DARK, marginBottom: 8 },
  catSelectBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 2 },
  catSelectTxt:     { fontSize: 12, fontWeight: '700' },
  modalButtons:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, paddingBottom: 8 },
  cancelText:       { color: MID, fontSize: 16 },
  saveBtn:          { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: PINK, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 22 },
  saveText:         { color: WHITE, fontWeight: '700', fontSize: 15 },

  // Full viewer
  viewerBg:        { flex: 1, backgroundColor: BG },
  viewerCard:      { flex: 1, padding: 20 },
  viewerHeader:    { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  viewerBack:      { width: 36, height: 36, borderRadius: 18, backgroundColor: WHITE, justifyContent: 'center', alignItems: 'center', elevation: 1 },
  viewerDelete:    { marginLeft: 'auto', width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFF0F0', justifyContent: 'center', alignItems: 'center' },
  fromMeFullBadge: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: PINK, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, alignSelf: 'flex-start', marginBottom: 16 },
  fromMeFullTxt:   { color: WHITE, fontWeight: '700', fontSize: 13 },
  viewerTitle:     { fontSize: 24, fontWeight: '800', color: DARK, marginBottom: 6, lineHeight: 30 },
  viewerDate:      { fontSize: 13, color: SOFT, marginBottom: 18 },
  viewerText:      { fontSize: 16, color: DARK, lineHeight: 26 },

  // Locked capsule viewer
  lockedCapsule:      { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, backgroundColor: '#F5F0FF', borderRadius: 20, marginTop: 20 },
  lockedCapsuleTitle: { fontSize: 20, fontWeight: '800', color: DARK, marginTop: 16, marginBottom: 8, textAlign: 'center' },
  lockedCapsuleDate:  { fontSize: 15, color: '#A855F7', fontWeight: '600', textAlign: 'center', marginBottom: 8 },
  lockedCapsuleSub:   { fontSize: 13, color: MID, fontStyle: 'italic', textAlign: 'center' },

  // Shake easter egg
  shakeBg:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  shakeCard:  { backgroundColor: WHITE, borderRadius: 24, padding: 28, alignItems: 'center', maxWidth: 320 },
  shakeTitle: { fontSize: 20, fontWeight: '800', color: DARK, marginTop: 12, marginBottom: 10, textAlign: 'center' },
  shakeText:  { fontSize: 15, color: MID, lineHeight: 22, textAlign: 'center', marginBottom: 20 },
  shakeClose: { backgroundColor: PINK, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 22 },
});
