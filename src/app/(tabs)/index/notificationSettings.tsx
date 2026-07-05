// src/screens/notification/NotificationSettingsScreen.tsx

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  ScrollView,
  Alert,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../../../contexts/AuthContext';
import { useTheme } from '../../../contexts/ThemeContext';
import { supabase } from '../../../services/notification/NotificationService';
import { NotificationCategory } from '../../../types/notifications';

// ─── TYPES ──────────────────────────────────────────────

interface CategoryPreference {
  enabled: boolean;
  sound: boolean;
  vibration: boolean;
  priority: 'low' | 'normal' | 'high';
}

interface Preferences {
  categories: {
    [key in NotificationCategory]?: CategoryPreference;
  };
  quiet_hours: {
    enabled: boolean;
    start: string;
    end: string;
  };
  general: {
    showBanners: boolean;
    showBadges: boolean;
    playSounds: boolean;
    vibrate: boolean;
    previewText: boolean;
  };
}

// ─── CONSTANTS ──────────────────────────────────────────

const CATEGORIES: Array<{
  id: NotificationCategory;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  description: string;
}> = [
  { 
    id: 'message', 
    label: 'Messages', 
    icon: 'chatbubbles-outline', 
    color: '#10B981',
    description: 'Chat messages and replies',
  },
  { 
    id: 'task', 
    label: 'Tasks', 
    icon: 'checkbox-outline', 
    color: '#8B5CF6',
    description: 'Task reminders and updates',
  },
  { 
    id: 'reminder', 
    label: 'Reminders', 
    icon: 'alarm-outline', 
    color: '#F59E0B',
    description: 'Note reminders and alerts',
  },
  { 
    id: 'system', 
    label: 'System', 
    icon: 'information-circle-outline', 
    color: '#3B82F6',
    description: 'System notifications',
  },
  { 
    id: 'social', 
    label: 'Social', 
    icon: 'people-outline', 
    color: '#EC4899',
    description: 'Social interactions',
  },
];

const DEFAULT_PREFERENCES: Preferences = {
  categories: {
    message: { enabled: true, sound: true, vibration: true, priority: 'high' },
    task: { enabled: true, sound: true, vibration: true, priority: 'high' },
    reminder: { enabled: true, sound: true, vibration: true, priority: 'normal' },
    system: { enabled: true, sound: true, vibration: false, priority: 'normal' },
    social: { enabled: true, sound: true, vibration: true, priority: 'normal' },
  },
  quiet_hours: { 
    enabled: false, 
    start: '22:00', 
    end: '08:00' 
  },
  general: {
    showBanners: true,
    showBadges: true,
    playSounds: true,
    vibrate: true,
    previewText: true,
  },
};

// ─── COMPONENT ──────────────────────────────────────────

export default function NotificationSettingsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { colors, isDarkMode } = useTheme();
  
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── LOAD PREFERENCES ─────────────────────────────────

  const loadPreferences = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      if (data) {
        // Merge with defaults to ensure all fields exist
        setPreferences({
          ...DEFAULT_PREFERENCES,
          ...data,
          categories: {
            ...DEFAULT_PREFERENCES.categories,
            ...(data.categories || {}),
          },
          quiet_hours: {
            ...DEFAULT_PREFERENCES.quiet_hours,
            ...(data.quiet_hours || {}),
          },
          general: {
            ...DEFAULT_PREFERENCES.general,
            ...(data.general || {}),
          },
        });
      } else {
        setPreferences(DEFAULT_PREFERENCES);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load preferences';
      setError(errorMsg);
      console.error('Error loading preferences:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // ─── SAVE PREFERENCES ─────────────────────────────────

  const savePreferences = useCallback(async () => {
    if (!user?.id) {
      Alert.alert('Error', 'Please sign in to save preferences');
      return;
    }

    if (!hasChanges) {
      Alert.alert('Info', 'No changes to save');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const { error: saveError } = await supabase
        .from('notification_preferences')
        .upsert({
          user_id: user.id,
          categories: preferences.categories,
          quiet_hours: preferences.quiet_hours,
          general: preferences.general,
          updated_at: new Date().toISOString(),
        });

      if (saveError) throw saveError;

      setHasChanges(false);
      Alert.alert(
        '✅ Success',
        'Notification preferences saved successfully!',
        [{ text: 'OK' }]
      );
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to save preferences';
      setError(errorMsg);
      Alert.alert('Error', 'Could not save preferences. Please try again.');
      console.error('Error saving preferences:', err);
    } finally {
      setSaving(false);
    }
  }, [user?.id, preferences, hasChanges]);

  // ─── UPDATE PREFERENCES ──────────────────────────────

  const updateCategory = useCallback((
    categoryId: NotificationCategory,
    updates: Partial<CategoryPreference>
  ) => {
    setPreferences(prev => ({
      ...prev,
      categories: {
        ...prev.categories,
        [categoryId]: {
          ...prev.categories?.[categoryId],
          ...updates,
        } as CategoryPreference,
      },
    }));
    setHasChanges(true);
  }, []);

  const toggleCategoryEnabled = useCallback((categoryId: NotificationCategory) => {
    const current = preferences.categories?.[categoryId]?.enabled ?? true;
    updateCategory(categoryId, { enabled: !current });
  }, [preferences, updateCategory]);

  const toggleCategorySound = useCallback((categoryId: NotificationCategory) => {
    const current = preferences.categories?.[categoryId]?.sound ?? true;
    updateCategory(categoryId, { sound: !current });
  }, [preferences, updateCategory]);

  const toggleCategoryVibration = useCallback((categoryId: NotificationCategory) => {
    const current = preferences.categories?.[categoryId]?.vibration ?? true;
    updateCategory(categoryId, { vibration: !current });
  }, [preferences, updateCategory]);

  const updatePriority = useCallback((
    categoryId: NotificationCategory,
    priority: 'low' | 'normal' | 'high'
  ) => {
    updateCategory(categoryId, { priority });
  }, [updateCategory]);

  const toggleQuietHours = useCallback(() => {
    setPreferences(prev => ({
      ...prev,
      quiet_hours: {
        ...prev.quiet_hours,
        enabled: !prev.quiet_hours?.enabled,
      },
    }));
    setHasChanges(true);
  }, []);

  const updateQuietHoursTime = useCallback((field: 'start' | 'end', value: string) => {
    setPreferences(prev => ({
      ...prev,
      quiet_hours: {
        ...prev.quiet_hours,
        [field]: value,
      },
    }));
    setHasChanges(true);
  }, []);

  const toggleGeneral = useCallback((key: keyof Preferences['general']) => {
    setPreferences(prev => ({
      ...prev,
      general: {
        ...prev.general,
        [key]: !prev.general?.[key],
      },
    }));
    setHasChanges(true);
  }, []);

  // ─── REFRESH ──────────────────────────────────────────

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadPreferences();
    setRefreshing(false);
  }, [loadPreferences]);

  // ─── RESET TO DEFAULTS ──────────────────────────────

  const resetToDefaults = useCallback(() => {
    Alert.alert(
      'Reset to Defaults',
      'Are you sure you want to reset all notification preferences to default?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            setPreferences(DEFAULT_PREFERENCES);
            setHasChanges(true);
            Alert.alert('Reset', 'Preferences reset. Tap Save to apply.');
          },
        },
      ]
    );
  }, []);

  // ─── INIT ─────────────────────────────────────────────

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  // ─── RENDER ───────────────────────────────────────────

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#FF6B9D" />
        <Text style={[styles.loadingText, { color: colors.text }]}>Loading preferences...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Notification Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Error Banner */}
      {error && (
        <View style={[styles.errorBanner, { backgroundColor: '#FEE2E2' }]}>
          <Ionicons name="alert-circle" size={20} color="#DC2626" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => setError(null)}>
            <Ionicons name="close" size={18} color="#DC2626" />
          </TouchableOpacity>
        </View>
      )}

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FF6B9D"
            colors={['#FF6B9D']}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ─── GENERAL SETTINGS ─── */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>General</Text>

          <View style={[styles.settingItem, { borderBottomColor: colors.border }]}>
            <View style={styles.settingInfo}>
              <Ionicons name="eye-outline" size={20} color={colors.text} />
              <Text style={[styles.settingLabel, { color: colors.text }]}>Show Banners</Text>
            </View>
            <Switch
              value={preferences.general?.showBanners ?? true}
              onValueChange={() => toggleGeneral('showBanners')}
              trackColor={{ false: '#D1D5DB', true: '#FF6B9D' }}
              thumbColor="#fff"
            />
          </View>

          <View style={[styles.settingItem, { borderBottomColor: colors.border }]}>
            <View style={styles.settingInfo}>
              <Ionicons name="radio-button-on-outline" size={20} color={colors.text} />
              <Text style={[styles.settingLabel, { color: colors.text }]}>Show Badges</Text>
            </View>
            <Switch
              value={preferences.general?.showBadges ?? true}
              onValueChange={() => toggleGeneral('showBadges')}
              trackColor={{ false: '#D1D5DB', true: '#FF6B9D' }}
              thumbColor="#fff"
            />
          </View>

          <View style={[styles.settingItem, { borderBottomColor: colors.border }]}>
            <View style={styles.settingInfo}>
              <Ionicons name="volume-high-outline" size={20} color={colors.text} />
              <Text style={[styles.settingLabel, { color: colors.text }]}>Play Sounds</Text>
            </View>
            <Switch
              value={preferences.general?.playSounds ?? true}
              onValueChange={() => toggleGeneral('playSounds')}
              trackColor={{ false: '#D1D5DB', true: '#FF6B9D' }}
              thumbColor="#fff"
            />
          </View>

          <View style={[styles.settingItem, { borderBottomColor: colors.border }]}>
            <View style={styles.settingInfo}>
              <Ionicons name="phone-portrait-outline" size={20} color={colors.text} />
              <Text style={[styles.settingLabel, { color: colors.text }]}>Vibrate</Text>
            </View>
            <Switch
              value={preferences.general?.vibrate ?? true}
              onValueChange={() => toggleGeneral('vibrate')}
              trackColor={{ false: '#D1D5DB', true: '#FF6B9D' }}
              thumbColor="#fff"
            />
          </View>

          <View style={[styles.settingItem, { borderBottomColor: 'transparent' }]}>
            <View style={styles.settingInfo}>
              <Ionicons name="text-outline" size={20} color={colors.text} />
              <Text style={[styles.settingLabel, { color: colors.text }]}>Show Preview Text</Text>
            </View>
            <Switch
              value={preferences.general?.previewText ?? true}
              onValueChange={() => toggleGeneral('previewText')}
              trackColor={{ false: '#D1D5DB', true: '#FF6B9D' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* ─── CATEGORIES ─── */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Categories</Text>

          {CATEGORIES.map((cat) => {
            const pref = preferences.categories?.[cat.id];
            const isEnabled = pref?.enabled ?? true;

            return (
              <View key={cat.id} style={[styles.categoryItem, { borderBottomColor: colors.border }]}>
                {/* Category Header */}
                <View style={styles.categoryHeader}>
                  <View style={[styles.iconBox, { backgroundColor: cat.color + '20' }]}>
                    <Ionicons name={cat.icon} size={22} color={cat.color} />
                  </View>
                  <View style={styles.categoryInfo}>
                    <Text style={[styles.categoryLabel, { color: colors.text }]}>
                      {cat.label}
                    </Text>
                    <Text style={[styles.categoryDescription, { color: colors.muted }]}>
                      {cat.description}
                    </Text>
                  </View>
                  <Switch
                    value={isEnabled}
                    onValueChange={() => toggleCategoryEnabled(cat.id)}
                    trackColor={{ false: '#D1D5DB', true: cat.color }}
                    thumbColor="#fff"
                  />
                </View>

                {/* Category Options (when enabled) */}
                {isEnabled && (
                  <View style={styles.categoryOptions}>
                    <View style={[styles.optionRow, { borderBottomColor: colors.border }]}>
                      <Text style={[styles.optionLabel, { color: colors.text }]}>Sound</Text>
                      <Switch
                        value={pref?.sound ?? true}
                        onValueChange={() => toggleCategorySound(cat.id)}
                        trackColor={{ false: '#D1D5DB', true: cat.color }}
                        thumbColor="#fff"
                        size="small"
                      />
                    </View>

                    <View style={[styles.optionRow, { borderBottomColor: colors.border }]}>
                      <Text style={[styles.optionLabel, { color: colors.text }]}>Vibration</Text>
                      <Switch
                        value={pref?.vibration ?? true}
                        onValueChange={() => toggleCategoryVibration(cat.id)}
                        trackColor={{ false: '#D1D5DB', true: cat.color }}
                        thumbColor="#fff"
                        size="small"
                      />
                    </View>

                    <View style={[styles.optionRow, { borderBottomColor: 'transparent' }]}>
                      <Text style={[styles.optionLabel, { color: colors.text }]}>Priority</Text>
                      <View style={styles.priorityButtons}>
                        {(['low', 'normal', 'high'] as const).map((p) => (
                          <TouchableOpacity
                            key={p}
                            style={[
                              styles.priorityBtn,
                              { borderColor: colors.border },
                              pref?.priority === p && { 
                                borderColor: cat.color,
                                backgroundColor: cat.color + '20',
                              },
                            ]}
                            onPress={() => updatePriority(cat.id, p)}
                          >
                            <Text style={[
                              styles.priorityText,
                              { color: colors.muted },
                              pref?.priority === p && { color: cat.color, fontWeight: '700' },
                            ]}>
                              {p.charAt(0).toUpperCase() + p.slice(1)}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* ─── QUIET HOURS ─── */}
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Quiet Hours</Text>

          <View style={[styles.quietHoursItem, { borderBottomColor: colors.border }]}>
            <View style={styles.quietHoursHeader}>
              <View style={[styles.iconBox, { backgroundColor: '#6B728020' }]}>
                <Ionicons name="moon-outline" size={22} color="#6B7280" />
              </View>
              <View style={styles.quietHoursInfo}>
                <Text style={[styles.categoryLabel, { color: colors.text }]}>Do Not Disturb</Text>
                <Text style={[styles.quietHoursTime, { color: colors.muted }]}>
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

            {preferences.quiet_hours?.enabled && (
              <View style={styles.quietHoursOptions}>
                <View style={[styles.optionRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.optionLabel, { color: colors.text }]}>Start Time</Text>
                  <TouchableOpacity
                    style={styles.timePickerBtn}
                    onPress={() => {
                      // Time picker would go here
                    }}
                  >
                    <Text style={[styles.timePickerText, { color: colors.text }]}>
                      {preferences.quiet_hours?.start || '22:00'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={[styles.optionRow, { borderBottomColor: 'transparent' }]}>
                  <Text style={[styles.optionLabel, { color: colors.text }]}>End Time</Text>
                  <TouchableOpacity
                    style={styles.timePickerBtn}
                    onPress={() => {
                      // Time picker would go here
                    }}
                  >
                    <Text style={[styles.timePickerText, { color: colors.text }]}>
                      {preferences.quiet_hours?.end || '08:00'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* ─── ACTION BUTTONS ─── */}
        <View style={styles.actionContainer}>
          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: hasChanges ? '#FF6B9D' : '#D1D5DB' }]}
            onPress={savePreferences}
            disabled={!hasChanges || saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="save-outline" size={20} color="#fff" />
                <Text style={styles.saveButtonText}>
                  {hasChanges ? 'Save Changes' : 'No Changes'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.resetButton, { borderColor: colors.border }]}
            onPress={resetToDefaults}
          >
            <Ionicons name="refresh-outline" size={18} color="#EF4444" />
            <Text style={[styles.resetButtonText, { color: '#EF4444' }]}>Reset to Defaults</Text>
          </TouchableOpacity>
        </View>

        {/* ─── INFO ─── */}
        <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
          <Ionicons name="information-circle-outline" size={20} color={colors.muted} />
          <Text style={[styles.infoText, { color: colors.muted }]}>
            Changes take effect immediately. {'\n'}
            Quiet hours will silence notifications during the selected time range.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── STYLES ─────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: '#DC2626',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  categoryItem: {
    borderBottomWidth: 1,
    paddingVertical: 12,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryInfo: {
    flex: 1,
  },
  categoryLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  categoryDescription: {
    fontSize: 12,
    marginTop: 1,
  },
  categoryOptions: {
    paddingLeft: 52,
    marginTop: 8,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  optionLabel: {
    fontSize: 14,
  },
  priorityButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  priorityBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '500',
  },
  quietHoursItem: {
    borderBottomWidth: 1,
    paddingBottom: 12,
  },
  quietHoursHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quietHoursInfo: {
    flex: 1,
  },
  quietHoursTime: {
    fontSize: 12,
    marginTop: 1,
  },
  quietHoursOptions: {
    paddingLeft: 52,
    marginTop: 8,
  },
  timePickerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  timePickerText: {
    fontSize: 14,
    fontWeight: '500',
  },
  actionContainer: {
    gap: 10,
    marginBottom: 16,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 14,
paddingBottom: 100,   
 borderRadius: 12,
    marginTop: 4,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
});
