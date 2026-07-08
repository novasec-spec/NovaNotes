// contexts/CallContext.tsx
import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';
import { Platform, Alert } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '../config/supabase';
import { useRouter, useRootNavigationState } from 'expo-router';

// Lazy load native modules with fallback
let Room: any = null;
let RoomEvent: any = null;
let Track: any = null;
let VideoTrack: any = null;
let useTracks: any = null;
let isTrackReference: any = null;
let registerGlobals: any = null;
let InCallManager: any = null;

let nativeModulesLoaded = false;
let loadingAttempted = false;

const loadNativeModules = async () => {
  if (loadingAttempted) return nativeModulesLoaded;
  loadingAttempted = true;
  
  try {
    // Only load in production build or when native modules are available
    if (Constants.executionEnvironment === 'storeClient' || 
        Constants.executionEnvironment === 'standalone') {
      
      const livekit = await import('@livekit/react-native');
      const webrtc = await import('@livekit/react-native-webrtc');
      const incall = await import('react-native-incall-manager');
      
      Room = livekit.Room;
      RoomEvent = livekit.RoomEvent;
      Track = livekit.Track;
      VideoTrack = livekit.VideoTrack;
      useTracks = livekit.useTracks;
      isTrackReference = livekit.isTrackReference;
      registerGlobals = livekit.registerGlobals;
      InCallManager = incall.default;
      
      // Register globals once
      registerGlobals?.();
      
      nativeModulesLoaded = true;
    } else {
      console.log('Running in Expo Go - native modules not available');
    }
  } catch (error) {
    console.warn('Failed to load native modules:', error);
  }
  
  return nativeModulesLoaded;
};

type CallState = 'idle' | 'ringing_outgoing' | 'ringing_incoming' | 'connecting' | 'connected';

interface CallContextValue {
  state: CallState;
  room: any | null;
  incomingInvite: any | null;
  isVideo: boolean;
  nativeModulesAvailable: boolean;
  startCall: (toUserId: string, toUserName: string, video: boolean) => Promise<void>;
  acceptCall: () => Promise<void>;
  declineCall: () => void;
  endCall: () => void;
  handlePushInvite: (data: any) => void;
}

const CallContext = createContext<CallContextValue | null>(null);

export function CallProvider({ userId, userName, children }: { userId: string; userName: string; children: React.ReactNode }) {
const router = useRouter();
const rootNavigationState = useRootNavigationState();
  const [state, setState] = useState<CallState>('idle');
  const [incomingInvite, setIncomingInvite] = useState<any | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [nativeModulesAvailable, setNativeModulesAvailable] = useState(false);
  const roomRef = useRef<any>(null);
  const [, forceRender] = useState(0);
  const seenCallIds = useRef(new Set<string>());
  const ringTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const callStartRef = useRef<number | null>(null);
  const currentCallIdRef = useRef<string>('');
  const otherUserIdRef = useRef<string>('');
  const isCallerRef = useRef<boolean>(false);

  // Load native modules on mount
  useEffect(() => {
    loadNativeModules().then(loaded => {
      setNativeModulesAvailable(loaded);
    });
  }, []);

  // Realtime signaling subscription (only if native modules available)
  useEffect(() => {
    if (!nativeModulesAvailable) return;

    const channel = supabase.channel(`calls:${userId}`)
      .on('broadcast', { event: 'invite' }, ({ payload }) => {
        if (!payload || seenCallIds.current.has(payload.callId)) return;
        seenCallIds.current.add(payload.callId);
        
        setIncomingInvite(payload);
        setIsVideo(payload.video);
        setState('ringing_incoming');
        InCallManager?.startRingtone('_BUNDLE_');
      })
      .on('broadcast', { event: 'cancel' }, ({ payload }) => {
        if (state === 'ringing_incoming') {
          setState('idle');
          setIncomingInvite(null);
          InCallManager?.stopRingtone();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, state, nativeModulesAvailable]);

  const getToken = async (roomName: string, identity: string, name: string) => {
    const { data, error } = await supabase.functions.invoke('livekit-token', {
      body: { roomName, identity, name },
    });
    if (error) throw error;
    return data.token as string;
  };

  const joinRoom = useCallback(async (roomName: string, video: boolean) => {
    if (!nativeModulesAvailable) {
      Alert.alert(
        'Native Modules Required',
        'To use video calling, please build the app first.',
        [{ text: 'OK' }]
      );
      return;
    }

    const token = await getToken(roomName, userId, userName);
    const room = new Room();
    roomRef.current = room;

    room.on(RoomEvent.ParticipantConnected, () => {
      if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
      callStartRef.current = Date.now();
    });

    room.on(RoomEvent.Disconnected, () => {
      endCall();
    });

    await room.connect(process.env.EXPO_PUBLIC_LIVEKIT_URL!, token);
    await room.localParticipant.setMicrophoneEnabled(true);
    if (video) await room.localParticipant.setCameraEnabled(true);

    InCallManager?.start({ media: video ? 'video' : 'audio' });
    InCallManager?.setForceSpeakerphoneOn(video);

    setState('connected');
    forceRender((n) => n + 1);
  }, [userId, userName, nativeModulesAvailable]);

  const startCall = async (toUserId: string, toUserName: string, video: boolean) => {
    if (!nativeModulesAvailable) {
      Alert.alert(
        'Native Modules Required',
        'To make a call, please build the app first.',
        [{ text: 'OK' }]
      );
      return;
    }

    const callId = `${userId}-${toUserId}-${Date.now()}`;
    const roomName = `call-${callId}`;
    currentCallIdRef.current = callId;
    otherUserIdRef.current = toUserId;
    isCallerRef.current = true;
    setIsVideo(video);
    setState('ringing_outgoing');
    InCallManager?.startRingback('_BUNDLE_');

    // Send signaling via Realtime
    const invitePayload = {
      callId,
      roomName,
      callerId: userId,
      callerName: userName,
      video,
    };

    await supabase.channel(`calls:${toUserId}`).send({
      type: 'broadcast',
      event: 'invite',
      payload: invitePayload,
    });

    // Send push notification as fallback
    await supabase.functions.invoke('send-call-push', {
      body: { toUserId, ...invitePayload },
    });

    // Join room
    await joinRoom(roomName, video);
    InCallManager?.stopRingback();

    // Missed call timeout
    ringTimeoutRef.current = setTimeout(async () => {
      if (roomRef.current && roomRef.current.remoteParticipants.size === 0) {
        await logMissedCall({
          callId,
          otherUserId: toUserId,
          otherUserName: toUserName,
          video,
          direction: 'outgoing',
        });
        endCall();
      }
    }, 30000);
  };

  const acceptCall = async () => {
    if (!incomingInvite || !nativeModulesAvailable) return;
    InCallManager?.stopRingtone();
    setState('connecting');
    currentCallIdRef.current = incomingInvite.callId;
    otherUserIdRef.current = incomingInvite.callerId;
    isCallerRef.current = false;
    await joinRoom(incomingInvite.roomName, incomingInvite.video);
    setIncomingInvite(null);
  };

  const declineCall = async () => {
    InCallManager?.stopRingtone();
    if (incomingInvite) {
      await supabase.channel(`calls:${incomingInvite.callerId}`).send({
        type: 'broadcast',
        event: 'cancel',
        payload: { callId: incomingInvite.callId },
      });
      await logMissedCall({
        callId: incomingInvite.callId,
        otherUserId: incomingInvite.callerId,
        otherUserName: incomingInvite.callerName,
        video: incomingInvite.video,
        direction: 'incoming',
      });
    }
    setIncomingInvite(null);
    setState('idle');
  };

  const endCall = async () => {
    // Log completed call
    if (state === 'connected' && callStartRef.current && currentCallIdRef.current) {
      const duration = Math.floor((Date.now() - callStartRef.current) / 1000);
      await supabase.from('call_logs').insert({
        call_id: currentCallIdRef.current,
        caller_id: isCallerRef.current ? userId : otherUserIdRef.current,
        callee_id: isCallerRef.current ? otherUserIdRef.current : userId,
        video: isVideo,
        status: 'completed',
        duration_seconds: duration,
        created_at: new Date().toISOString(),
      });
    }

    InCallManager?.stop();
    InCallManager?.stopRingback();
    InCallManager?.stopRingtone();
    roomRef.current?.disconnect();
    roomRef.current = null;
    setState('idle');
    setIncomingInvite(null);
    if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
    callStartRef.current = null;
  };

  const handlePushInvite = useCallback((data: any) => {
    if (seenCallIds.current.has(data.callId)) return;
    seenCallIds.current.add(data.callId);

    setIncomingInvite(data);
    setIsVideo(data.video === 'true' || data.video === true);
    setState('ringing_incoming');
    InCallManager?.startRingtone('_BUNDLE_');
  }, []);

  const logMissedCall = async (data: any) => {
    await supabase.from('call_logs').insert({
      call_id: data.callId,
      caller_id: data.direction === 'outgoing' ? userId : data.otherUserId,
      callee_id: data.direction === 'outgoing' ? data.otherUserId : userId,
      video: data.video,
      status: 'missed',
      created_at: new Date().toISOString(),
    });
  };

  // Navigation effect
useEffect(() => {
  if (!rootNavigationState?.key) return;

  if (
    state === 'connecting' ||
    state === 'connected' ||
    state === 'ringing_outgoing'
  ) {
    router.push('/call');
  }
}, [state, rootNavigationState?.key]);


  return (
    <CallContext.Provider
      value={{
        state,
        room: roomRef.current,
        incomingInvite,
        isVideo,
        nativeModulesAvailable,
        startCall,
        acceptCall,
        declineCall,
        endCall,
        handlePushInvite,
      }}
    >
      {children}
    </CallContext.Provider>
  );
}

export const useCall = () => {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used within CallProvider');
  return ctx;
};
