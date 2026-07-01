
// ─────────────────────────────────────────────────────────────────────────────
//  app/(tabs)/chat/settings.tsx
//  Chat & App Settings screen
// ─────────────────────────────────────────────────────────────────────────────
//
//  SECTIONS:
//  1. Profile         — avatar, display name, email (read-only), edit entry
//  2. Notifications   — push toggle, sound, message preview
//  3. Appearance      — theme toggle (light/dark), font size hint
//  4. Privacy         — read receipts, online status, last seen
//  5. Data & Storage  — cache sizes, clear cache, clear media
//  6. About           — version, changelog
//  7. Danger zone     — Logout (confirms first, updates online→false, signs out)
//
// ─────────────────────────────────────────────────────────────────────────────

import React, {
  useState, useEffect, useCallback,
} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Switch, Alert, Image, ActivityIndicator, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../../contexts/ThemeContext';
import { supabase } from '../../../config/supabase';
import { User } from './types';

// ── Storage key that holds cached chat users ──────────────────────────────────
const CACHE_USERS_KEY    = 'chatlist_users_cache';
const CACHE_CHATS_KEY    = 'chatlist_chats_cache';
const CACHE_MESSAGES_KEY = 'chatroom_messages_';  // prefix — we'll wipe any key starting with this

// ── App version ───────────────────────────────────────────────────────────────
const APP_VERSION = '1.0.0';

// ── Preference keys ───────────────────────────────────────────────────────────
const PREF_NOTIF_ENABLED  = 'pref_notif_enabled';
const PREF_NOTIF_SOUND    = 'pref_notif_sound';
const PREF_MSG_PREVIEW    = 'pref_msg_preview';
const PREF_READ_RECEIPTS  = 'pref_read_receipts';
const PREF_SHOW_ONLINE    = 'pref_show_online';
const PREF_SHOW_LAST_SEEN = 'pref_show_last_seen';

// ── Helper: format bytes ──────────────────────────────────────────────────────
function fmtBytes(bytes: number): string {
  if (bytes < 1024)         return `${bytes} B`;
  if (bytes < 1024 * 1024)  return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─────────────────────────────────────────────────────────────────────────────
//  Row components
// ─────────────────────────────────────────────────────────────────────────────
function SectionHeader({ title, colors }: { title: string; colors: any }) {
  return (
    <Text style={[sStyles.sectionHeader, { color: colors.muted }]}>{title.toUpperCase()}</Text>
  );
}

function SettingRow({
  icon, iconLib = 'ion', label, sublabel, right, onPress, color, colors, danger,
}: {
  icon: string; iconLib?: 'ion' | 'mc'; label: string; sublabel?: string;
  right?: React.ReactNode; onPress?: () => void;
  color?: string; colors: any; danger?: boolean;
}) {
  const ic = iconLib === 'mc'
    ? <MCIcon name={icon} size={22} color={color ?? (danger ? '#EF4444' : colors.text)} />
    : <Icon   name={icon as any} size={22} color={color ?? (danger ? '#EF4444' : colors.text)} />;

  const Row = onPress ? TouchableOpacity : View;

  return (
    <Row
      style={[sStyles.row, { backgroundColor: colors.card }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={[sStyles.rowIcon, { backgroundColor: (color ?? (danger ? '#EF4444' : colors.text)) + '18' }]}>
        {ic}
      </View>
      <View style={sStyles.rowContent}>
        <Text style={[sStyles.rowLabel, { color: danger ? '#EF4444' : colors.text }]}>{label}</Text>
        {sublabel && <Text style={[sStyles.rowSub, { color: colors.muted }]}>{sublabel}</Text>}
      </View>
      {right ?? (onPress && (
        <Icon name="chevron-forward" size={16} color={colors.muted} />
      ))}
    </Row>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Main
// ─────────────────────────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const { colors, isDarkMode, toggleTheme } = useTheme();

  // ── Preferences state ──────────────────────────────────────────────────────
  const [notifEnabled,  setNotifEnabled]  = useState(true);
  const [notifSound,    setNotifSound]    = useState(true);
  const [msgPreview,    setMsgPreview]    = useState(true);
  const [readReceipts,  setReadReceipts]  = useState(true);
  const [showOnline,    setShowOnline]    = useState(true);
  const [showLastSeen,  setShowLastSeen]  = useState(true);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [currentUser,   setCurrentUser]   = useState<User | null>(null);
  const [cacheSize,     setCacheSize]     = useState<number>(0);
  const [loggingOut,    setLoggingOut]    = useState(false);
  const [clearingCache, setClearingCache] = useState(false);

  useEffect(() => {
    loadPrefs();
    loadCurrentUser();
    estimateCacheSize();
  }, []);

  const loadPrefs = async () => {
    try {
      const [ne, ns, mp, rr, so, sl] = await Promise.all([
        AsyncStorage.getItem(PREF_NOTIF_ENABLED),
        AsyncStorage.getItem(PREF_NOTIF_SOUND),
        AsyncStorage.getItem(PREF_MSG_PREVIEW),
        AsyncStorage.getItem(PREF_READ_RECEIPTS),
        AsyncStorage.getItem(PREF_SHOW_ONLINE),
        AsyncStorage.getItem(PREF_SHOW_LAST_SEEN),
      ]);
      if (ne !== null) setNotifEnabled(ne === 'true');
      if (ns !== null) setNotifSound(ns === 'true');
      if (mp !== null) setMsgPreview(mp === 'true');
      if (rr !== null) setReadReceipts(rr === 'true');
      if (so !== null) setShowOnline(so === 'true');
      if (sl !== null) setShowLastSeen(sl === 'true');
    } catch (e) { /* silently ignore */ }
  };

  const savePref = async (key: string, value: boolean) => {
    await AsyncStorage.setItem(key, String(value));
  };

  const loadCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();
      if (data) setCurrentUser(data);
    } catch (e) { /* silently ignore */ }
  };

  const estimateCacheSize = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      let total  = 0;
      const chatKeys = keys.filter(k =>
        k.startsWith(CACHE_USERS_KEY.substring(0, 8)) ||
        k.startsWith(CACHE_CHATS_KEY.substring(0, 8)) ||
        k.startsWith(CACHE_MESSAGES_KEY)
      );
      const values = await AsyncStorage.multiGet(chatKeys);
      values.forEach(([, v]) => { if (v) total += v.length * 2; }); // ~2 bytes per char
      setCacheSize(total);
    } catch (e) { setCacheSize(0); }
  };

  const clearCache = async () => {
    Alert.alert(
      'Clear Chat Cache',
      'This removes locally cached messages and user lists. Your data is safe in the cloud and will re-download next time.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          onPress: async () => {
            setClearingCache(true);
            try {
              const keys = await AsyncStorage.getAllKeys();
              const toRemove = keys.filter(k =>
                k === CACHE_USERS_KEY ||
                k === CACHE_CHATS_KEY ||
                k.startsWith(CACHE_MESSAGES_KEY)
              );
              await AsyncStorage.multiRemove(toRemove);
              setCacheSize(0);
              Alert.alert('Done ✅', 'Cache cleared successfully.');
            } catch (e) {
              Alert.alert('Error', 'Could not clear cache.');
            }
            setClearingCache(false);
          },
        },
      ]
    );
  };

  // ── LOGOUT ─────────────────────────────────────────────────────────────────
  const handleLogout = useCallback(() => {
    Alert.alert(
      'Log out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log out',
          style: 'destructive',
          onPress: async () => {
            setLoggingOut(true);
            try {
              // 1. Mark user as offline
              const { data: { user } } = await supabase.auth.getUser();
              if (user) {
                await supabase
                  .from('users')
                  .update({ online: false, last_seen: new Date().toISOString() })
                  .eq('id', user.id);
              }
              // 2. Sign out from Supabase
              await supabase.auth.signOut();
              // 3. Clear auth-related local storage (keep vault/mood/notes)
              await AsyncStorage.multiRemove([
                CACHE_USERS_KEY,
                CACHE_CHATS_KEY,
              ]);
              // 4. Navigate to login
              router.replace('/');
            } catch (e) {
              Alert.alert('Error', 'Could not log out. Please try again.');
              console.error('[Settings] logout error:', e);
            }
            setLoggingOut(false);
          },
        },
      ]
    );
  }, []);

  // Toggle helpers
  const toggle = (setter: React.Dispatch<React.SetStateAction<boolean>>, key: string) =>
    (val: boolean) => { setter(val); savePref(key, val); };

  const PINK = '#FF6B9D';

  return (
    <SafeAreaView style={[sStyles.root, { backgroundColor: colors.background }]} edges={['top']}>

      {/* ── Header ── */}
      <View style={[sStyles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity style={sStyles.backBtn} onPress={() => router.back()}>
          <Icon name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[sStyles.headerTitle, { color: colors.text }]}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Profile ── */}
        <SectionHeader title="Profile" colors={colors} />

        <View style={[sStyles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {currentUser?.avatar_url ? (
            <Image source={{ uri: currentUser.avatar_url }} style={sStyles.profileAvatar} />
          ) : (
            <View style={[sStyles.profileAvatar, { backgroundColor: PINK + '33', alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ fontSize: 28, color: PINK, fontWeight: '800' }}>
                {currentUser?.username?.[0]?.toUpperCase() ?? '?'}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={[sStyles.profileName, { color: colors.text }]}>
              {currentUser?.username ?? 'Loading...'}
            </Text>
            <Text style={[sStyles.profileEmail, { color: colors.muted }]}>
              {currentUser?.email ?? ''}
            </Text>
          </View>
          <TouchableOpacity
            style={[sStyles.editProfileBtn, { borderColor: PINK }]}
            onPress={() => Alert.alert('Edit Profile', 'Profile editing coming soon!')}
          >
            <Icon name="pencil" size={16} color={PINK} />
          </TouchableOpacity>
        </View>

        {/* ── Notifications ── */}
        <SectionHeader title="Notifications" colors={colors} />

        <SettingRow
          icon="notifications-outline" label="Push Notifications"
          sublabel="Get notified about new messages"
          colors={colors} color={PINK}
          right={
            <Switch
              value={notifEnabled}
              onValueChange={toggle(setNotifEnabled, PREF_NOTIF_ENABLED)}
              trackColor={{ true: PINK, false: colors.border }}
              thumbColor="#fff"
            />
          }
        />
        <SettingRow
          icon="volume-medium-outline" label="Notification Sound"
          sublabel={notifEnabled ? 'Play sound on new message' : 'Enable notifications first'}
          colors={colors}
          right={
            <Switch
              value={notifSound && notifEnabled}
              onValueChange={toggle(setNotifSound, PREF_NOTIF_SOUND)}
              disabled={!notifEnabled}
              trackColor={{ true: PINK, false: colors.border }}
              thumbColor="#fff"
            />
          }
        />
        <SettingRow
          icon="chatbubble-ellipses-outline" label="Message Preview"
          sublabel="Show message content in notification"
          colors={colors}
          right={
            <Switch
              value={msgPreview}
              onValueChange={toggle(setMsgPreview, PREF_MSG_PREVIEW)}
              trackColor={{ true: PINK, false: colors.border }}
              thumbColor="#fff"
            />
          }
        />

        {/* ── Appearance ── */}
        <SectionHeader title="Appearance" colors={colors} />

        <SettingRow
          icon={isDarkMode ? 'sunny-outline' : 'moon-outline'}
          label={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          sublabel={isDarkMode ? 'Currently in dark mode' : 'Currently in light mode'}
          colors={colors}
          color={isDarkMode ? '#F59E0B' : '#3B82F6'}
          onPress={toggleTheme}
        />

        {/* ── Privacy ── */}
        <SectionHeader title="Privacy" colors={colors} />

        <SettingRow
          icon="eye-outline" label="Read Receipts"
          sublabel="Let others see when you've read their messages"
          colors={colors} color="#22C55E"
          right={
            <Switch
              value={readReceipts}
              onValueChange={toggle(setReadReceipts, PREF_READ_RECEIPTS)}
              trackColor={{ true: '#22C55E', false: colors.border }}
              thumbColor="#fff"
            />
          }
        />
        <SettingRow
          iconLib="mc" icon="circle-outline" label="Show Online Status"
          sublabel="Let people see when you're active"
          colors={colors} color="#22C55E"
          right={
            <Switch
              value={showOnline}
              onValueChange={toggle(setShowOnline, PREF_SHOW_ONLINE)}
              trackColor={{ true: '#22C55E', false: colors.border }}
              thumbColor="#fff"
            />
          }
        />
        <SettingRow
          icon="time-outline" label="Show Last Seen"
          sublabel="Let people see when you were last active"
          colors={colors}
          right={
            <Switch
              value={showLastSeen}
              onValueChange={toggle(setShowLastSeen, PREF_SHOW_LAST_SEEN)}
              trackColor={{ true: PINK, false: colors.border }}
              thumbColor="#fff"
            />
          }
        />

        {/* ── Data & Storage ── */}
        <SectionHeader title="Data & Storage" colors={colors} />

        <SettingRow
          iconLib="mc" icon="database-outline" label="Chat Cache"
          sublabel={cacheSize > 0 ? `${fmtBytes(cacheSize)} stored locally` : 'Cache is empty'}
          colors={colors} color="#A855F7"
          onPress={clearingCache ? undefined : clearCache}
          right={
            clearingCache
              ? <ActivityIndicator size="small" color={PINK} />
              : <View style={[sStyles.clearBtn, { backgroundColor: '#EF444422' }]}>
                  <Text style={[sStyles.clearBtnTxt, { color: '#EF4444' }]}>Clear</Text>
                </View>
          }
        />

        {/* ── About ── */}
        <SectionHeader title="About" colors={colors} />

        <SettingRow
          iconLib="mc" icon="information-outline" label="Version"
          sublabel={`Bubbles v${APP_VERSION}`}
          colors={colors} color="#3B82F6"
        />
        <SettingRow
          iconLib="mc" icon="heart-outline" label="Made with love"
          sublabel="Built for Alice Njeri 💕"
          colors={colors} color={PINK}
        />

        {/* ── Danger zone ── */}
        <SectionHeader title="Account" colors={colors} />

        <SettingRow
          icon="log-out-outline" label="Log out"
          sublabel="You'll need to sign in again"
          colors={colors}
          danger
          onPress={loggingOut ? undefined : handleLogout}
          right={
            loggingOut
              ? <ActivityIndicator size="small" color="#EF4444" />
              : <Icon name="chevron-forward" size={16} color="#EF4444" />
          }
        />

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const sStyles = StyleSheet.create({
  root: { flex: 1, paddingBottom: 100 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },

  sectionHeader: {
    fontSize: 11, fontWeight: '800', letterSpacing: 1.2,
    paddingHorizontal: 20, paddingTop: 22, paddingBottom: 8,
  },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    marginHorizontal: 16, marginBottom: 1,
    borderRadius: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  rowIcon: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  rowContent: { flex: 1, marginRight: 8 },
  rowLabel:   { fontSize: 15, fontWeight: '600' },
  rowSub:     { fontSize: 12, marginTop: 2 },

  profileCard: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, borderRadius: 18, padding: 16,
    borderWidth: 1, gap: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 3,
  },
  profileAvatar: { width: 60, height: 60, borderRadius: 30 },
  profileName:   { fontSize: 17, fontWeight: '800' },
  profileEmail:  { fontSize: 13, marginTop: 2 },
  editProfileBtn: {
    width: 36, height: 36, borderRadius: 18, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },

  clearBtn: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10,
  },
  clearBtnTxt: { fontSize: 13, fontWeight: '700' },
});
