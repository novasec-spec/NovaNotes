
import { useState, useEffect, useRef, useCallback } from 'react';
import CallService, { CallState, CallCallbacks } from '../services/CallService';

export interface UseCallReturn {
  callState: CallState;
  isInCall: boolean;
  isConnecting: boolean;
  isConnected: boolean;
  duration: number;
  isMuted: boolean;
  isCameraOn: boolean;
  isSpeakerOn: boolean;
  connectionQuality: string;
  remoteStream: MediaStream | null;
  localStream: MediaStream | null;
  
  // Actions
  toggleMute: () => Promise<void>;
  toggleCamera: () => Promise<void>;
  switchCamera: () => Promise<void>;
  toggleSpeaker: () => Promise<void>;
  endCall: (callId?: string) => Promise<void>;
  
  // State helpers
  getFormattedDuration: () => string;
}

export function useCall(): UseCallReturn {
  const [callState, setCallState] = useState<CallState>(CallService.getCallState());
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    const callbacks: CallCallbacks = {
      onStateChange: (state) => {
        if (mounted.current) {
          setCallState(state);
        }
      },
    };

    CallService.setCallbacks(callbacks);

    return () => {
      mounted.current = false;
    };
  }, []);

  const toggleMute = useCallback(async () => {
    await CallService.toggleMute();
  }, []);

  const toggleCamera = useCallback(async () => {
    await CallService.toggleCamera();
  }, []);

  const switchCamera = useCallback(async () => {
    await CallService.switchCamera();
  }, []);

  const toggleSpeaker = useCallback(async () => {
    await CallService.toggleSpeaker();
  }, []);

  const endCall = useCallback(async (callId?: string) => {
    await CallService.endCall(callId);
  }, []);

  const getFormattedDuration = useCallback((): string => {
    const seconds = callState.duration;
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, [callState.duration]);

  return {
    callState,
    isInCall: CallService.isInCall(),
    isConnecting: callState.status === 'connecting',
    isConnected: callState.status === 'connected',
    duration: callState.duration,
    isMuted: callState.isMuted,
    isCameraOn: callState.isCameraOn,
    isSpeakerOn: callState.isSpeakerOn,
    connectionQuality: callState.connectionQuality,
    remoteStream: callState.remoteStream,
    localStream: callState.localStream,
    
    toggleMute,
    toggleCamera,
    switchCamera,
    toggleSpeaker,
    endCall,
    getFormattedDuration,
  };
}
