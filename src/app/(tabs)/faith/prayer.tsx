// src/app/(tabs)/faith/prayer.tsx
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

interface PrayerRequest {
  id: string;
  title: string;
  description: string;
  date: string;
  answered: boolean;
  answerDate?: string;
  answerDescription?: string;
  category: 'personal' | 'family' | 'church' | 'world' | 'other';
}

const PRAYER_CATEGORIES = [
  { key: 'all', label: 'All', icon: 'apps' },
  { key: 'personal', label: 'Personal', icon: 'account' },
  { key: 'family', label: 'Family', icon: 'account-group' },
  { key: 'church', label: 'Church', icon: 'church' },
  { key: 'world', label: 'World', icon: 'earth' },
  { key: 'other', label: 'Other', icon: 'dots-horizontal' },
];

export default function PrayerScreen() {
  const { colors, isDarkMode } = useTheme();
  const [prayers, setPrayers] = useState<PrayerRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editingPrayer, setEditingPrayer] = useState<PrayerRequest | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'personal' as PrayerRequest['category'],
  });

  useEffect(() => {
    loadPrayers();
  }, []);

  const loadPrayers = async () => {
    try {
      const saved = await AsyncStorage.getItem('faith_prayers');
      if (saved) {
        setPrayers(JSON.parse(saved));
      } else {
        // Load sample prayers from API
        const apiPrayers = await FaithApiService.getPrayers();
        if (apiPrayers) {
          const formatted = apiPrayers.map((p: any) => ({
            id: Date.now().toString() + Math.random(),
            title: p.title || 'Prayer Request',
            description: p.description || p.text || '',
            date: new Date().toISOString(),
            answered: false,
            category: 'personal',
          }));
          setPrayers(formatted);
          await AsyncStorage.setItem('faith_prayers', JSON.stringify(formatted));
        }
      }
    } catch (error) {
      console.error('Error loading prayers:', error);
    } finally {
      setLoading(false);
    }
  };

  const savePrayers = async (newPrayers: PrayerRequest[]) => {
    setPrayers(newPrayers);
    await AsyncStorage.setItem('faith_prayers', JSON.stringify(newPrayers));
  };

  const addPrayer = () => {
    if (!formData.title.trim()) {
      Alert.alert('Error', 'Please enter a prayer title');
      return;
    }

    const newPrayer: PrayerRequest = {
      id: Date.now().toString(),
      title: formData.title.trim(),
      description: formData.description.trim(),
      date: new Date().toISOString(),
      answered: false,
      category: formData.category,
    };

    savePrayers([newPrayer, ...prayers]);
    resetForm();
    setShowModal(false);
  };

  const toggleAnswered = (id: string) => {
    const updated = prayers.map(p =>
      p.id === id
        ? {
            ...p,
            answered: !p.answered,
            answerDate: !p.answered ? new Date().toISOString() : undefined,
            answerDescription: !p.answered ? 'Prayer answered! 🙏' : undefined,
          }
        : p
    );
    savePrayers(updated);
  };

  const deletePrayer = (id: string) => {
    Alert.alert('Delete Prayer', 'Are you sure you want to delete this prayer request?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => savePrayers(prayers.filter(p => p.id !== id)),
      },
    ]);
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      category: 'personal',
    });
    setEditingPrayer(null);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPrayers();
    setRefreshing(false);
  };

  const filteredPrayers = prayers.filter(
    p => selectedCategory === 'all' || p.category === selectedCategory
  );

  const answeredCount = prayers.filter(p => p.answered).length;

  const renderPrayerCard = ({ item }: { item: PrayerRequest }) => (
    <View style={[styles.prayerCard, { backgroundColor: colors.card }]}>
      <View style={styles.prayerHeader}>
        <View style={styles.prayerTitleContainer}>
          <MaterialCommunityIcons
            name={item.answered ? 'check-circle' : 'progress-clock'}
            size={20}
            color={item.answered ? '#22C55E' : '#F59E0B'}
          />
          <Text style={[styles.prayerTitle, { color: colors.text }]}>{item.title}</Text>
        </View>
        <View style={styles.prayerActions}>
          <TouchableOpacity onPress={() => toggleAnswered(item.id)}>
            <MaterialCommunityIcons
              name={item.answered ? 'heart' : 'heart-outline'}
              size={20}
              color={item.answered ? '#22C55E' : colors.muted}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => deletePrayer(item.id)}>
            <Icon name="trash-outline" size={18} color={colors.muted} />
          </TouchableOpacity>
        </View>
      </View>

      {item.description && (
        <Text style={[styles.prayerDesc, { color: colors.muted }]}>{item.description}</Text>
      )}

      <View style={styles.prayerFooter}>
        <View style={[styles.categoryBadge, { backgroundColor: '#8B5CF620' }]}>
          <Text style={[styles.categoryText, { color: '#8B5CF6' }]}>{item.category}</Text>
        </View>
        <Text style={[styles.prayerDate, { color: colors.muted }]}>
          {new Date(item.date).toLocaleDateString()}
        </Text>
      </View>

      {item.answered && item.answerDescription && (
        <View style={[styles.answerBox, { backgroundColor: '#22C55E10', borderColor: '#22C55E' }]}>
          <MaterialCommunityIcons name="check-circle" size={16} color="#22C55E" />
          <Text style={[styles.answerText, { color: '#22C55E' }]}>{item.answerDescription}</Text>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Icon name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>🙏 Prayer Journal</Text>
        <TouchableOpacity
          onPress={() => {
            resetForm();
            setShowModal(true);
          }}
          style={[styles.addBtn, { backgroundColor: '#8B5CF6' }]}
        >
          <Icon name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={[styles.statsRow, { backgroundColor: colors.card }]}>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: colors.text }]}>{prayers.length}</Text>
          <Text style={[styles.statLabel, { color: colors.muted }]}>Total</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: '#F59E0B' }]}>{prayers.length - answeredCount}</Text>
          <Text style={[styles.statLabel, { color: colors.muted }]}>Unanswered</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, { color: '#22C55E' }]}>{answeredCount}</Text>
          <Text style={[styles.statLabel, { color: colors.muted }]}>Answered</Text>
        </View>
      </View>

      {/* Categories */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
        {PRAYER_CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.key}
            style={[
              styles.categoryChip,
              selectedCategory === cat.key && styles.categoryChipActive,
              { backgroundColor: selectedCategory === cat.key ? '#8B5CF6' : colors.border },
            ]}
            onPress={() => setSelectedCategory(cat.key)}
          >
            <MaterialCommunityIcons
              name={cat.icon}
              size={14}
              color={selectedCategory === cat.key ? '#fff' : colors.muted}
            />
            <Text
              style={[
                styles.categoryChipText,
                { color: selectedCategory === cat.key ? '#fff' : colors.muted },
              ]}
            >
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Prayer List */}
      <FlatList
        data={filteredPrayers}
        keyExtractor={item => item.id}
        renderItem={renderPrayerCard}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#8B5CF6" />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="hands-pray" size={48} color={colors.muted} />
            <Text style={[styles.emptyText, { color: colors.text }]}>No prayers yet</Text>
            <Text style={[styles.emptySub, { color: colors.muted }]}>Add your first prayer request</Text>
          </View>
        }
      />

      {/* Add/Edit Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editingPrayer ? 'Edit Prayer' : 'New Prayer Request'}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Icon name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.modalInput, { color: colors.text, borderColor: colors.border }]}
              placeholder="Prayer title..."
              placeholderTextColor={colors.muted}
              value={formData.title}
              onChangeText={text => setFormData({ ...formData, title: text })}
            />

            <TextInput
              style={[styles.modalInput, styles.modalTextArea, { color: colors.text, borderColor: colors.border }]}
              placeholder="Description (optional)"
              placeholderTextColor={colors.muted}
              value={formData.description}
              onChangeText={text => setFormData({ ...formData, description: text })}
              multiline
            />

            <View style={styles.categorySelector}>
              <Text style={[styles.categoryLabel, { color: colors.muted }]}>Category:</Text>
              <View style={styles.categoryOptions}>
                {PRAYER_CATEGORIES.filter(c => c.key !== 'all').map(cat => (
                  <TouchableOpacity
                    key={cat.key}
                    style={[
                      styles.categoryOption,
                      formData.category === cat.key && styles.categoryOptionActive,
                      { borderColor: formData.category === cat.key ? '#8B5CF6' : colors.border },
                    ]}
                    onPress={() => setFormData({ ...formData, category: cat.key as any })}
                  >
                    <Text
                      style={[
                        styles.categoryOptionText,
                        { color: formData.category === cat.key ? '#8B5CF6' : colors.muted },
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: '#8B5CF6' }]}
              onPress={addPrayer}
            >
              <Text style={styles.saveBtnText}>Save Prayer</Text>
            </TouchableOpacity>
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

  // Stats
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    margin: 16,
    borderRadius: 12,
  },
  statItem: { alignItems: 'center' },
  statNumber: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 12, marginTop: 2, opacity: 0.7 },
  statDivider: { width: 1, height: 30, backgroundColor: '#E5E7EB' },

  // Categories
  categoryScroll: { paddingHorizontal: 16, marginBottom: 12 },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  categoryChipActive: { backgroundColor: '#8B5CF6' },
  categoryChipText: { fontSize: 12, fontWeight: '600' },

  // Prayer Card
  prayerCard: {
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
  prayerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  prayerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  prayerTitle: { fontSize: 15, fontWeight: '600', flex: 1 },
  prayerActions: { flexDirection: 'row', gap: 12 },
  prayerDesc: { fontSize: 14, marginTop: 4, marginBottom: 10, lineHeight: 20 },
  prayerFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  categoryText: { fontSize: 10, fontWeight: '600' },
  prayerDate: { fontSize: 11, opacity: 0.6 },

  // Answer Box
  answerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 10,
  },
  answerText: { flex: 1, fontSize: 13, fontWeight: '500' },

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

  // Category selector
  categorySelector: { marginBottom: 16 },
  categoryLabel: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  categoryOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryOption: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  categoryOptionActive: { backgroundColor: '#8B5CF610' },
  categoryOptionText: { fontSize: 12, fontWeight: '500' },

  saveBtn: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
