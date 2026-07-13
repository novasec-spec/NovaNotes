// index.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Platform,
  TouchableOpacity,
  StyleSheet,
  Animated,
  RefreshControl,
  Share,
  Alert,
  ActivityIndicator,
  ScrollView,
  Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../../contexts/ThemeContext';
import { useNotes } from './hooks';
import { syncManager } from './services';
import { 
  NoteCard, 
  NoteEditor, 
  NoteReadView, 
  ReminderModal,
} from './components';
import { 
  PINK, 
  WHITE, 
  TEXT_SOFT, 
  STORAGE_KEYS, 
} from './utils/constants';
import { timeAgo, searchNotes } from './utils/helpers';
import { Note } from './types';
import { useAuth } from '../../../contexts/AuthContext';
import { useNotification } from '../../../contexts/NotificationContext';
import { useLocalSearchParams } from 'expo-router';


export default function NotesScreen() {
const { noteId } = useLocalSearchParams();
  const { colors, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const { sendNotification } = useNotification();
  const { user } = useAuth();
  const userEmail = user?.email || null;
  const { 
    notes, 
    folders,
    stats,
    streak,
    loading, 
    dirty,
    addNote, 
    updateNote, 
    deleteNote, 
    togglePin, 
    toggleFav, 
    toggleArchive, 
    setNotes,
    saveCurrentNotes,
    quickAction,
    addLocationToNote,
    addWeatherToNote,
    applyTemplate,
    createBackup,
    restoreBackup,
    exportNotes,
    importNotes,
    setNoteReminder,
    getReminderStats,
    reminderStats,        
  } = useNotes();
 
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [sortMode, setSortMode] = useState<'newest' | 'oldest' | 'pinned'>('newest');
  const [viewMode, setViewMode] = useState<'active' | 'archived'>('active');
  const [showEditor, setShowEditor] = useState(false);
  const [editingNote, setEditingNote] = useState<any | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [readingNote, setReadingNote] = useState<any | null>(null);
  const [reminderNote, setReminderNote] = useState<any | null>(null);
  const [undoNote, setUndoNote] = useState<{ note: Note; timeout: ReturnType<typeof setTimeout> } | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [showFolders, setShowFolders] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [reminderModalVisible, setReminderModalVisible] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  const headerAnim = useRef(new Animated.Value(0)).current;
  const searchH = useRef(new Animated.Value(0)).current;
  const undoAnim = useRef(new Animated.Value(80)).current;

  useEffect(() => {
    syncManager.setUserEmail(userEmail);
    if (userEmail) {
      syncManager.run(notes, setNotes).catch(() => {});
    }
  }, [userEmail]);

  useEffect(() => {
    Animated.timing(headerAnim, { toValue: 1, duration: 550, useNativeDriver: true }).start();
    setupNotifications();
  }, []);

  useEffect(() => {
    Animated.timing(searchH, {
      toValue: showSearch ? 52 : 0, duration: 240, useNativeDriver: false,
    }).start();
  }, [showSearch]);

  useEffect(() => {
    Animated.timing(undoAnim, {
      toValue: undoNote ? 0 : 80, duration: 220, useNativeDriver: true,
    }).start();
  }, [undoNote]);

  async function setupNotifications() {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('love', {
        name: 'Love Notifications',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: PINK,
      });
      await Notifications.setNotificationChannelAsync('reminder', {
        name: 'Reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }

  const handleRecurringReminder = useCallback(async (reminder: any) => {
    if (!reminderNote) return;
    setReminderNote(null);
    Alert.alert('✅ Recurring reminder set!', `You'll be reminded ${reminder.frequency} at ${reminder.time}.`);
  }, [reminderNote]);

  const handleExport = async () => {
    try {
      const json = await exportNotes();
      await Share.share({ message: json, title: 'Notes Export' });
    } catch (error) {
      Alert.alert('Export failed', 'Could not export notes.');
    }
  };

  // ─── ✅ FIXED: HANDLE SET REMINDER ──────────────────

  const handleSetReminder = async (minutes: number, noteId: string) => {
    console.log(`⏰ Setting reminder: ${minutes} minutes for note: ${noteId}`);
    
    // Find the note
    const note = notes.find(n => n.id === noteId);
    if (!note) {
      console.error('❌ Note not found:', noteId);
      Alert.alert('Error', 'Note not found');
      return;
    }

    const reminder = await setNoteReminder(noteId, minutes);

    if (reminder) {
      Alert.alert(
        '⏰ Reminder Set!',
        `You'll be reminded about "${note.title || 'Note'}" in ${minutes} minutes`
      );
      setReminderModalVisible(false);
    } else {
      Alert.alert('Error', 'Failed to set reminder');
    }
  };

  // ─── OPEN REMINDER MODAL ────────────────────────────

  const openReminderModal = (note: any) => {
    setSelectedNote(note);
    setReminderModalVisible(true);
  };

  const handleBackup = async () => {
    try {
      const backup = await createBackup();
      await Share.share({ message: backup, title: 'Notes Backup' });
      Alert.alert('✅ Backup created', 'Your backup has been shared.');
    } catch (error) {
      Alert.alert('Backup failed', 'Could not create backup.');
    }
  };

  const handleAddNote = async (data: any) => {
    if (editingId) {
      await updateNote(editingId, data);
      setEditingId(null);
    } else {
      await addNote(data);
    }
    setShowEditor(false);
    setEditingNote(null);
    syncManager.run(notes, setNotes).catch(() => {});
  };

  const handleDelete = (id: string) => {
    const target = notes.find(n => n.id === id);
    if (!target) return;

    deleteNote(id);

    if (undoNote?.timeout) clearTimeout(undoNote.timeout);

    const timeout = setTimeout(() => {
      syncManager.deleteFromCloud(id).catch(() => {});
      setUndoNote(null);
    }, 5000);

    setUndoNote({ note: target, timeout });
  };

  const undoDelete = () => {
    if (!undoNote) return;
    clearTimeout(undoNote.timeout);
    const updated = [undoNote.note, ...notes];
    setNotes(updated);
    AsyncStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(updated));
    setUndoNote(null);
  };

  const openEdit = (item: any) => {
    setEditingId(item.id);
    setEditingNote(item);
    setShowEditor(true);
  };

  const openNew = () => {
    setEditingId(null);
    setEditingNote(null);
    setShowEditor(true);
  };

  const shareNote = async (note: any) => {
    try {
      const parts = [note.title, note.text].filter(Boolean);
      await Share.share({ message: parts.join('\n\n') });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const getFilteredNotes = () => {
    let filtered = notes.filter(n => viewMode === 'archived' ? !!n.archived : !n.archived);
    
    if (selectedFolder) {
      filtered = filtered.filter(n => n.folderId === selectedFolder);
    }
    
    if (search.trim()) {
      filtered = searchNotes(filtered, search);
    }
    
    filtered = filtered.sort((a, b) => {
      if (sortMode === 'pinned') return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
      if (sortMode === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    
    return filtered;
  };

  const filtered = getFilteredNotes();
  const activeNotes = notes.filter(n => !n.archived);
  const favCount = activeNotes.filter(n => n.fav).length;

  const badge = { icon: 'cloud-outline', color: TEXT_SOFT, label: 'Backed up locally' };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PINK} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Loading your memories...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: 10 }]}>
      {/* Header */}
      <Animated.View style={[
        styles.header,
        {
          opacity: headerAnim,
          transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-18, 0] }) }],
        },
      ]}>
        <View style={{ flex: 1 }}>
          <View style={styles.headerTitleRow}>
            <Icon name="document-text" size={22} color={PINK} />
            <Text style={[styles.headerTitle, { color: colors.text }]}>My Notes</Text>
            {dirty && <View style={styles.dirtyIndicator}><Text style={styles.dirtyText}>●</Text></View>}
          </View>
          <Text style={[styles.headerSub, { color: colors.text }]}>
            {activeNotes.length} note{activeNotes.length !== 1 ? 's' : ''}
            {favCount > 0 ? `  •  ${favCount} ❤️` : ''}
            {streak?.currentStreak > 0 ? `  •  🔥 ${streak.currentStreak} day streak` : ''}
          </Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity style={[styles.headerIconBtn, { backgroundColor: colors.card }]} onPress={() => setShowStats(true)}>
            <Icon name="stats-chart-outline" size={18} color={PINK} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.headerIconBtn, { backgroundColor: colors.card }]} onPress={() => setShowFolders(true)}>
            <Icon name="folder-outline" size={18} color={PINK} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.headerIconBtn, { backgroundColor: colors.card }]} onPress={() => setViewMode(v => v === 'active' ? 'archived' : 'active')}>
            <Icon name={viewMode === 'archived' ? 'archive' : 'archive-outline'} size={18} color={PINK} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.headerIconBtn, { backgroundColor: colors.card }]} onPress={() => setSortMode(m => m === 'newest' ? 'oldest' : m === 'oldest' ? 'pinned' : 'newest')}>
            <Icon name={sortMode === 'newest' ? 'arrow-down' : sortMode === 'oldest' ? 'arrow-up' : 'pin'} size={18} color={PINK} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.headerIconBtn, { backgroundColor: colors.card }]} onPress={() => setShowSearch(s => !s)}>
            <Icon name={showSearch ? 'close' : 'search'} size={19} color={PINK} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Sync status bar */}
      <TouchableOpacity style={styles.syncBar} onPress={() => {
        Alert.alert('Backup Options', 'Choose an action:', [
          { text: 'Sync Now', onPress: () => syncManager.run(notes, setNotes) },
          { text: 'Export Notes', onPress: handleExport },
          { text: 'Create Backup', onPress: handleBackup },
          { text: 'Cancel', style: 'cancel' },
        ]);
      }} activeOpacity={0.7}>
        <Icon name={badge.icon} size={13} color={badge.color} />
        <Text style={[styles.syncBarText, { color: badge.color }]}>{badge.label}</Text>
      </TouchableOpacity>

      {/* Search Bar */}
      <Animated.View style={[styles.searchWrapper, { height: searchH, overflow: 'hidden' }]}>
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Icon name="search" size={15} color={TEXT_SOFT} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search notes..."
            placeholderTextColor={TEXT_SOFT}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Icon name="close-circle" size={16} color={TEXT_SOFT} />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      {/* Notes List */}
      {filtered.length === 0 ? (
        <View style={styles.emptyState}>
          <MCIcon name={viewMode === 'archived' ? 'archive-outline' : 'notebook-heart-outline'} size={56} color={TEXT_SOFT} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {viewMode === 'archived' ? 'No archived notes' : 'No notes yet'}
          </Text>
          <Text style={[styles.emptySub, { color: colors.text }]}>
            {viewMode === 'archived' ? 'Archived notes will appear here' : 'Tap + to write your first sweet thought'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={false} onRefresh={() => syncManager.run(notes, setNotes)} tintColor={PINK} />}
          renderItem={({ item, index }) => (
            <NoteCard
              item={item}
              index={index}
              onEdit={openEdit}
              onDelete={handleDelete}
              onPin={togglePin}
              onFav={toggleFav}
              onArchive={toggleArchive}
              onReminder={(n: any) => openReminderModal(n)}
              onRead={(n: any) => setReadingNote(n)}
              onShare={shareNote}
              onQuickAction={quickAction}
              colors={colors}
            />
          )}
        />
      )}

      {/* FAB */}
      <TouchableOpacity style={[styles.fab, { bottom: insets.bottom + 63 }]} onPress={openNew} activeOpacity={0.85}>
        <Icon name="add" size={30} color={WHITE} />
      </TouchableOpacity>

      {/* Modals */}
      <NoteEditor
        visible={showEditor}
        initial={editingNote}
        onSave={handleAddNote}
        onClose={() => { setShowEditor(false); setEditingNote(null); setEditingId(null); }}
        onAddLocation={addLocationToNote}
        onAddWeather={addWeatherToNote}
        onApplyTemplate={applyTemplate}
        colors={colors}
      />

      {readingNote && (
        <NoteReadView
          note={readingNote}
          onClose={() => setReadingNote(null)}
          onEdit={() => { openEdit(readingNote); setReadingNote(null); }}
          onShare={() => shareNote(readingNote)}
          colors={colors}
        />
      )}

      {/* ✅ FIXED: ReminderModal with noteId */}
      <ReminderModal
        visible={reminderModalVisible}
        note={selectedNote}
        noteId={selectedNote?.id}
        onSchedule={handleSetReminder}
        onRecurringSchedule={handleRecurringReminder}
        onClose={() => setReminderModalVisible(false)}
        colors={colors}
      />

      {/* Stats Modal */}
      <Modal visible={showStats} transparent animationType="slide">
        <View style={styles.statsOverlay}>
          <View style={[styles.statsSheet, { backgroundColor: colors.card }]}>
            <View style={styles.statsHeader}>
              <Text style={[styles.statsTitle, { color: colors.text }]}>📊 Your Notes</Text>
              <TouchableOpacity onPress={() => setShowStats(false)}>
                <Icon name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.statsGrid}>
                <View style={[styles.statItem, { backgroundColor: colors.background }]}>
                  <Text style={[styles.statNumber, { color: PINK }]}>{stats?.totalNotes || 0}</Text>
                  <Text style={[styles.statLabel, { color: colors.text }]}>Total Notes</Text>
                </View>
                <View style={[styles.statItem, { backgroundColor: colors.background }]}>
                  <Text style={[styles.statNumber, { color: PINK }]}>{stats?.totalWords || 0}</Text>
                  <Text style={[styles.statLabel, { color: colors.text }]}>Total Words</Text>
                </View>
                <View style={[styles.statItem, { backgroundColor: colors.background }]}>
                  <Text style={[styles.statNumber, { color: PINK }]}>{streak?.currentStreak || 0}</Text>
                  <Text style={[styles.statLabel, { color: colors.text }]}>🔥 Day Streak</Text>
                </View>
                <View style={[styles.statItem, { backgroundColor: colors.background }]}>
                  <Text style={[styles.statNumber, { color: PINK }]}>{stats?.avgNotesPerDay.toFixed(1) || 0}</Text>
                  <Text style={[styles.statLabel, { color: colors.text }]}>Avg per Day</Text>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Folders Modal */}
      <Modal visible={showFolders} transparent animationType="slide">
        <View style={styles.foldersOverlay}>
          <View style={[styles.foldersSheet, { backgroundColor: colors.card }]}>
            <View style={styles.foldersHeader}>
              <Text style={[styles.foldersTitle, { color: colors.text }]}>📁 Folders</Text>
              <TouchableOpacity onPress={() => setShowFolders(false)}>
                <Icon name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              <TouchableOpacity style={[styles.folderItem, { borderColor: colors.border, backgroundColor: selectedFolder === null ? PINK + '18' : 'transparent' }]} onPress={() => setSelectedFolder(null)}>
                <Icon name="folder-open-outline" size={24} color={selectedFolder === null ? PINK : colors.text} />
                <Text style={[styles.folderName, { color: selectedFolder === null ? PINK : colors.text }]}>All Notes</Text>
                <Text style={[styles.folderCount, { color: colors.text }]}>{notes.length}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, paddingTop: 8, paddingBottom: 10 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 28, fontWeight: '800' },
  headerSub: { fontSize: 13, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerIconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  dirtyIndicator: { width: 10, height: 10 },
  dirtyText: { fontSize: 12, color: '#22C55E' },
  syncBar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 22, paddingBottom: 10 },
  syncBarText: { fontSize: 11, fontWeight: '600' },
  searchWrapper: { paddingHorizontal: 20, marginBottom: 4 },
  searchBar: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, paddingHorizontal: 14, height: 46, borderWidth: 1.5, gap: 8 },
  searchInput: { flex: 1, fontSize: 14 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 16, textAlign: 'center', paddingHorizontal: 40 },
  list: { paddingHorizontal: 16, paddingBottom: 120 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 100 },
  emptyTitle: { fontSize: 18, fontWeight: '800', marginTop: 14, marginBottom: 6 },
  emptySub: { fontSize: 14 },
  fab: { position: 'absolute', right: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: PINK, alignItems: 'center', justifyContent: 'center', shadowColor: PINK, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.40, shadowRadius: 14, elevation: 10 },
  undoSnackbar: { position: 'absolute', left: 20, right: 20, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 8 },
  undoText: { flex: 1, fontSize: 13, fontWeight: '600' },
  undoAction: { fontSize: 13, fontWeight: '800', color: PINK },
  statsOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  statsSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: '80%' },
  statsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  statsTitle: { fontSize: 20, fontWeight: '800' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  statItem: { flex: 1, minWidth: '45%', padding: 16, borderRadius: 12, alignItems: 'center' },
  statNumber: { fontSize: 24, fontWeight: '800' },
  statLabel: { fontSize: 12, fontWeight: '600', marginTop: 4 },
  foldersOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  foldersSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: '70%' },
  foldersHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  foldersTitle: { fontSize: 20, fontWeight: '800' },
  folderItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  folderName: { flex: 1, fontSize: 16, fontWeight: '600' },
  folderCount: { fontSize: 14, fontWeight: '600', opacity: 0.6 },
});
