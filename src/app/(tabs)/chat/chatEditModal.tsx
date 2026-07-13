// ─────────────────────────────────────────────────────────────────────────────
//  chatEditModal.tsx — modal for editing a message's text.
//
//  Bug fix: the original "Edit Message" flow used Alert.prompt(), which is
//  an iOS-only API — it does not exist on Android at all (RN just no-ops
//  the call there). Since this app targets Android, editing a message was
//  silently broken. This is a themed, cross-platform replacement.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal,
  KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { PINK, WHITE, GRADIENT } from './chatShared';

interface Props {
  visible: boolean;
  initialText: string;
  colors: any;
  onCancel: () => void;
  onSave: (text: string) => void;
}

const MAX_LEN = 2000;

export default function ChatEditModal({ visible, initialText, colors, onCancel, onSave }: Props) {
  const [text, setText] = useState(initialText);

  useEffect(() => {
    if (visible) setText(initialText);
  }, [visible, initialText]);

  const trimmed = text.trim();
  const changed = trimmed.length > 0 && trimmed !== initialText.trim();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={em.overlay}
      >
        <View style={[em.card, { backgroundColor: colors.card }]}>
          <Text style={[em.title, { color: colors.text }]}>Edit Message</Text>
          <TextInput
            style={[em.input, { color: colors.text, borderColor: colors.border }]}
            value={text}
            onChangeText={setText}
            multiline
            autoFocus
            maxLength={MAX_LEN}
            placeholder="Message..."
            placeholderTextColor={colors.muted}
          />
          <Text style={[em.counter, { color: colors.muted }]}>{text.length}/{MAX_LEN}</Text>
          <View style={em.actions}>
            <TouchableOpacity onPress={onCancel} style={em.cancelBtn}>
              <Text style={[em.cancelTxt, { color: colors.muted }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => changed && onSave(trimmed)}
              disabled={!changed}
              style={{ opacity: changed ? 1 : 0.5 }}
            >
              <LinearGradient colors={GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={em.saveBtn}>
                <Icon name="checkmark" size={18} color={WHITE} />
                <Text style={em.saveTxt}>Save</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const em = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 24 },
  card: { borderRadius: 20, padding: 20 },
  title: { fontSize: 17, fontWeight: '700', marginBottom: 12 },
  input: {
    borderWidth: 1, borderRadius: 14, padding: 12, fontSize: 15,
    minHeight: 90, maxHeight: 180, textAlignVertical: 'top',
  },
  counter: { fontSize: 11, textAlign: 'right', marginTop: 6 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 16, marginTop: 16 },
  cancelBtn: { paddingHorizontal: 8, paddingVertical: 10 },
  cancelTxt: { fontSize: 15, fontWeight: '600' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12 },
  saveTxt: { color: WHITE, fontWeight: '700', fontSize: 14 },
});
