// src/services/CallService.ts
import { supabase } from '../config/supabase';
import { LiveKitRoom, Room, Track, RemoteParticipant } from 'livekit-client';
import * as WebRTC from 'react-native-webrtc';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Call {
  id: string;
  caller_id: string;
  callee_id: string;
  status: 'ringing' | 'connected' | 'ended' | 'declined' | 'missed';
  started_at: string | null;
  ended_at: string | null;
  duration: number;
  room_name: string;
  created_at: string;
}

export interface CallToken {
  token: string;
  serverUrl: string;
  roomName: string;
}

class CallService {
  private room: Room | null = null;
  private localTrack: any = null;
  private currentCallId: string | null = null;
  private userId: string | null = null;

  setUserId(userId: string) {
    this.userId = userId;
  }

  // ─── Initiate Call ──────────────────────────────────────────────────────
  async initiateCall(calleeId: string, type: 'audio' | 'video' = 'video'): Promise<Call | null> {
    try {
      const { data, error } = await supabase.functions.invoke('calls-initiate', {
        body: { calleeId, type }
      });

      if (error) throw error;
      
      this.currentCallId = data.call.id;
      return data.call;
    } catch (error) {
      console.error('Initiate call error:', error);
      return null;
    }
  }

  // ─── Accept Call ──────────────────────────────────────────────────────
  async acceptCall(callId: string): Promise<CallToken | null> {
    try {
      const { data, error } = await supabase.functions.invoke('calls-accept', {
        body: { callId }
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Accept call error:', error);
      return null;
    }
  }

  // ─── Decline Call ─────────────────────────────────────────────────────
  async declineCall(callId: string): Promise<boolean> {
    try {
      const { error } = await supabase.functions.invoke('calls-decline', {
        body: { callId }
      });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Decline call error:', error);
      return false;
    }
  }

  // ─── End Call ────────────────────────────────────────────────────────
  async endCall(callId: string): Promise<boolean> {
    try {
      const { error } = await supabase.functions.invoke('calls-end', {
        body: { callId }
      });

      if (error) throw error;
      
      // Cleanup WebRTC
      await this.leaveRoom();
      this.currentCallId = null;
      return true;
    } catch (error) {
      console.error('End call error:', error);
      return false;
    }
  }

  // ─── Join Call Room ──────────────────────────────────────────────────
  async joinRoom(token: string, serverUrl: string, roomName: string): Promise<boolean> {
    try {
      this.room = new Room({
        adaptiveStream: true,
        dynacast: true,
        stopLocalTrackOnUnpublish: true,
        loggerContextCb: () => 'call_room',
      });

      // Request camera and microphone permissions
      await this.requestPermissions();

      // Connect to room
      await this.room.connect(serverUrl, token, {
        rtcConfig: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ],
        },
      });

      // Publish local tracks
      await this.publishLocalTracks();
      
      return true;
    } catch (error) {
      console.error('Join room error:', error);
      return false;
    }
  }

  // ─── Publish Local Tracks ────────────────────────────────────────────
  private async publishLocalTracks() {
    if (!this.room) return;

    try {
      // Get local media
      const mediaStream = await this.getLocalMedia();
      
      // Publish tracks
      const tracks = mediaStream.getTracks();
      for (const track of tracks) {
        await this.room.localParticipant.publishTrack(track);
      }
    } catch (error) {
      console.error('Publish tracks error:', error);
    }
  }

  // ─── Get Local Media ─────────────────────────────────────────────────
  private async getLocalMedia(): Promise<MediaStream> {
    const constraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: {
        facingMode: 'user',
        width: { ideal: 640 },
        height: { ideal: 480 },
        frameRate: { ideal: 30 },
      },
    };

    return await WebRTC.getUserMedia(constraints);
  }

  // ─── Request Permissions ────────────────────────────────────────────
  private async requestPermissions() {
    try {
      const permissions = await WebRTC.getPermissions();
      if (!permissions.camera || !permissions.audio) {
        await WebRTC.requestPermissions();
      }
    } catch (error) {
      console.error('Permission request error:', error);
    }
  }

  // ─── Leave Room ──────────────────────────────────────────────────────
  async leaveRoom(): Promise<void> {
    if (this.room) {
      this.room.disconnect();
      this.room = null;
    }
  }

  // ─── Mute/Unmute Microphone ─────────────────────────────────────────
  async toggleMute(): Promise<boolean> {
    if (!this.room) return false;
    
    const audioTrack = this.room.localParticipant.audioTrackPublications;
    for (const [_, pub] of audioTrack) {
      await pub.track?.setEnabled(!pub.track.isEnabled);
      return pub.track?.isEnabled ?? false;
    }
    return false;
  }

  // ─── Flip Camera ─────────────────────────────────────────────────────
  async flipCamera(): Promise<void> {
    if (!this.room) return;

    // Get current video track
    const videoTrack = this.room.localParticipant.videoTrackPublications;
    for (const [_, pub] of videoTrack) {
      // Stop current track
      await pub.track?.stop();
      
      // Get new track with other camera
      const stream = await WebRTC.getUserMedia({
        audio: false,
        video: { facingMode: 'environment' },
      });
      const newTrack = stream.getVideoTracks()[0];
      
      // Publish new track
      await this.room.localParticipant.publishTrack(newTrack);
    }
  }

  // ─── Get Remote Participants ────────────────────────────────────────
  getRemoteParticipants(): RemoteParticipant[] {
    if (!this.room) return [];
    return Array.from(this.room.remoteParticipants.values());
  }

  // ─── Get Participant Count ──────────────────────────────────────────
  getParticipantCount(): number {
    if (!this.room) return 0;
    return this.room.participants.size;
  }

  // ─── Is Connected ────────────────────────────────────────────────────
  isConnected(): boolean {
    return this.room?.state === 'connected';
  }

  // ─── Subscribe to Events ─────────────────────────────────────────────
  onRoomEvents(callbacks: {
    onParticipantConnected?: (participant: RemoteParticipant) => void;
    onParticipantDisconnected?: (participant: RemoteParticipant) => void;
    onTrackSubscribed?: (track: Track, participant: RemoteParticipant) => void;
    onTrackUnsubscribed?: (track: Track, participant: RemoteParticipant) => void;
    onDisconnected?: () => void;
  }) {
    if (!this.room) return;

    this.room.on('participantConnected', (participant) => {
      callbacks.onParticipantConnected?.(participant);
    });

    this.room.on('participantDisconnected', (participant) => {
      callbacks.onParticipantDisconnected?.(participant);
    });

    this.room.on('trackSubscribed', (track, participant) => {
      callbacks.onTrackSubscribed?.(track, participant);
    });

    this.room.on('trackUnsubscribed', (track, participant) => {
      callbacks.onTrackUnsubscribed?.(track, participant);
    });

    this.room.on('disconnected', () => {
      callbacks.onDisconnected?.();
    });
  }
}

export default new CallService();
