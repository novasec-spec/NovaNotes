// components/IncomingCallModal.tsx
import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCall } from '../contexts/CallContext';

export function IncomingCallModal() {
  const { state, incomingInvite, acceptCall, declineCall, nativeModulesAvailable } = useCall();
  
  if (state !== 'ringing_incoming' || !incomingInvite) return null;
  if (!nativeModulesAvailable) {
    return (
      <Modal transparent animationType="slide">
        <View style={styles.overlay}>
          <Text style={styles.name}>Incoming Call</Text>
          <Text style={styles.subtitle}>Build required to accept calls</Text>
          <TouchableOpacity style={[styles.btn, styles.decline]} onPress={declineCall}>
            <Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  return (
    <Modal transparent animationType="slide">
      <View style={styles.overlay}>
        <Text style={styles.name}>{incomingInvite.callerName}</Text>
        <Text style={styles.subtitle}>{incomingInvite.video ? 'Video call' : 'Voice call'}</Text>
        <View style={styles.actions}>
          <TouchableOpacity style={[styles.btn, styles.decline]} onPress={declineCall}>
            <Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.accept]} onPress={acceptCall}>
            <Ionicons name="call" size={28} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'flex-end', paddingBottom: 60, alignItems: 'center' },
  name: { color: '#fff', fontSize: 24, fontWeight: '700', marginBottom: 4 },
  subtitle: { color: '#aaa', fontSize: 14, marginBottom: 40 },
  actions: { flexDirection: 'row', gap: 60 },
  btn: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center' },
  decline: { backgroundColor: '#e53935' },
  accept: { backgroundColor: '#43a047' },
});
