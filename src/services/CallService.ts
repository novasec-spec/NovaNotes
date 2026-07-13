// src/services/CallService.ts
//
// ⚠️ Deliberately exports ONLY a singleton instance (default export).
// No named `class CallService` export exists — that ambiguity caused a
// real "initiateCall is not a function" bug (a named import silently grabs
// the class constructor instead of the instance). There is exactly one
// correct way to import this file:
//
//   import CallService from '../services/CallService';

import { supabase } from '../config/supabase'; // adjust to your actual client path
import { isCallingAvailable } from '../lib/callAvailability';
import InCallManager from 'react-native-incall-manager';
import { Platform } from 'react-native';
import type { Room as RoomType, RemoteParticipant, RemoteTrack, RemoteTrackPublication, ConnectionState } from 'livekit-client';

export type CallStatus = 'ringing' | 'connected' | 'ended' | 'declined' | 'missed' | 'cancelled';
export type CallType = 'audio' | 'video';

export interface Call {
  id: string;
  caller_id: string;
  callee_id: string;
  status: CallStatus;
  room_name: string;
  type: CallType;
  started_at?: string;
  ended_at?: string;
  duration: number;
  created_at?: string;
}

export interface CallUser {
  id: string;
  username: string;
  avatar_url?: string;
}

interface RoomEventHandlers {
  onParticipantConnected?: (p: RemoteParticipant) => void;
  onParticipantDisconnected?: (p: RemoteParticipant) => void;
  onTrackSubscribed?: (track: RemoteTrack, pub: RemoteTrackPublication, p: RemoteParticipant) => void;
  onTrackUnsubscribed?: (track: RemoteTrack, pub: RemoteTrackPublication, p: RemoteParticipant) => void;
  onConnectionStateChanged?: (state: ConnectionState) => void;
  onDisconnected?: (reason?: string) => void;
}

const USER_CACHE_TTL_MS = 60_000;

class CallServiceImpl {
  private room: RoomType | null = null;
  private userId: string | null = null;
  private userCache = new Map<string, { user: CallUser; expiresAt: number }>();

  setUserId(userId: string) {
    this.userId = userId;
  }

  private async getUserId(): Promise<string> {
    if (this.userId) return this.userId;
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw new Error('Not authenticated');
    this.userId = user.id;
    return user.id;
  }

  // ── Signaling ────────────────────────────────────────────────────────────
  async initiateCall(calleeId: string, type: CallType = 'video'): Promise<Call | null> {
    try {
      await this.getUserId();
      const { data, error } = await supabase.functions.invoke('calls-initiate', { body: { calleeId, type } });
      if (error) throw error;
      return data.call as Call;
    } catch (error) {
      console.error('❌ initiateCall error:', error);
      return null;
    }
  }

  async acceptCall(callId: string): Promise<{ token: string; url: string } | null> {
    if (!callId) {
      console.warn('⚠️ acceptCall called with no callId');
      return null;
    }
    try {
      await this.getUserId();
      const { data, error } = await supabase.functions.invoke('calls-accept', { body: { callId } });
      if (error) throw error;
      return { token: data.token, url: data.serverUrl };
    } catch (error) {
      console.error('❌ acceptCall error:', error);
      return null;
    }
  }

  /**
   * For the CALLER, once the callee has already accepted (call status is
   * 'connected'). Unlike acceptCall, this does not attempt the
   * ringing→connected transition — only the callee triggers that.
   */
  async getCallToken(callId: string): Promise<{ token: string; url: string } | null> {
    if (!callId) return null;
    try {
      await this.getUserId();
      const { data, error } = await supabase.functions.invoke('generate-token', { body: { callId } });
      if (error) throw error;
      return { token: data.token, url: data.serverUrl };
    } catch (error) {
      console.error('❌ getCallToken error:', error);
      return null;
    }
  }

  async declineCall(callId: string): Promise<boolean> {
    return this.updateStatus(callId, 'decline');
  }

  async cancelCall(callId: string): Promise<boolean> {
    return this.updateStatus(callId, 'cancel');
  }

  async endCall(callId: string): Promise<boolean> {
    return this.updateStatus(callId, 'end');
  }

  private async updateStatus(callId: string, action: 'decline' | 'cancel' | 'end'): Promise<boolean> {
    if (!callId) return false;
    try {
      await this.getUserId();
      const { error } = await supabase.functions.invoke('calls-update-status', { body: { callId, action } });
      if (error) throw error;
      return true;
    } catch (error) {
      console.error(`❌ ${action} call error:`, error);
      return false;
    }
  }

  // ── Status: fetch + realtime ────────────────────────────────────────────
  async getCallStatus(callId: string): Promise<Call | null> {
    if (!callId) return null;
    try {
      const { data, error } = await supabase.from('calls').select('*').eq('id', callId).single();
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('❌ getCallStatus error:', error);
      return null;
    }
  }

  /** Fires once immediately with current state, then on every DB update. Always call the returned unsubscribe. */
subscribeToCall(
  callId: string,
  onChange: (call: Call) => void
) {
  let closed = false;

  // Remove existing channel for this call if it exists
  const existing = supabase
    .getChannels()
    .find(
      c => c.topic === `realtime:call-${callId}`
    );

  if (existing) {
    supabase.removeChannel(existing);
  }

  const channel = supabase
   .channel(`call-${callId}-${Date.now()}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'calls',
        filter: `id=eq.${callId}`,
      },
      payload => {
        if (!closed) {
          onChange(payload.new as Call);
        }
      }
    )
    .subscribe();

  return () => {
    closed = true;
    supabase.removeChannel(channel);
  };
}
  // ── LiveKit room lifecycle ──────────────────────────────────────────────
  async joinRoom(token: string, serverUrl: string, type: CallType): Promise<boolean> {
    if (!isCallingAvailable()) {
      console.warn('⚠️ joinRoom called but calling runtime is unavailable');
      return false;
    }
    try {
      if (this.room) await this.leaveRoom();

      const { Room } = require('livekit-client');
      this.room = new Room({ adaptiveStream: true, dynacast: true, publishDefaults: { videoCodec: 'vp8' } });

      await this.room.connect(serverUrl, token);
      await this.room.localParticipant.setMicrophoneEnabled(true);
      if (type === 'video') await this.room.localParticipant.setCameraEnabled(true);

      InCallManager.start({ media: type === 'video' ? 'video' : 'audio' });
      InCallManager.setForceSpeakerphoneOn(type === 'video');

      return true;
    } catch (error) {
      console.error('❌ joinRoom error:', error);
      return false;
    }
  }

  async leaveRoom(): Promise<void> {
    try {
      if (this.room) {
        await this.room.disconnect();
        this.room = null;
      }
    } catch (error) {
      console.error('❌ leaveRoom error:', error);
    } finally {
      try {
        InCallManager.stop();
      } catch {}
    }
  }

  getRoom(): RoomType | null {
    return this.room;
  }

  // ── Media controls ──────────────────────────────────────────────────────
  async toggleMute(): Promise<boolean> {
    if (!this.room) return false;
    const lp = this.room.localParticipant;
    const nextEnabled = !lp.isMicrophoneEnabled;
    await lp.setMicrophoneEnabled(nextEnabled);
    return !nextEnabled; // returns new MUTED state
  }

  async toggleCamera(): Promise<boolean> {
    if (!this.room) return false;
    const lp = this.room.localParticipant;
    const nextEnabled = !lp.isCameraEnabled;
    await lp.setCameraEnabled(nextEnabled);
    return nextEnabled;
  }

  async switchCamera(): Promise<void> {
    try {
      const { Track } = require('livekit-client');
      const pub = this.room?.localParticipant.getTrackPublication(Track.Source.Camera);
      const videoTrack: any = pub?.videoTrack;
      if (videoTrack?.mediaStreamTrack?._switchCamera) {
        await videoTrack.mediaStreamTrack._switchCamera();
      }
    } catch (error) {
      console.error('❌ switchCamera error:', error);
    }
  }

  toggleSpeaker(forceSpeakerOn: boolean) {
    try {
      InCallManager.setForceSpeakerphoneOn(forceSpeakerOn);
    } catch (error) {
      console.error('❌ toggleSpeaker error:', error);
    }
  }

  onRoomEvents(handlers: RoomEventHandlers): () => void {
    if (!this.room) return () => {};
    const room = this.room;
    const { RoomEvent } = require('livekit-client');

    const p1 = (p: RemoteParticipant) => handlers.onParticipantConnected?.(p);
    const p2 = (p: RemoteParticipant) => handlers.onParticipantDisconnected?.(p);
    const t1 = (t: RemoteTrack, pub: RemoteTrackPublication, p: RemoteParticipant) => handlers.onTrackSubscribed?.(t, pub, p);
    const t2 = (t: RemoteTrack, pub: RemoteTrackPublication, p: RemoteParticipant) => handlers.onTrackUnsubscribed?.(t, pub, p);
    const c1 = (s: ConnectionState) => handlers.onConnectionStateChanged?.(s);
    const d1 = (reason?: any) => handlers.onDisconnected?.(reason?.toString());

    room.on(RoomEvent.ParticipantConnected, p1);
    room.on(RoomEvent.ParticipantDisconnected, p2);
    room.on(RoomEvent.TrackSubscribed, t1);
    room.on(RoomEvent.TrackUnsubscribed, t2);
    room.on(RoomEvent.ConnectionStateChanged, c1);
    room.on(RoomEvent.Disconnected, d1);

    return () => {
      room.off(RoomEvent.ParticipantConnected, p1);
      room.off(RoomEvent.ParticipantDisconnected, p2);
      room.off(RoomEvent.TrackSubscribed, t1);
      room.off(RoomEvent.TrackUnsubscribed, t2);
      room.off(RoomEvent.ConnectionStateChanged, c1);
      room.off(RoomEvent.Disconnected, d1);
    };
  }

  // ── History / lookups (cached) ──────────────────────────────────────────
  async getCallHistory(limit = 50): Promise<Call[]> {
    try {
      const userId = await this.getUserId();
      const { data, error } = await supabase
        .from('calls')
        .select('*, caller:users!calls_caller_id_fkey(*), callee:users!calls_callee_id_fkey(*)')
        .or(`caller_id.eq.${userId},callee_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ getCallHistory error:', error);
      return [];
    }
  }

  async getOtherUser(callId: string): Promise<CallUser | null> {
    if (!callId) return null;
    const cached = this.userCache.get(callId);
    if (cached && cached.expiresAt > Date.now()) return cached.user;

    try {
      const userId = await this.getUserId();
      const { data, error } = await supabase
        .from('calls')
        .select('caller_id, callee_id, caller:users!calls_caller_id_fkey(*), callee:users!calls_callee_id_fkey(*)')
        .eq('id', callId)
        .single();
      if (error) throw error;

      const other = data.caller_id === userId ? (data as any).callee : (data as any).caller;
      if (other) this.userCache.set(callId, { user: other, expiresAt: Date.now() + USER_CACHE_TTL_MS });
      return other || null;
    } catch (error) {
      console.error('❌ getOtherUser error:', error);
      return null;
    }
  }

  // ── Push token registration ─────────────────────────────────────────────
  async registerPushToken(expoPushToken: string): Promise<boolean> {
    try {
      const userId = await this.getUserId();
      const { error } = await supabase
        .from('push_tokens')
        .upsert({ user_id: userId, expo_token: expoPushToken, platform: Platform.OS, last_active: new Date().toISOString() }, { onConflict: 'user_id,expo_token' });
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('❌ registerPushToken error:', error);
      return false;
    }
  }
}

const CallService = new CallServiceImpl();
export default CallService;
