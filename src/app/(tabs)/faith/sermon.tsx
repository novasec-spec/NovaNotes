// src/app/(tabs)/faith/sermon.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  RefreshControl,
  Alert,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../contexts/ThemeContext';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FaithApiService } from './services/faithApi';

interface SermonNote {
  id: string;
  title: string;
  church: string;
  preacher: string;
  date: string;
  scripture: string[];
  notes: string;
  keyTakeaways: string[];
  rating: 1 | 2 | 3 | 4 | 5;
}

const STORAGE_KEY = 'faith_sermons';

export default function SermonScreen() {
  const { colors, isDarkMode } = useTheme();
  const [sermons, setSermons] = useState<SermonNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingSermon, setEditingSermon] = useState<SermonNote | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    church: '',
    preacher: '',
    scripture: [''],
    notes: '',
    keyTakeaways: [''],
    rating: 5 as 1 | 2 | 3 | 4 | 5,
  });

  useEffect(() => {
    loadSermons();
  }, []);

  const loadSermons = async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        setSermons(JSON.parse(saved));
      } else {
        // Load sample from API
        const apiSermons = await FaithApiService.getSermons();
        if (apiSermons) {
          const formatted = apiSermons.map((s: any) => ({
            id: Date.now().toString() + Math.random(),
            title: s.title || 'Sermon',
            church: s.church || 'Church',
            preacher: s.preacher || 'Pastor',
            date: new Date().toISOString(),
            scripture: s.scripture || ['John 3:16'],
            notes: s.notes || '',
            keyTakeaways: s.keyTakeaways || ['Trust in God'],
            rating: 5,
          }));
          setSermons(formatted);
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(formatted));
        }
      }
    } catch (error) {
      console.error('Error loading sermons:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSermons = async (newSermons: SermonNote[]) => {
    setSermons(newSermons);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newSermons));
  };

  const addSermon = () => {
    if (!formData.title.trim() || !formData.preacher.trim()) {
      Alert.alert('Error', 'Please enter at least title and preacher');
      return;
    }

    const newSermon: SermonNote = {
      id: Date.now().toString(),
      title: formData.title.trim(),
      church: formData.church.trim() || 'Church',
      preacher: formData.preacher.trim(),
      date: new Date().toISOString(),
      scripture: formData.scripture.filter(s => s.trim()),
      notes: formData.notes.trim(),
      keyTakeaways: formData.keyTakeaways.filter(k => k.trim()),
      rating: formData.rating,
    };

    saveSermons([newSermon, ...sermons]);
    resetForm();
    setShowModal(false);
  };

  const deleteSermon = (id: string) => {
    Alert.alert('Delete Sermon', 'Are you sure you want to delete these notes?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => saveSermons(sermons.filter(s => s.id !== id)) },
    ]);
  };

  const resetForm = () => {
    setFormData({
      title: '',
      church: '',
      preacher: '',
      scripture: [''],
      notes: '',
      keyTakeaways: [''],
      rating: 5,
    });
    setEditingSermon(null);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSermons();
    setRefreshing(false);
  };

  const renderStars = (rating: number) => (
    <View style={styles.starsContainer}>
      {[1, 2, 3, 4, 5].map(star => (
        <Icon
          key={star}
          name={star <= rating ? 'star' : 'star-outline'}
          size={16}
          color={star <= rating ? '#F59E0B' : '#D1D5DB'}
        />
      ))}
    </View>
  );

  const renderSermonCard = ({ item }: { item: SermonNote }) => (
    <View style={[styles.sermonCard, { backgroundColor: colors.card }]}>
      <View style={styles.sermonHeader}>
        <View style={styles.sermonTitleContainer}>
          <MaterialCommunityIcons name="church" size={20} color="#F59E0B" />
          <Text style={[styles.sermonTitle, { color: colors.text }]}>{item.title}</Text>
        </View>
        <TouchableOpacity onPress={() => deleteSermon(item.id)}>
          <Icon name="trash-outline" size={18} color={colors.muted} />
        </TouchableOpacity>
      </View>

      <View style={styles.sermonMeta}>
        <Text style={[styles.sermonPreacher, { color: colors.muted }]}>
          👤 {item.preacher}
        </Text>
        <Text style={[styles.sermonChurch, { color: colors.muted }]}>
          {item.church}
        </Text>
      </View>

      <View style={styles.sermonScripture}>
        <Text style={[styles.scriptureLabel, { color: colors.muted }]}>📖 Scripture:</Text>
        <Text style={[styles.scriptureText, { color: colors.text }]}>
          {item.scripture.join(', ') || 'Not specified'}
        </Text>
      </View>

      {item.keyTakeaways.length > 0 && (
        <View style={styles.takeawaysContainer}>
          <Text style={[styles.takeawaysLabel, { color: colors.muted }]}>💡 Key Takeaways:</Text>
          {item.keyTakeaways.map((takeaway, index) => (
            <View key={index} style={styles.takeawayItem}>
              <Text style={[styles.takeawayBullet, { color: '#F59E0B' }]}>•</Text>
              <Text style={[styles.takeawayText, { color: colors.text }]}>{takeaway}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.sermonFooter}>
        <View style={styles.sermonStats}>
          {renderStars(item.rating)}
          <Text style={[styles.sermonDate, { color: colors.muted }]}>
            {new Date(item.date).toLocaleDateString()}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Icon name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>📝 Sermon Notes</Text>
        <TouchableOpacity
          onPress={() => {
            resetForm();
            setShowModal(true);
          }}
          style={[styles.addBtn, { backgroundColor: '#F59E0B' }]}
        >
          <Icon name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={sermons}
        keyExtractor={item => item.id}
        renderItem={renderSermonCard}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F59E0B" />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="note-outline" size={48} color={colors.muted} />
            <Text style={[styles.emptyText, { color: colors.text }]}>No sermon notes yet</Text>
            <Text style={[styles.emptySub, { color: colors.muted }]}>
              Take notes during your next sermon
            </Text>
          </View>
        }
      />

      {/* Add/Edit Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {editingSermon ? 'Edit Sermon Notes' : 'New Sermon Notes'}
                </Text>
                <TouchableOpacity onPress={() => setShowModal(false)}>
                  <Icon name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              <TextInput
                style={[styles.modalInput, { color: colors.text, borderColor: colors.border }]}
                placeholder="Sermon title *"
                placeholderTextColor={colors.muted}
                value={formData.title}
                onChangeText={text => setFormData({ ...formData, title: text })}
              />

              <TextInput
                style={[styles.modalInput, { color: colors.text, borderColor: colors.border }]}
                placeholder="Preacher *"
                placeholderTextColor={colors.muted}
                value={formData.preacher}
                onChangeText={text => setFormData({ ...formData, preacher: text })}
              />

              <TextInput
                style={[styles.modalInput, { color: colors.text, borderColor: colors.border }]}
                placeholder="Church (optional)"
                placeholderTextColor={colors.muted}
                value={formData.church}
                onChangeText={text => setFormData({ ...formData, church: text })}
              />

              <View style={styles.scriptureContainer}>
                <Text style={[styles.scriptureInputLabel, { color: colors.muted }]}>📖 Scripture</Text>
                {formData.scripture.map((s, index) => (
                  <View key={index} style={styles.scriptureInputRow}>
                    <TextInput
                      style={[styles.scriptureInput, { color: colors.text, borderColor: colors.border }]}
                      placeholder="e.g., John 3:16"
                      placeholderTextColor={colors.muted}
                      value={s}
                      onChangeText={text => {
                        const newScripture = [...formData.scripture];
                        newScripture[index] = text;
                        setFormData({ ...formData, scripture: newScripture });
                      }}
                    />
                    <TouchableOpacity
                      onPress={() => {
                        const newScripture = formData.scripture.filter((_, i) => i !== index);
                        setFormData({ ...formData, scripture: newScripture });
                      }}
                    >
                      <Icon name="close-circle" size={20} color={colors.muted} />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity
                  onPress={() => setFormData({ ...formData, scripture: [...formData.scripture, ''] })}
                >
                  <Text style={[styles.addScriptureBtn, { color: '#F59E0B' }]}>+ Add scripture</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.takeawaysContainerModal}>
                <Text style={[styles.takeawaysLabel, { color: colors.muted }]}>💡 Key Takeaways</Text>
                {formData.keyTakeaways.map((t, index) => (
                  <View key={index} style={styles.takeawayInputRow}>
                    <TextInput
                      style={[styles.takeawayInput, { color: colors.text, borderColor: colors.border }]}
                      placeholder="e.g., Trust in God"
                      placeholderTextColor={colors.muted}
                      value={t}
                      onChangeText={text => {
                        const newTakeaways = [...formData.keyTakeaways];
                        newTakeaways[index] = text;
                        setFormData({ ...formData, keyTakeaways: newTakeaways });
                      }}
                    />
                    <TouchableOpacity
                      onPress={() => {
                        const newTakeaways = formData.keyTakeaways.filter((_, i) => i !== index);
                        setFormData({ ...formData, keyTakeaways: newTakeaways });
                      }}
                    >
                      <Icon name="close-circle" size={20} color={colors.muted} />
                    </TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity
                  onPress={() => setFormData({ ...formData, keyTakeaways: [...formData.keyTakeaways, ''] })}
                >
                  <Text style={[styles.addTakeawayBtn, { color: '#F59E0B' }]}>+ Add key takeaway</Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={[styles.modalInput, styles.modalTextArea, { color: colors.text, borderColor: colors.border }]}
                placeholder="Additional notes..."
                placeholderTextColor={colors.muted}
                value={formData.notes}
                onChangeText={text => setFormData({ ...formData, notes: text })}
                multiline
              />

              <View style={styles.ratingContainer}>
                <Text style={[styles.ratingLabel, { color: colors.muted }]}>⭐ Rating:</Text>
                <View style={styles.ratingStars}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <TouchableOpacity key={star} onPress={() => setFormData({ ...formData, rating: star as any })}>
                      <Icon
                        name={star <= formData.rating ? 'star' : 'star-outline'}
                        size={28}
                        color={star <= formData.rating ? '#F59E0B' : '#D1D5DB'}
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: '#F59E0B' }]}
                onPress={addSermon}
              >
                <Text style={styles.saveBtnText}>Save Sermon Notes</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Sermon Card
  sermonCard: {
    padding: 16,
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  sermonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sermonTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  sermonTitle: { fontSize: 16, fontWeight: '700', flex: 1 },
  sermonMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    marginBottom: 8,
  },
  sermonPreacher: { fontSize: 13, fontWeight: '500' },
  sermonChurch: { fontSize: 12, opacity: 0.6 },
  sermonScripture: { marginBottom: 8 },
  scriptureLabel: { fontSize: 12, fontWeight: '600', marginBottom: 2 },
  scriptureText: { fontSize: 13 },

  // Takeaways
  takeawaysContainer: { marginVertical: 8 },
  takeawaysLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  takeawayItem: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  takeawayBullet: { fontSize: 14, fontWeight: '700' },
  takeawayText: { fontSize: 13, flex: 1 },

  // Footer
  sermonFooter: { marginTop: 8 },
  sermonStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  starsContainer: { flexDirection: 'row', gap: 2 },
  sermonDate: { fontSize: 11, opacity: 0.6 },

  // List
  listContent: { paddingBottom: 20 },
  emptyContainer: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptySub: { fontSize: 14, marginTop: 4, opacity: 0.6 },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: '700' },
  modalInput: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 14,
    marginBottom: 12,
  },
  modalTextArea: { height: 80, textAlignVertical: 'top' },

  // Scripture
  scriptureContainer: { marginBottom: 12 },
  scriptureInputLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  scriptureInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  scriptureInput: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 14,
  },
  addScriptureBtn: { fontSize: 13, fontWeight: '600', marginTop: 4 },

  // Takeaways
  takeawaysContainerModal: { marginBottom: 12 },
  takeawaysLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  takeawayInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  takeawayInput: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 14,
  },
  addTakeawayBtn: { fontSize: 13, fontWeight: '600', marginTop: 4 },

  // Rating
  ratingContainer: { marginBottom: 16 },
  ratingLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  ratingStars: { flexDirection: 'row', gap: 8 },

  saveBtn: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
