// src/services/CallService.ts
//
// Core calling service. Wraps:
//  - Supabase edge functions for signaling (initiate/accept/decline/end/cancel)
//  - Supabase Realtime for instant call-state updates (replaces the old 2s poll)
//  - LiveKit (livekit-client + @livekit/react-native) for the actual media session
//
// IMPORTANT setup requirement (do this once, e.g. in your root _layout.tsx,
// BEFORE anything touches livekit-client):
//
//   import { registerGlobals } from '@livekit/react-native';
//   registerGlobals();
//
// Packages this file assumes are installed:
//   livekit-client, @livekit/react-native, @livekit/react-native-webrtc,
//   react-native-incall-manager (for real speaker/earpiece routing)

import { supabase } from '../config/supabase';
import {
  Room,
  RoomEvent,
  Track,
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  LocalParticipant,
  ConnectionState,
} from 'livekit-client';
import InCallManager from 'react-native-incall-manager';
import * as Notifications from 'expo-notifications';

export type CallStatus = 'ringing' | 'connected' | 'ended' | 'declined' | 'missed' | 'cancelled';

export interface Call {
  id: string;
  caller_id: string;
  callee_id: string;
  status: CallStatus;
  room_name: string;
  type: 'audio' | 'video';
  started_at?: string;
  ended_at?: string;
  duration: number;
  created_at?: string;
}

export interface CallToken {
  token: string;
  serverUrl: string;
  roomName: string;
  identity: string;
  displayName: string;
}

export interface CallUser {
  id: string;
  username: string;
  avatar_url?: string;
}

type RoomEventHandlers = {
  onParticipantConnected?: (participant: RemoteParticipant) => void;
  onParticipantDisconnected?: (participant: RemoteParticipant) => void;
  onTrackSubscribed?: (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => void;
  onTrackUnsubscribed?: (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => void;
  onConnectionStateChanged?: (state: ConnectionState) => void;
  onDisconnected?: (reason?: string) => void;
};

const CALL_CACHE_TTL_MS = 60_000;

export class CallService {
  private static instance: CallService;

  private room: Room | null = null;
  private userId: string | null = null;
  private currentCall: Call | null = null;

  // simple in-memory cache so repeated getOtherUser/getCallStatus calls
  // (e.g. from multiple screens mounting at once) don't hammer the DB
  private userCache = new Map<string, { user: CallUser; expiresAt: number }>();

  private constructor() {}

  static getInstance(): CallService {
    if (!CallService.instance) {
      CallService.instance = new CallService();
    }
    return CallService.instance;
  }

  // ─── User ──────────────────────────────────────────────────────────────
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

  // ─── Signaling: Initiate / Accept / Decline / End / Cancel ─────────────
  // All of these hit edge functions. The edge functions — not the client —
  // are responsible for: validating auth.uid() against caller_id, checking
  // the callee isn't blocked, enforcing one-ringing-call-at-a-time, doing
  // atomic status transitions (`update ... where status = 'ringing'`), and
  // triggering the push notification server-side. See README for the
  // expected contract of each function.

  async initiateCall(calleeId: string, type: 'video' | 'audio' = 'video'): Promise<Call | null> {
    try {
      await this.getUserId();
      const { data, error } = await supabase.functions.invoke('calls-initiate', {
        body: { calleeId, type },
      });
      if (error) throw error;
      this.currentCall = data.call;
      return data.call;
    } catch (error) {
      console.error('❌ Initiate call error:', error);
      return null;
    }
  }

  async acceptCall(callId: string): Promise<CallToken | null> {
    try {
      await this.getUserId();
      const { data, error } = await supabase.functions.invoke('calls-accept', {
        body: { callId },
      });
      if (error) throw error;

      this.currentCall = data.call;
      return {
        token: data.token,
        serverUrl: data.serverUrl,
        roomName: data.roomName,
        identity: data.identity,
        displayName: data.displayName,
      };
    } catch (error) {
      console.error('❌ Accept call error:', error);
      return null;
    }
  }

  async declineCall(callId: string): Promise<boolean> {
    return this.simpleTransition('calls-decline', callId, 'Decline');
  }

  async endCall(callId: string): Promise<boolean> {
    return this.simpleTransition('calls-end', callId, 'End');
  }

  /** Caller gives up while it's still ringing (callee hasn't answered). */
  async cancelCall(callId: string): Promise<boolean> {
    return this.simpleTransition('calls-cancel', callId, 'Cancel');
  }

  private async simpleTransition(fn: string, callId: string, label: string): Promise<boolean> {
    try {
      await this.getUserId();
      const { error } = await supabase.functions.invoke(fn, { body: { callId } });
      if (error) throw error;
      this.currentCall = null;
      return true;
    } catch (error) {
      console.error(`❌ ${label} call error:`, error);
      return false;
    }
  }

  // ─── Call status: fetch + realtime (replaces the old setTimeout poll) ──
  async getCallStatus(callId: string): Promise<Call | null> {
    try {
      const { data, error } = await supabase.from('calls').select('*').eq('id', callId).single();
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('❌ Get call status error:', error);
      return null;
    }
  }

  /**
   * Subscribes to realtime changes for a single call row. Fires immediately
   * with the current status, then again on every DB update. Returns an
   * unsubscribe function — always call it in your useEffect cleanup.
   */
  subscribeToCall(callId: string, onStatusChange: (call: Call) => void): () => void {
    let closed = false;

    // fire once with current state so the UI doesn't wait for the first change
    this.getCallStatus(callId).then((call) => {
      if (call && !closed) onStatusChange(call);
    });

    const channel = supabase
      .channel(`call-${callId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'calls', filter: `id=eq.${callId}` },
        (payload) => {
          if (!closed) onStatusChange(payload.new as Call);
        }
      )
      .subscribe();

    return () => {
      closed = true;
      supabase.removeChannel(channel);
    };
  }

  // ─── LiveKit token ──────────────────────────────────────────────────────
  async getLiveKitToken(callId: string, userId: string): Promise<{ token: string; url: string } | null> {
    try {
      const call = await this.getCallStatus(callId);
      if (!call) throw new Error('Call not found');

      const { data, error } = await supabase.functions.invoke('generate-token', {
        body: { roomName: call.room_name, participantName: userId },
      });
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('❌ Get LiveKit token error:', error);
      return null;
    }
  }

  // ─── Room lifecycle ─────────────────────────────────────────────────────
  async joinRoom(token: string, serverUrl: string, type: 'audio' | 'video' = 'video'): Promise<boolean> {
    try {
      if (this.room) {
        await this.leaveRoom();
      }

      this.room = new Room({
        adaptiveStream: true,
        dynacast: true,
        publishDefaults: { videoCodec: 'vp8' },
      });

      await this.room.connect(serverUrl, token);

      await this.room.localParticipant.setMicrophoneEnabled(true);
      if (type === 'video') {
        await this.room.localParticipant.setCameraEnabled(true);
      }

      // Route audio properly instead of just flipping UI state.
      InCallManager.start({ media: type === 'video' ? 'video' : 'audio' });
      InCallManager.setForceSpeakerphoneOn(type === 'video'); // default speaker on for video calls

      return true;
    } catch (error) {
      console.error('❌ Join room error:', error);
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
      console.error('❌ Leave room error:', error);
    } finally {
      InCallManager.stop();
    }
  }

  getRoom(): Room | null {
    return this.room;
  }

  // ─── Media controls ─────────────────────────────────────────────────────
  /** Returns the NEW muted state (true = muted). */
  async toggleMute(): Promise<boolean> {
    if (!this.room) return false;
    const lp: LocalParticipant = this.room.localParticipant;
    const nextEnabled = !lp.isMicrophoneEnabled;
    await lp.setMicrophoneEnabled(nextEnabled);
    return !nextEnabled; // muted = mic disabled
  }

  /** Returns the NEW camera-on state. */
  async toggleCamera(): Promise<boolean> {
    if (!this.room) return false;
    const lp = this.room.localParticipant;
    const nextEnabled = !lp.isCameraEnabled;
    await lp.setCameraEnabled(nextEnabled);
    return nextEnabled;
  }

  /** Flips between front/back camera (distinct from turning the camera off). */
  async switchCamera(): Promise<void> {
    try {
      const pub = this.room?.localParticipant.getTrackPublication(Track.Source.Camera);
      const videoTrack = pub?.videoTrack;
      // @ts-ignore - switchCamera exists on the RN LocalVideoTrack implementation
      if (videoTrack?.mediaStreamTrack?._switchCamera) {
        // @ts-ignore
        await videoTrack.mediaStreamTrack._switchCamera();
      }
    } catch (error) {
      console.error('❌ Switch camera error:', error);
    }
  }

  toggleSpeaker(forceSpeakerOn: boolean) {
    InCallManager.setForceSpeakerphoneOn(forceSpeakerOn);
  }

  // ─── Room events ────────────────────────────────────────────────────────
  onRoomEvents(handlers: RoomEventHandlers): () => void {
    if (!this.room) return () => {};
    const room = this.room;

    const onParticipantConnected = (p: RemoteParticipant) => handlers.onParticipantConnected?.(p);
    const onParticipantDisconnected = (p: RemoteParticipant) => handlers.onParticipantDisconnected?.(p);
    const onTrackSubscribed = (t: RemoteTrack, pub: RemoteTrackPublication, p: RemoteParticipant) =>
      handlers.onTrackSubscribed?.(t, pub, p);
    const onTrackUnsubscribed = (t: RemoteTrack, pub: RemoteTrackPublication, p: RemoteParticipant) =>
      handlers.onTrackUnsubscribed?.(t, pub, p);
    const onConnectionStateChanged = (s: ConnectionState) => handlers.onConnectionStateChanged?.(s);
    const onDisconnected = (reason?: any) => handlers.onDisconnected?.(reason?.toString());

    room.on(RoomEvent.ParticipantConnected, onParticipantConnected);
    room.on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
    room.on(RoomEvent.TrackSubscribed, onTrackSubscribed);
    room.on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
    room.on(RoomEvent.ConnectionStateChanged, onConnectionStateChanged);
    room.on(RoomEvent.Disconnected, onDisconnected);

    // return a cleanup fn so screens can remove listeners without tearing
    // down the whole room (important since React effects re-run)
    return () => {
      room.off(RoomEvent.ParticipantConnected, onParticipantConnected);
      room.off(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
      room.off(RoomEvent.TrackSubscribed, onTrackSubscribed);
      room.off(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed);
      room.off(RoomEvent.ConnectionStateChanged, onConnectionStateChanged);
      room.off(RoomEvent.Disconnected, onDisconnected);
    };
  }

  // ─── History / lookups ──────────────────────────────────────────────────
  async getCallHistory(limit: number = 50): Promise<Call[]> {
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
      console.error('❌ Get call history error:', error);
      return [];
    }
  }

  async getOtherUser(callId: string): Promise<CallUser | null> {
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
      if (other) {
        this.userCache.set(callId, { user: other, expiresAt: Date.now() + CALL_CACHE_TTL_MS });
      }
      return other || null;
    } catch (error) {
      console.error('❌ Get other user error:', error);
      return null;
    }
  }

  // ─── Push token registration (device -> DB) ─────────────────────────────
  // NOTE: this only stores the device's Expo push token. Actually SENDING
  // the "incoming call" push must happen server-side (inside calls-initiate),
  // not from the client — a client can't reliably deliver a push to a
  // DIFFERENT, possibly backgrounded/killed device. See README.
  async registerPushToken(expoPushToken: string): Promise<boolean> {
    try {
      const userId = await this.getUserId();
      const { error } = await supabase.from('push_tokens').upsert(
        {
          user_id: userId,
          expo_token: expoPushToken,
          last_active: new Date().toISOString(),
        },
        { onConflict: 'user_id,expo_token' }
      );
      if (error) throw error;
      return true;
    } catch (error) {
      console.error('❌ Register push token error:', error);
      return false;
    }
  }

  // ─── State helpers ──────────────────────────────────────────────────────
  isInCall(): boolean {
    return this.currentCall !== null && ['ringing', 'connected'].includes(this.currentCall.status);
  }

  getCurrentCall(): Call | null {
    return this.currentCall;
  }

  clearCurrentCall() {
    this.currentCall = null;
  }
}

export default CallService.getInstance();
