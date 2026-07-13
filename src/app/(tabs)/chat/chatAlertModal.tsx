// ─────────────────────────────────────────────────────────────────────────────
//  chatAlertModal.tsx — a themed, cross-platform replacement for
//  Alert.alert, used for confirmations, action sheets, and error/info
//  messages throughout the chat screen. Native Alert.alert renders a plain
//  OS dialog that ignores app theming and looks out of place next to the
//  rest of this screen.
//
//  Usage:
//    1. Render <ChatAlertModal colors={colors} /> once, near the root of
//       the chat screen.
//    2. Call showChatAlert(title, message?, buttons?) from anywhere in this
//       folder — the buttons shape matches React Native's Alert.alert, so
//       swapping call sites is a straight rename.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { DANGER, PINK } from './chatShared';

export interface ChatAlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface ChatAlertConfig {
  title: string;
  message?: string;
  buttons?: ChatAlertButton[];
}

type Listener = (cfg: ChatAlertConfig | null) => void;
let listener: Listener | null = null;

export function showChatAlert(title: string, message?: string, buttons?: ChatAlertButton[]) {
  const cfg: ChatAlertConfig = {
    title,
    message,
    buttons: buttons && buttons.length > 0 ? buttons : [{ text: 'OK', style: 'default' }],
  };
  if (listener) listener(cfg);
  else console.warn('[ChatAlert] No <ChatAlertModal /> mounted — alert dropped:', title);
}

export function ChatAlertModal({ colors }: { colors: any }) {
  const [cfg, setCfg] = useState<ChatAlertConfig | null>(null);

  useEffect(() => {
    listener = setCfg;
    return () => { if (listener === setCfg) listener = null; };
  }, []);

  if (!cfg) return null;

  const close = () => setCfg(null);
  const buttons = cfg.buttons ?? [];
  const isActionSheet = buttons.length > 2;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={am.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={close} />
        <View style={[am.card, { backgroundColor: colors.card }]}>
          <Text style={[am.title, { color: colors.text }]}>{cfg.title}</Text>
          {!!cfg.message && (
            <Text style={[am.message, { color: colors.muted }]}>{cfg.message}</Text>
          )}
          <View style={[am.buttons, isActionSheet && am.buttonsColumn]}>
            {buttons.map((b, i) => (
              <TouchableOpacity
                key={i}
                style={[
                  am.btn,
                  isActionSheet && [am.btnFull, { borderColor: colors.border }],
                ]}
                onPress={() => { close(); b.onPress?.(); }}
              >
                <Text style={[
                  am.btnTxt,
                  (!b.style || b.style === 'default') && { color: PINK },
                  b.style === 'destructive' && { color: DANGER },
                  b.style === 'cancel' && { color: colors.muted, fontWeight: '600' },
                ]}>
                  {b.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const am = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  card: {
    width: '100%', borderRadius: 20, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25, shadowRadius: 20, elevation: 10,
  },
  title: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  message: { fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 20 },
  buttonsColumn: { flexDirection: 'column', gap: 0, marginTop: 16 },
  btn: { paddingHorizontal: 14, paddingVertical: 12 },
  btnFull: { alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth },
  btnTxt: { fontSize: 15, fontWeight: '600' },
});
