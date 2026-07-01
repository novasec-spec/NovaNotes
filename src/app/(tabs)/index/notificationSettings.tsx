// src/screens/notification/NotificationSettingsScreen.tsx

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  ScrollView,
  Alert,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../services/notification/NotificationService';
import { NotificationCategory } from '../../../types/notifications';

interface Preferences {
  categories: {
    [key in NotificationCategory]?: {
      enabled: boolean;
      sound: boolean;
      vibration: boolean;
    };
  };
  quiet_hours?: {
    enabled: boolean;
    start: string;
    end: string;
  };
}

const CATEGORIES = [
  { id: 'message', label: 'Messages', icon: 'chatbubbles-outline', color: '#10B981' },
  { id: 'task', label: 'Tasks', icon: 'checkbox-outline', color: '#8B5CF6' },
  { id: 'reminder', label: 'Reminders', icon: 'alarm-outline', color: '#F59E0B' },
  { id: 'system', label: 'System', icon: 'information-circle-outline', color: '#3B82F6' },
  { id: 'social', label: 'Social', icon: 'people-outline', color: '#EC4899' },
];

export default function NotificationSettingsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<Preferences>({
    categories: {},
    quiet_hours: { enabled: false, start: '22:00', end: '08:00' },
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPreferences();
  }, [user?.id]);

  const loadPreferences = async () => {
    if (!user?.id) return;

    try {
      const { data } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (data) {
        setPreferences(data);
      } else {
        // Default preferences
        const defaults: Preferences = {
          categories: {
            message: { enabled: true, sound: true, vibration: true },
            task: { enabled: true, sound: true, vibration: true },
            reminder: { enabled: true, sound: true, vibration: true },
            system: { enabled: true, sound: true, vibration: false },
            social: { enabled: true, sound: true, vibration: true },
          },
          quiet_hours: { enabled: false, start: '22:00', end: '08:00' },
        };
        setPreferences(defaults);
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    if (!user?.id) return;

    try {
      await supabase
        .from('notification_preferences')
        .upsert({
          user_id: user.id,
          categories: preferences.categories,
          quiet_hours: preferences.quiet_hours,
          updated_at: new Date().toISOString(),
        });

      Alert.alert('Success', 'Preferences saved!');
    } catch (error) {
      console.error('Error saving preferences:', error);
      Alert.alert('Error', 'Could not save preferences');
    }
  };

  const toggleCategory = (categoryId: NotificationCategory, key: keyof any) => {
    setPreferences(prev => ({
      ...prev,
      categories: {
        ...prev.categories,
        [categoryId]: {
          ...prev.categories?.[categoryId],
          enabled: prev.categories?.[categoryId]?.enabled ?? true,
          sound: prev.categories?.[categoryId]?.sound ?? true,
          vibration: prev.categories?.[categoryId]?.vibration ?? true,
          [key]: !prev.categories?.[categoryId]?.[key],
        },
      },
    }));
  };

  const toggleQuietHours = () => {
    setPreferences(prev => ({
      ...prev,
      quiet_hours: {
        ...prev.quiet_hours,
        enabled: !prev.quiet_hours?.enabled,
        start: prev.quiet_hours?.start || '22:00',
        end: prev.quiet_hours?.end || '08:00',
      },
    }));
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }, { paddingBottom: 100 }]}>
      <StatusBar barStyle="dark-content" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notification Settings</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Categories */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Categories</Text>
          
          {CATEGORIES.map((cat) => (
            <View key={cat.id} style={styles.categoryItem}>
              <View style={styles.categoryHeader}>
                <View style={[styles.iconBox, { backgroundColor: cat.color + '15' }]}>
                  <Ionicons name={cat.icon as any} size={20} color={cat.color} />
                </View>
                <Text style={styles.categoryLabel}>{cat.label}</Text>
                <Switch
                  value={preferences.categories?.[cat.id]?.enabled ?? true}
                  onValueChange={() => toggleCategory(cat.id, 'enabled')}
                  trackColor={{ false: '#D1D5DB', true: cat.color }}
                  thumbColor="#fff"
                />
              </View>
              
              {preferences.categories?.[cat.id]?.enabled && (
                <View style={styles.categoryOptions}>
                  <View style={styles.optionRow}>
                    <Text style={styles.optionLabel}>Sound</Text>
                    <Switch
                      value={preferences.categories?.[cat.id]?.sound ?? true}
                      onValueChange={() => toggleCategory(cat.id, 'sound')}
                      trackColor={{ false: '#D1D5DB', true: cat.color }}
                      thumbColor="#fff"
                      size="small"
                    />
                  </View>
                  <View style={styles.optionRow}>
                    <Text style={styles.optionLabel}>Vibration</Text>
                    <Switch
                      value={preferences.categories?.[cat.id]?.vibration ?? true}
                      onValueChange={() => toggleCategory(cat.id, 'vibration')}
                      trackColor={{ false: '#D1D5DB', true: cat.color }}
                      thumbColor="#fff"
                      size="small"
                    />
                  </View>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Quiet Hours */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quiet Hours</Text>
          <View style={styles.quietHoursItem}>
            <View style={styles.quietHoursHeader}>
              <View style={[styles.iconBox, { backgroundColor: '#6B728015' }]}>
                <Ionicons name="moon-outline" size={20} color="#6B7280" />
              </View>
              <View>
                <Text style={styles.categoryLabel}>Do Not Disturb</Text>
                <Text style={styles.quietHoursTime}>
                  {preferences.quiet_hours?.start} - {preferences.quiet_hours?.end}
                </Text>
              </View>
              <Switch
                value={preferences.quiet_hours?.enabled ?? false}
                onValueChange={toggleQuietHours}
                trackColor={{ false: '#D1D5DB', true: '#6B7280' }}
                thumbColor="#fff"
              />
            </View>
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity style={styles.saveButton} onPress={savePreferences}>
          <Text style={styles.saveButtonText}>Save Preferences</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  centered: { justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#111827' },
  content: { padding: 16, marginBottom: 20 },
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  categoryItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingVertical: 12,
  },
  categoryItem: { paddingVertical: 12 },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryLabel: { flex: 1, fontSize: 16, color: '#374151' },
  categoryOptions: { paddingLeft: 48, marginTop: 8 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  optionLabel: { fontSize: 14, color: '#6B7280' },
  quietHoursItem: { paddingVertical: 8 },
  quietHoursHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quietHoursTime: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  saveButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
