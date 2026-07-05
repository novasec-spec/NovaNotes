// src/app/anniversary.tsx - SET ANNIVERSARY DATE
//
// New screen. Route: '/anniversary' (expo-router file-based routing —
// this file sits outside the (tabs) group since it's a one-off settings
// screen, not a tab).
//
// Reads/writes AsyncStorage key 'relationshipStartDate' as an ISO string —
// this is the exact key the homescreen's countdown card already reads from,
// so no other wiring is needed once this file exists.
//
// Dependency needed: @react-native-community/datetimepicker
//   npx expo install @react-native-community/datetimepicker

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import Ionicons from 'react-native-vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useTheme } from '../contexts/ThemeContext'; // ⚠️ adjust relative path to match this file's actual location

export default function AnniversaryScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  const [date, setDate] = useState<Date>(new Date());
  const [hasSavedDate, setHasSavedDate] = useState(false);
  const [showPicker, setShowPicker] = useState(Platform.OS === 'ios'); // iOS shows inline, Android opens a dialog
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem('relationshipStartDate');
      if (saved) {
        const parsed = new Date(saved);
        if (!isNaN(parsed.getTime())) {
          setDate(parsed);
          setHasSavedDate(true);
        }
      }
    })();
  }, []);

  const onChangeDate = useCallback((event: any, selected?: Date) => {
    if (Platform.OS === 'android') setShowPicker(false);
    if (event.type === 'dismissed') return;
    if (selected) setDate(selected);
  }, []);

  const handleSave = useCallback(async () => {
    if (date > new Date()) {
      Alert.alert('That date is in the future', 'Pick the day your relationship actually started 💕');
      return;
    }
    setSaving(true);
    try {
      await AsyncStorage.setItem('relationshipStartDate', date.toISOString());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (error) {
      console.error('Failed to save anniversary date:', error);
      Alert.alert('Something went wrong', 'Please try again.');
    } finally {
      setSaving(false);
    }
  }, [date, router]);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {hasSavedDate ? 'Edit Anniversary' : 'Set Your Anniversary'}
        </Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={styles.content}>
        <Ionicons name="heart" size={48} color="#EC4899" style={{ marginBottom: 12 }} />
        <Text style={[styles.subtitle, { color: colors.muted }]}>
          When did your story together begin?
        </Text>

        {Platform.OS === 'android' && (
          <TouchableOpacity
            style={[styles.dateButton, { backgroundColor: colors.card }]}
            onPress={() => setShowPicker(true)}
            accessibilityRole="button"
            accessibilityLabel={`Selected date: ${date.toDateString()}, tap to change`}
          >
            <Text style={[styles.dateButtonText, { color: colors.text }]}>{date.toDateString()}</Text>
            <Ionicons name="calendar-outline" size={20} color={colors.muted} />
          </TouchableOpacity>
        )}

        {showPicker && (
          <DateTimePicker
            value={date}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            maximumDate={new Date()}
            onChange={onChangeDate}
          />
        )}

        <TouchableOpacity
          style={[styles.saveButton, { opacity: saving ? 0.6 : 1 }]}
          onPress={handleSave}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel="Save anniversary date"
        >
          <Text style={styles.saveButtonText}>{saving ? 'Saving…' : 'Save Date'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: { width: 26 },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  content: { flex: 1, alignItems: 'center', paddingTop: 40, paddingHorizontal: 24 },
  subtitle: { fontSize: 14, marginBottom: 24, textAlign: 'center' },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 20,
  },
  dateButtonText: { fontSize: 15, fontWeight: '600' },
  saveButton: {
    backgroundColor: '#EC4899',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 40,
    marginTop: 24,
    width: '100%',
    alignItems: 'center',
  },
  saveButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
