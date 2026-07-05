// components/ReminderModal.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { PINK, TEXT_SOFT, WHITE, REMINDER_OPTIONS } from '../utils/constants';

// ReminderModal.tsx - Add noteId prop
interface ReminderModalProps {
  visible: boolean;
  note: any | null;
  noteId?: string; // ← ADD THIS
  onSchedule: (minutes: number, noteId: string) => void; // ← CHANGE
  onRecurringSchedule?: (reminder: any) => void;
  onClose: () => void;
  colors: any;
}

export function ReminderModal({ 
  visible, 
  note, 
  noteId,
  onSchedule, 
  onRecurringSchedule,
  onClose, 
  colors 
}:ReminderModalProps) {
  const [showRecurring, setShowRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [recurringTime, setRecurringTime] = useState('09:00');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [selectedDayOfMonth, setSelectedDayOfMonth] = useState(1);

  if (!visible || !note) return null;

  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const handleRecurringSchedule = () => {
    if (onRecurringSchedule) {
      const reminder = {
        frequency: recurringFrequency,
        time: recurringTime,
        ...(recurringFrequency === 'weekly' && { daysOfWeek: selectedDays }),
        ...(recurringFrequency === 'monthly' && { dayOfMonth: selectedDayOfMonth }),
      };
      onRecurringSchedule(reminder);
      setShowRecurring(false);
      onClose();
    }
  };
// src/components/ReminderModal.tsx

// Add notification sending when reminder is set
const handleSchedule = async (minutes: number) => {
  // If minutes is 0, show custom time picker
  if (minutes === 0) {
    setShowCustomTime(true);
    return;
  }

  // Schedule notification via useNotes hook
  if (onSchedule) {
    const reminder = await onSchedule(minutes);
    if (reminder) {
      Alert.alert(
        '✅ Reminder Set!',
        `You'll be reminded in ${minutes} minutes`,
        [{ text: 'OK' }]
      );
    }
  }
  onClose();
};

  const toggleDay = (dayIndex: number) => {
    if (selectedDays.includes(dayIndex)) {
      setSelectedDays(selectedDays.filter(d => d !== dayIndex));
    } else {
      setSelectedDays([...selectedDays, dayIndex].sort());
    }
  };




   return ( <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          
          <View style={styles.headerRow}>
            <Icon name="alarm" size={22} color={PINK} />
            <Text style={[styles.title, { color: colors.text }]}>
              {showRecurring ? 'Recurring Reminder' : 'Set Reminder'}
            </Text>
            <TouchableOpacity onPress={onClose} style={{ marginLeft: 'auto' }}>
              <Icon name="close" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          {!showRecurring ? (
            <>
              <Text style={[styles.preview, { color: colors.text }]} numberOfLines={2}>
                "{(note.title || note.text).substring(0, 70)}"
              </Text>

              <ScrollView showsVerticalScrollIndicator={false}>
   
             {REMINDER_OPTIONS.map(opt => (
<TouchableOpacity
    onPress={() => {
      if (opt.minutes === 0) {
        setShowRecurring(true);
      } else {
        onSchedule(opt.minutes, noteId || note?.id); // ← Pass noteId!
      }
    }}
  >
                    <Icon name={opt.icon} size={18} color={PINK} />
                    <Text style={[styles.optionText, { color: colors.text }]}>{opt.label}</Text>
                    <Icon name="chevron-forward" size={16} color={TEXT_SOFT} style={{ marginLeft: 'auto' }} />
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity style={[styles.recurringToggle, { borderColor: PINK }]} onPress={() => setShowRecurring(true)}>
                <Icon name="repeat-outline" size={18} color={PINK} />
                <Text style={[styles.recurringToggleText, { color: PINK }]}>Set Recurring</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={[styles.preview, { color: colors.text }]}>Set repeating reminder</Text>

              <View style={styles.frequencyRow}>
                {['daily', 'weekly', 'monthly'].map(freq => (
                  <TouchableOpacity
                    key={freq}
                    style={[
                      styles.frequencyBtn,
                      { 
                        borderColor: recurringFrequency === freq ? PINK : colors.border,
                        backgroundColor: recurringFrequency === freq ? PINK + '18' : 'transparent',
                      }
                    ]}
                    onPress={() => setRecurringFrequency(freq as any)}>
                    <Text style={[styles.frequencyText, { color: recurringFrequency === freq ? PINK : colors.text }]}>
                      {freq.charAt(0).toUpperCase() + freq.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.timeInputRow}>
                <Icon name="time-outline" size={20} color={PINK} />
                <TextInput
                  style={[styles.timeInput, { color: colors.text, borderColor: colors.border }]}
                  value={recurringTime}
                  onChangeText={setRecurringTime}
                  placeholder="HH:MM"
                  placeholderTextColor={TEXT_SOFT}
                  maxLength={5}
                />
              </View>

              {recurringFrequency === 'weekly' && (
                <View style={styles.daysRow}>
                  {daysOfWeek.map((day, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.dayBtn,
                        {
                          backgroundColor: selectedDays.includes(index) ? PINK : colors.card,
                          borderColor: selectedDays.includes(index) ? PINK : colors.border,
                        }
                      ]}
                      onPress={() => toggleDay(index)}>
                      <Text style={[styles.dayText, { color: selectedDays.includes(index) ? WHITE : colors.text }]}>
                        {day}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {recurringFrequency === 'monthly' && (
                <View style={styles.dayOfMonthRow}>
                  <Text style={[styles.dayOfMonthLabel, { color: colors.text }]}>Day of month:</Text>
                  <View style={styles.dayOfMonthPicker}>
                    {[1, 5, 10, 15, 20, 25, 28].map(day => (
                      <TouchableOpacity
                        key={day}
                        style={[
                          styles.dayOfMonthBtn,
                          {
                            backgroundColor: selectedDayOfMonth === day ? PINK : colors.card,
                            borderColor: selectedDayOfMonth === day ? PINK : colors.border,
                          }
                        ]}
                        onPress={() => setSelectedDayOfMonth(day)}>
                        <Text style={[styles.dayOfMonthText, { color: selectedDayOfMonth === day ? WHITE : colors.text }]}>
                          {day}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              <View style={styles.recurringActions}>
                <TouchableOpacity style={[styles.recurringCancel, { borderColor: colors.border }]} onPress={() => setShowRecurring(false)}>
                  <Text style={[styles.recurringCancelText, { color: colors.text }]}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.recurringSave, { backgroundColor: PINK }]} onPress={handleRecurringSchedule}>
                  <Text style={styles.recurringSaveText}>Save</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
            <Text style={[styles.cancelTxt, { color: colors.text }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(40,10,30,0.38)' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 44, maxHeight: '80%' },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  title: { fontSize: 20, fontWeight: '800' },
  preview: { fontSize: 13, fontStyle: 'italic', marginBottom: 16, lineHeight: 20 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 4, borderBottomWidth: 1 },
  optionText: { fontSize: 15, fontWeight: '600' },
  cancelBtn: { marginTop: 16, alignItems: 'center', paddingVertical: 10 },
  cancelTxt: { fontWeight: '700', fontSize: 14 },
  recurringToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderRadius: 12, paddingVertical: 12, marginTop: 8 },
  recurringToggleText: { fontSize: 14, fontWeight: '700' },
  frequencyRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  frequencyBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, alignItems: 'center' },
  frequencyText: { fontSize: 14, fontWeight: '600' },
  timeInputRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  timeInput: { flex: 1, fontSize: 16, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  daysRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  dayBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  dayText: { fontSize: 12, fontWeight: '600' },
  dayOfMonthRow: { marginBottom: 16 },
  dayOfMonthLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  dayOfMonthPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayOfMonthBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  dayOfMonthText: { fontSize: 14, fontWeight: '600' },
  recurringActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  recurringCancel: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, alignItems: 'center' },
  recurringCancelText: { fontSize: 14, fontWeight: '700' },
  recurringSave: { flex: 2, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  recurringSaveText: { fontSize: 14, fontWeight: '700', color: WHITE },
});
