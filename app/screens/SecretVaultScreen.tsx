// screens/SecretVaultScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet,
  Alert, Modal, Animated, ScrollView, KeyboardAvoidingView,
  Platform,  Dimensions,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import DeveloperInfoModal from './DeveloperInfoModal';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
const { width: W } = Dimensions.get('window');

// ─────────────────────────────────────────────────────────────────────────────
//  🔐 VAULT PASSWORD — change "munga" to whatever you want
// ─────────────────────────────────────────────────────────────────────────────
const VAULT_PASSWORD = 'munga';

// ─────────────────────────────────────────────────────────────────────────────
//  💌 SECRET MESSAGES FROM YOU — update these via OTA push
//     She has no idea these come from the code 🤫
//     Just update this array and push an OTA update (Expo EAS Update)
// ─────────────────────────────────────────────────────────────────────────────
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
  // ── ADD MORE MESSAGES HERE — they appear in her vault automatically ──────
   {
     id:       'from-me-002',
     title:    'Happy birthday my love 🎂',
     text:     'Today is your day...',
     date:     '2026-06-05T00:00:00.000Z',
     category: 'milestone',
     fromMe:   true,
     pinned:   false,
   },
];

// ─────────────────────────────────────────────────────────────────────────────

const PINK    = '#FF6B9D';
const ROSE    = '#FFE4ED';
const BG      = '#FFF5F7';
const WHITE   = '#FFFFFF';
const DARK    = '#2D1B25';
const MID     = '#9A7090';
const SOFT    = '#C4A0B8';

// ── Note categories ───────────────────────────────────────────────────────────
const CATEGORIES = [
  { key: 'love',      label: 'Love',      icon: 'heart',       color: '#EF4444', bg: '#FFF0F0' },
  { key: 'memory',    label: 'Memory',    icon: 'image',       color: '#F59E0B', bg: '#FFFBEB' },
  { key: 'milestone', label: 'Milestone', icon: 'star',        color: '#A855F7', bg: '#F5F0FF' },
  { key: 'promise',   label: 'Promise',   icon: 'ribbon',      color: '#3B82F6', bg: '#EFF6FF' },
  { key: 'thought',   label: 'Thought',   icon: 'bulb',        color: '#22C55E', bg: '#F0FDF4' },
  { key: 'secret',    label: 'Secret',    icon: 'lock-closed', color: '#EC4899', bg: '#FDF2F8' },
] as const;

type CategoryKey = typeof CATEGORIES[number]['key'];

function getCat(key?: string) {
  return CATEGORIES.find(c => c.key === key) ?? CATEGORIES[5];
}

interface SecretNote {
  id:        string;
  title:     string;
  text:      string;
  date:      string;
  category?: CategoryKey;
  fromMe?:   boolean;   // messages pushed by you via OTA
  pinned?:   boolean;
}

// ── Dot-pin display ───────────────────────────────────────────────────────────
function PinDots({ count, filled }: { count: number; filled: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[
            dotStyles.dot,
            i < filled ? dotStyles.dotFilled : dotStyles.dotEmpty,
          ]}
        />
      ))}
    </View>
  );
}
const dotStyles = StyleSheet.create({
  dot:       { width: 16, height: 16, borderRadius: 8 },
  dotFilled: { backgroundColor: PINK },
  dotEmpty:  { backgroundColor: '#F3D6E8', borderWidth: 2, borderColor: PINK },
});

// ── Animated card ─────────────────────────────────────────────────────────────
function NoteCard({
  item, index, onPress, onLongPress,
}: {
  item: SecretNote; index: number;
  onPress: () => void; onLongPress: () => void;
}) {
  const opacity   = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 380, delay: Math.min(index * 60, 500), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 380, delay: Math.min(index * 60, 500), useNativeDriver: true }),
    ]).start();
  }, []);

  const cat = getCat(item.category);

  return (
   <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      <TouchableOpacity
        style={[styles.noteCard, { borderLeftColor: cat.color }]}
        onPress={onPress}
        onLongPress={onLongPress}
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
            {item.fromMe && (
              <View style={styles.fromMeBadge}>
                <Icon name="heart" size={10} color={WHITE} />
                <Text style={styles.fromMeTxt}>from me</Text>
              </View>
            )}
          </View>
        </View>

        {/* Title */}
        <Text style={styles.noteTitle} numberOfLines={1}>{item.title}</Text>

        {/* Preview */}
        <Text style={styles.notePreview} numberOfLines={2}>{item.text}</Text>

        {/* Date */}
        <Text style={styles.noteDate}>
          {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
export default function SecretVaultScreen() {
 const [modalVisible, setModalVisible] = useState(false);

  // ── YOUR ORIGINAL STATE ───────────────────────────────────────────────────
  const [isUnlocked,      setIsUnlocked]      = useState(false);
  const [pin,             setPin]             = useState('');
  const [secretMessages,  setSecretMessages]  = useState<SecretNote[]>([]);
  const [newMessage,      setNewMessage]      = useState('');
  const [showAddModal,    setShowAddModal]     = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
 

 // ── NEW STATE ─────────────────────────────────────────────────────────────
  const [filterCat,       setFilterCat]       = useState<string>('all');
  const [viewingNote,     setViewingNote]     = useState<SecretNote | null>(null);
  const [newTitle,        setNewTitle]        = useState('');
  const [newCategory,     setNewCategory]     = useState<CategoryKey>('secret');
  const [pinError,        setPinError]        = useState(false);
  const [attempts,        setAttempts]        = useState(0);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const lockScale = useRef(new Animated.Value(0.8)).current;
  const lockOpacity = useRef(new Animated.Value(0)).current;

  // ── YOUR ORIGINAL useEffect ───────────────────────────────────────────────
  useEffect(() => {
    if (isUnlocked) loadSecretMessages();
  }, [isUnlocked]);
   
  useEffect(() => {
    // Lock screen entrance animation
    Animated.parallel([
      Animated.spring(lockScale,   { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }),
      Animated.timing(lockOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  // ── YOUR ORIGINAL verifyPin — now uses hardcoded VAULT_PASSWORD ──────────
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
      // Shake animation
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
    }
  };

  // ── YOUR ORIGINAL loadSecretMessages — merges OTA messages from you ──────
  const loadSecretMessages = async () => {
    const saved = await SecureStore.getItemAsync('secretMessages');
    const userNotes: SecretNote[] = saved ? JSON.parse(saved) : [];

    // Merge OTA messages — deduplicated by id so re-installs don't duplicate
    const userIds = new Set(userNotes.map(n => n.id));
    const newOTA  = MESSAGES_FROM_ME.filter(m => !userIds.has(m.id));
    const merged  = [...MESSAGES_FROM_ME, ...userNotes.filter(n => !n.fromMe)];

    // Save any new OTA messages into secure store so they persist
    if (newOTA.length > 0) {
      const all = [...userNotes, ...newOTA];
      await SecureStore.setItemAsync('secretMessages', JSON.stringify(all));
    }

    setSecretMessages(merged);
  };

  // ── YOUR ORIGINAL addSecretMessage — extended with title + category ───────
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

    // Persist only user-written notes (not OTA ones — those come from code)
    const userNotes = secretMessages.filter(n => !n.fromMe);
    const updatedUser = [note, ...userNotes];
    await SecureStore.setItemAsync('secretMessages', JSON.stringify(updatedUser));

    // Re-merge with OTA for display
    setSecretMessages([...MESSAGES_FROM_ME, ...updatedUser]);
    setNewMessage('');
    setNewTitle('');
    setNewCategory('secret');
    setShowAddModal(false);
  };

  const deleteNote = (id: string) => {
    Alert.alert('Delete Note', 'Are you sure? This can\'t be undone 💔', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          const userNotes    = secretMessages.filter(n => !n.fromMe && n.id !== id);
          const otaNotes     = secretMessages.filter(n => n.fromMe);
          const updatedUser  = secretMessages.filter(n => !n.fromMe && n.id !== id);
          await SecureStore.setItemAsync('secretMessages', JSON.stringify(updatedUser));
          setSecretMessages([...otaNotes, ...updatedUser]);
          setViewingNote(null);
        },
      },
    ]);
  };

  const lockVault = () => {
    Alert.alert('Lock Vault', 'Lock the secret vault?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Lock', onPress: () => { setIsUnlocked(false); setFilterCat('all'); } },
    ]);
  };

  // Filtered + sorted notes: pinned first, then by date
  const displayed = secretMessages
    .filter(n => filterCat === 'all' || n.category === filterCat)
    .sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

  const fromMeCount   = secretMessages.filter(n => n.fromMe).length;
  const userNoteCount = secretMessages.filter(n => !n.fromMe).length;

  // ────────────────────────────────────────────────────────────────────────
  //  LOCKED SCREEN
  // ────────────────────────────────────────────────────────────────────────
  if (!isUnlocked) {
    return (
      <View style={styles.lockedBg}>
        <Animated.View style={[
          styles.lockedCard,
          { opacity: lockOpacity, transform: [{ scale: lockScale }, { translateX: shakeAnim }] },
        ]}>
          {/* Icon */}
          <View style={styles.lockIconWrap}>
            <Icon name="lock-closed" size={36} color={PINK} />
          </View>

          <Text style={styles.lockedTitle}>Secret Vault</Text>
          <Text style={styles.lockedSub}>Your private space 💕</Text>

          {/* Password input — text, not just digits */}
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
        </Animated.View>
      </View>
    );
  }

  // ────────────────────────────────────────────────────────────────────────
  //  UNLOCKED SCREEN
  // ────────────────────────────────────────────────────────────────────────
  return (
<SafeAreaView style={styles.container} edges={['top']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Secret Vault</Text>
          <Text style={styles.headerSub}>{secretMessages.length} private notes</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => setShowAddModal(true)}>
            <Icon name="add" size={22} color={PINK} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={lockVault}>
            <Icon name="lock-closed" size={18} color={PINK} />
          </TouchableOpacity>
      <TouchableOpacity
      style={styles.iconBtn}   
      onPress={() => setModalVisible(true)}>
      <Icon name="cog" size={18} color={PINK} />
      </TouchableOpacity>
      <DeveloperInfoModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
      />
        </View>
      </View>

      {/* ── Stats banner ── */}
      <View style={styles.statsBanner}>
        <View style={styles.statItem}>
          <Icon name="heart" size={16} color={PINK} />
          <Text style={styles.statVal}>{fromMeCount}</Text>
          <Text style={styles.statLbl}>from him</Text>
        </View>
        <View style={styles.statDivider} />
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

      {/* ── Category filter tabs ── */}
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
          >
            <Icon name={c.icon as any} size={12} color={filterCat === c.key ? WHITE : c.color} />
            <Text style={[styles.catTabTxt, filterCat === c.key && styles.catTabTxtActive]}>{c.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ── Notes list ── */}
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
            />
          )}
        />
      )}

      {/* ── Add note modal — YOUR ORIGINAL structure + title + category ── */}
      <Modal visible={showAddModal} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalBg}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.modalTitle}>Add Secret Note</Text>

            {/* Title */}
            <TextInput
              style={styles.titleInput}
              placeholder="Title (optional)"
              placeholderTextColor={SOFT}
              value={newTitle}
              onChangeText={setNewTitle}
              maxLength={60}
            />

            {/* YOUR ORIGINAL secret text input */}
            <TextInput
              style={styles.secretInput}
              placeholder="Something only we know..."
              placeholderTextColor={SOFT}
              value={newMessage}
              onChangeText={setNewMessage}
              multiline
              maxLength={600}
            />

            {/* Category selector */}
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

            {/* YOUR ORIGINAL buttons */}
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

      {/* ── Full-screen note viewer ── */}
      <Modal visible={!!viewingNote} transparent animationType="fade">
        <View style={styles.viewerBg}>
          <SafeAreaView style={{ flex: 1 }}>
            {viewingNote && (() => {
              const cat = getCat(viewingNote.category);
              return (
                <View style={styles.viewerCard}>
                  {/* Header */}
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

                  {/* fromMe badge */}
                  {viewingNote.fromMe && (
                    <View style={styles.fromMeFullBadge}>
                      <Icon name="heart" size={14} color={WHITE} />
                      <Text style={styles.fromMeFullTxt}>A message from him 💕</Text>
                    </View>
                  )}


                  {/* Content */}
                  <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                    <Text style={styles.viewerTitle}>{viewingNote.title}</Text>
                    <Text style={styles.viewerDate}>
                      {new Date(viewingNote.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                    </Text>
                    <Text style={styles.viewerText}>{viewingNote.text}</Text>
                  </ScrollView>


                </View>
              );
            })()}
          </SafeAreaView>
        </View>
      </Modal>

<InfoModalContent
        visible={showInfoModal}
        onClose={() => setShowInfoModal(false)}
      />

    </SafeAreaView>
  );
}

function InfoModalContent({ visible, onClose }) {
  const technologies = [
    { name: 'React Native', icon: 'logo-react', color: '#61DAFB', desc: 'Core framework' },
    { name: 'Expo', icon: 'rocket', color: '#4630EB', desc: 'Build & deployment' },
    { name: 'TypeScript', icon: 'code-slash', color: '#3178C6', desc: 'Type safety' },
    { name: 'Supabase', icon: 'server', color: '#3ECF8E', desc: 'Backup & storage' },
    { name: 'SecureStore', icon: 'lock-closed', color: '#FF6B9D', desc: 'PIN protection' },
  ];

  const features = [
    '❤️ Daily mood tracking with emojis',
    '📝 Private love notes section',
    '📸 Shared memories gallery',
    '🔒 Secret vault with PIN protection',
    '🎵 Daily affirmations & quotes',
    '💌 Push notifications from me',
    '☁️ Cloud backup (your memories are safe)',
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={infoStyles.overlay}>
        <View style={infoStyles.modalContainer}>
          {/* Header */}
          <View style={infoStyles.header}>
            <Text style={infoStyles.headerTitle}>✨ Developer Info</Text>
            <TouchableOpacity onPress={onClose} style={infoStyles.closeButton}>
              <Icon name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Heart Icon */}
            <View style={infoStyles.heartContainer}>
              <Icon name="heart" size={50} color={PINK} />
            </View>

            {/* Main Message */}
            <View style={infoStyles.messageBox}>
              <Text style={infoStyles.messageTitle}>Made with 💕 for You</Text>
              <Text style={infoStyles.messageText}>
                Every line of code in this app was written with you in mind.
                From the mood tracker to our secret vault, everything is designed
                to remind you how much you're loved.
              </Text>
            </View>

            {/* Developer Info */}
            <View style={infoStyles.section}>
              <Text style={infoStyles.sectionTitle}>👨‍💻 Created by</Text>
              <Text style={infoStyles.devName}>Your Man</Text>
              <Text style={infoStyles.devMessage}>
                "You inspire me to learn, create, and love harder every day.
                This app is my digital love letter to you."
              </Text>
            </View>

            {/* Technologies Used */}
            <View style={infoStyles.section}>
              <Text style={infoStyles.sectionTitle}>🛠️ Built With</Text>
              <View style={infoStyles.techGrid}>
                {technologies.map((tech, index) => (
                  <View key={index} style={infoStyles.techCard}>
                    <Icon name={tech.icon} size={28} color={tech.color} />
                    <Text style={infoStyles.techName}>{tech.name}</Text>
                    <Text style={infoStyles.techDesc}>{tech.desc}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Features List */}
            <View style={infoStyles.section}>
              <Text style={infoStyles.sectionTitle}>✨ Features</Text>
              {features.map((feature, index) => (
                <View key={index} style={infoStyles.featureItem}>
                  <Text style={infoStyles.featureText}>{feature}</Text>
                </View>
              ))}
            </View>

            {/* Version Info */}
            <View style={infoStyles.versionBox}>
              <Text style={infoStyles.versionText}>Version 1.0.0</Text>
              <Text style={infoStyles.versionDate}>Released with love • June 2024</Text>
              <Text style={infoStyles.versionDate}>For my special girl 💕</Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // Lock screen
  lockedBg:         { flex: 1, backgroundColor: BG, justifyContent: 'center', alignItems: 'center' },
  lockedCard:       { width: W * 0.88, backgroundColor: WHITE, borderRadius: 28, padding: 32, alignItems: 'center', elevation: 6, shadowColor: PINK, shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } },
  lockIconWrap:     { width: 72, height: 72, borderRadius: 36, backgroundColor: ROSE, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  lockedTitle:      { fontSize: 24, fontWeight: '800', color: DARK, letterSpacing: -0.4 },
  lockedSub:        { fontSize: 14, color: MID, marginTop: 4, marginBottom: 20 },
  pinInput:         { borderWidth: 2, borderColor: '#F3D6E8', borderRadius: 16, padding: 14, width: '100%', textAlign: 'center', fontSize: 18, color: DARK, letterSpacing: 2, marginBottom: 6 },
  pinInputError:    { borderColor: '#EF4444' },
  pinErrorTxt:      { color: '#EF4444', fontSize: 13, marginBottom: 12 },
  unlockButton:     { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: PINK, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 26, marginTop: 10, elevation: 3, shadowColor: PINK, shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  unlockText:       { color: WHITE, fontSize: 17, fontWeight: '700' },

  // Header
  header:           { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 },
  headerTitle:      { fontSize: 22, fontWeight: '800', color: DARK, letterSpacing: -0.4 },
  headerSub:        { fontSize: 12, color: MID, marginTop: 2 },
  headerActions:    { flexDirection: 'row', gap: 8 },
  iconBtn:          { width: 38, height: 38, borderRadius: 19, backgroundColor: WHITE, justifyContent: 'center', alignItems: 'center', elevation: 2, shadowColor: PINK, shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },

  // Stats banner
  statsBanner:      { flexDirection: 'row', marginHorizontal: 20, marginBottom: 10, backgroundColor: WHITE, borderRadius: 18, padding: 14, alignItems: 'center', justifyContent: 'space-around', elevation: 1 },
  statItem:         { alignItems: 'center', gap: 3 },
  statVal:          { fontSize: 18, fontWeight: '800', color: DARK },
  statLbl:          { fontSize: 10, color: MID, fontWeight: '600' },
  statDivider:      { width: 1, height: 32, backgroundColor: '#F3E8EF' },

  // Category filter tabs
  catTabsScroll:    { flexGrow: 0, marginBottom: 4 },
  catTabsContent:   { paddingHorizontal: 16, gap: 8, paddingVertical: 6 },
  catTab:           { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: WHITE, borderWidth: 1.5, borderColor: '#EDD8E8' },
  catTabActive:     { backgroundColor: PINK, borderColor: PINK },
  catTabTxt:        { fontSize: 12, fontWeight: '600', color: MID },
  catTabTxtActive:  { color: WHITE },

  // Empty state
  emptyState:       { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  emptyTitle:       { fontSize: 18, fontWeight: '700', color: DARK },
  emptySub:         { fontSize: 14, color: MID },

  // Note card
  noteCard:         { backgroundColor: WHITE, borderRadius: 18, padding: 16, marginBottom: 12, borderLeftWidth: 4, elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  noteCardTop:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  noteCardIcons:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  catBadge:         { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 10 },
  catBadgeTxt:      { fontSize: 11, fontWeight: '700' },
  fromMeBadge:      { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: PINK, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  fromMeTxt:        { color: WHITE, fontSize: 10, fontWeight: '700' },
  noteTitle:        { fontSize: 15, fontWeight: '800', color: DARK, marginBottom: 5 },
  notePreview:      { fontSize: 13, color: MID, lineHeight: 19, marginBottom: 8 },
  noteDate:         { fontSize: 11, color: SOFT },

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
  viewerBg:         { flex: 1, backgroundColor: BG },
  viewerCard:       { flex: 1, padding: 20 },
  viewerHeader:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  viewerBack:       { width: 36, height: 36, borderRadius: 18, backgroundColor: WHITE, justifyContent: 'center', alignItems: 'center', elevation: 1 },
  viewerDelete:     { marginLeft: 'auto', width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFF0F0', justifyContent: 'center', alignItems: 'center' },
  fromMeFullBadge:  { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: PINK, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, alignSelf: 'flex-start', marginBottom: 16 },
  fromMeFullTxt:    { color: WHITE, fontWeight: '700', fontSize: 13 },
  viewerTitle:      { fontSize: 24, fontWeight: '800', color: DARK, marginBottom: 6, lineHeight: 30 },
  viewerDate:       { fontSize: 13, color: SOFT, marginBottom: 18 },
  viewerText:       { fontSize: 16, color: DARK, lineHeight: 26 },
});
// Info Modal styles
const infoStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#FFF5F7',
    borderRadius: 25,
    width: '90%',
    maxHeight: '85%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    padding: 5,
  },
  heartContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  messageBox: {
    backgroundColor: '#FFE4E9',
    padding: 20,
    margin: 15,
    borderRadius: 20,
  },
  messageTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: PINK,
    marginBottom: 10,
    textAlign: 'center',
  },
  messageText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    textAlign: 'center',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  devName: {
    fontSize: 20,
    fontWeight: '600',
    color: PINK,
    marginBottom: 8,
  },
  devMessage: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    lineHeight: 20,
  },
  techGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  techCard: {
    width: '31%',
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  techName: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 8,
    color: '#333',
    textAlign: 'center',
  },
  techDesc: {
    fontSize: 9,
    color: '#888',
    textAlign: 'center',
    marginTop: 2,
  },
  featureItem: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  featureText: {
    fontSize: 14,
    color: '#555',
  },
  versionBox: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    padding: 20,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 30,
  },
  versionText: {
    fontSize: 12,
    color: '#888',
    marginBottom: 5,
  },
  versionDate: {
    fontSize: 11,
    color: '#aaa',
    marginBottom: 3,
  },
});
