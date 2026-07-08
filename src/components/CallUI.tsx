// components/CallUI.tsx
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VideoTrack, isTrackReference, useTracks } from '@livekit/react-native';
import { Track } from 'livekit-client';
import InCallManager from 'react-native-incall-manager';
import * as Haptics from 'expo-haptics';
import { useCall } from '../contexts/CallContext';

export default function CallUI() {
  const { room, isVideo, endCall } = useCall();
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(isVideo);
  const [cameraOff, setCameraOff] = useState(false);
  const [duration, setDuration] = useState(0);

  const tracks = useTracks([Track.Source.Camera], { room: room ?? undefined });
  const remoteTrack = tracks.find(
    (t) => isTrackReference(t) && t.participant.identity !== room?.localParticipant.identity
  );
  const localTrack = tracks.find(
    (t) => isTrackReference(t) && t.participant.identity === room?.localParticipant.identity
  );

  useEffect(() => {
    const interval = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  const toggleMute = async () => {
    if (!room) return;
    const next = !muted;
    await room.localParticipant.setMicrophoneEnabled(!next);
    setMuted(next);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const toggleSpeaker = () => {
    const next = !speakerOn;
    InCallManager.setForceSpeakerphoneOn(next);
    setSpeakerOn(next);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const toggleCamera = async () => {
    if (!room) return;
    const next = !cameraOff;
    await room.localParticipant.setCameraEnabled(!next);
    setCameraOff(next);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const flipCamera = async () => {
    const videoPub = room?.localParticipant.getTrackPublication(Track.Source.Camera);
    const videoTrack = videoPub?.track;
    if (videoTrack && typeof videoTrack.switchCamera === 'function') {
      videoTrack.switchCamera();
    }
  };

  const handleEndCall = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    endCall();
  };

  return (
    <View style={styles.container}>
      {isVideo && remoteTrack && isTrackReference(remoteTrack) ? (
        <VideoTrack trackRef={remoteTrack} style={StyleSheet.absoluteFill} />
      ) : (
        <View style={styles.audioBg} />
      )}

      {isVideo && localTrack && isTrackReference(localTrack) && !cameraOff && (
        <View style={styles.pipContainer}>
          <VideoTrack trackRef={localTrack} style={styles.pip} />
        </View>
      )}

      <SafeAreaView style={styles.topBar}>
        <Text style={styles.name}>
          {room?.remoteParticipants.size ? [...room.remoteParticipants.values()][0]?.name : 'Connecting…'}
        </Text>
        <Text style={styles.duration}>{formatDuration(duration)}</Text>
      </SafeAreaView>

      <SafeAreaView style={styles.controls}>
        <View style={styles.row}>
          <ControlButton
            icon={muted ? 'mic-off' : 'mic'}
            active={muted}
            onPress={toggleMute}
          />
          <ControlButton
            icon={speakerOn ? 'volume-high' : 'volume-low'}
            active={speakerOn}
            onPress={toggleSpeaker}
          />
          {isVideo && (
            <ControlButton
              icon={cameraOff ? 'videocam-off' : 'videocam'}
              active={cameraOff}
              onPress={toggleCamera}
            />
          )}
          {isVideo && !cameraOff && (
            <ControlButton icon="camera-reverse" onPress={flipCamera} />
          )}
        </View>

        <TouchableOpacity style={styles.endBtn} onPress={handleEndCall}>
          <Ionicons name="call" size={30} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

function ControlButton({ icon, active, onPress }: { icon: any; active?: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.controlBtn, active && styles.controlBtnActive]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={24} color={active ? '#000' : '#fff'} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  audioBg: { flex: 1, backgroundColor: '#111' },
  pipContainer: {
    position: 'absolute', top: 60, right: 16,
    width: 100, height: 150, borderRadius: 12, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)',
  },
  pip: { width: '100%', height: '100%' },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', paddingTop: 12 },
  name: { color: '#fff', fontSize: 20, fontWeight: '700' },
  duration: { color: '#ccc', fontSize: 13, marginTop: 4 },
  controls: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', paddingBottom: 30 },
  row: { flexDirection: 'row', gap: 20, marginBottom: 28 },
  controlBtn: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  controlBtnActive: { backgroundColor: '#fff' },
  endBtn: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: '#e53935',
    justifyContent: 'center', alignItems: 'center',
  },
});
