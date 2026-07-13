// src/hooks/useCallSession.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import CallService, { CallType } from '../services/CallService';
import { isCallingAvailable } from '../lib/callAvailability';

export type SessionState = 'connecting' | 'connected' | 'ended' | 'failed' | 'unsupported';

interface Options {
  callId: string;
  otherUserId: string;
  type: CallType;
  isCaller: boolean;
  /** If accept already happened elsewhere (e.g. notification action), skip re-accepting. */
  preAccepted?: boolean;
}

export function useCallSession({ callId, otherUserId, type, isCaller, preAccepted }: Options) {
  const [state, setState] = useState<SessionState>(isCallingAvailable() ? 'connecting' : 'unsupported');
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(type === 'video');
  const [isSpeakerOn, setIsSpeakerOn] = useState(type === 'video');
  const [remoteVideoTrack, setRemoteVideoTrack] = useState<any>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<any>(null);
  const [remoteJoined, setRemoteJoined] = useState(false);

  const durationInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasEndedRef = useRef(false);
  const unsubCallRef = useRef<(() => void) | null>(null);
  const unsubRoomRef = useRef<(() => void) | null>(null);

  const safeBack = useCallback(() => {
    if (router.canGoBack()) router.back();
  }, []);

  const endCall = useCallback(async () => {
    if (hasEndedRef.current) return;
    hasEndedRef.current = true;
    if (durationInterval.current) clearInterval(durationInterval.current);
    await CallService.leaveRoom();
    await CallService.endCall(callId);
    setState('ended');
    safeBack();
  }, [callId, safeBack]);

  const joinRoom = useCallback(async () => {
    // Only a callee accepting for the FIRST time in-app needs the
    // ringing→connected transition. The caller, and a callee who already
    // accepted via a notification action (preAccepted), just need a token
    // for a call that's already 'connected'.
    const needsTransition = !isCaller && !preAccepted;
    const tokenResult = needsTransition ? await CallService.acceptCall(callId) : await CallService.getCallToken(callId);

    if (!tokenResult) {
      setState('failed');
      return;
    }
    const joined = await CallService.joinRoom(tokenResult.token, tokenResult.url, type);
    if (!joined) {
      setState('failed');
      return;
    }

    setState('connected');
    durationInterval.current = setInterval(() => setDuration((d) => d + 1), 1000);

    const room = CallService.getRoom();
    if (type === 'video' && room) {
      const { Track } = require('livekit-client');
      const pub = room.localParticipant.getTrackPublication(Track.Source.Camera);
      if (pub?.videoTrack) setLocalVideoTrack(pub.videoTrack);
    }

    unsubRoomRef.current = CallService.onRoomEvents({
      onParticipantConnected: () => setRemoteJoined(true),
      onTrackSubscribed: (track) => {
        const { Track } = require('livekit-client');
        if (track.kind === Track.Kind.Video) setRemoteVideoTrack(track);
      },
      onTrackUnsubscribed: (track) => {
        const { Track } = require('livekit-client');
        if (track.kind === Track.Kind.Video) setRemoteVideoTrack(null);
      },
      onParticipantDisconnected: () => {
        setRemoteJoined(false);
        setRemoteVideoTrack(null);
      },
      onDisconnected: () => {
        if (!hasEndedRef.current) endCall();
      },
    });

    unsubCallRef.current = CallService.subscribeToCall(callId, (call) => {
      if (hasEndedRef.current) return;
      if (['ended', 'declined'].includes(call.status)) endCall();
    });
  }, [callId, type, endCall]);

  useEffect(() => {
    if (state === 'unsupported') return;
    if (!callId) {
      console.warn('⚠️ useCallSession: no callId — check the pathname params for this route');
      setState('failed');
      return;
    }

    joinRoom();

    return () => {
      unsubCallRef.current?.();
      unsubRoomRef.current?.();
      if (!hasEndedRef.current) {
        hasEndedRef.current = true;
        CallService.leaveRoom();
        CallService.endCall(callId);
      }
      if (durationInterval.current) clearInterval(durationInterval.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callId]);

  const toggleMute = async () => setIsMuted(await CallService.toggleMute());
  const toggleCamera = async () => setIsCameraOn(await CallService.toggleCamera());
  const toggleSpeaker = () => {
    const next = !isSpeakerOn;
    setIsSpeakerOn(next);
    CallService.toggleSpeaker(next);
  };
  const flipCamera = () => CallService.switchCamera();

  return {
    state,
    duration,
    isMuted,
    isCameraOn,
    isSpeakerOn,
    remoteVideoTrack,
    localVideoTrack,
    remoteJoined,
    toggleMute,
    toggleCamera,
    toggleSpeaker,
    flipCamera,
    endCall,
    safeBack,
  };
}
