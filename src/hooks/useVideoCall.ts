import { useState, useEffect, useRef } from 'react';
import { Room, RoomEvent, Track } from 'livekit-client';
import { useAuth } from '../contexts/AuthContext';

export function useVideoCall() {
  const { user } = useAuth();
  const [room, setRoom] = useState<Room | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const localAudioRef = useRef<HTMLVideoElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  const generateToken = async (roomName: string, userName: string) => {
    try {
      // We'll implement this to call our Supabase function later
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/generate-token`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ roomName, participantName: userName }),
        }
      );
      const data = await response.json();
      return data.token;
    } catch (error) {
      console.error('Error generating token:', error);
      throw error;
    }
  };

  const connectToRoom = async (roomName: string) => {
    if (!user) {
      setError('User not authenticated');
      return;
    }

    try {
      const token = await generateToken(roomName, user.id);
      const newRoom = new Room({
        adaptiveStream: true,
        dynacast: true,
        defaultVideoCodec: 'vp8',
      });

      // Set up event listeners
      newRoom.on(RoomEvent.TrackPublished, (publication) => {
        console.log('Track published:', publication);
      });

      newRoom.on(RoomEvent.TrackSubscribed, (track) => {
        console.log('Track subscribed:', track);
      });

      newRoom.on(RoomEvent.Disconnected, () => {
        setIsConnected(false);
        console.log('Disconnected from room');
      });

      await newRoom.connect(
        'wss://novanotes-production.up.railway.app',
        token
      );

      setRoom(newRoom);
      setIsConnected(true);
      setError(null);

      // Start local audio/video
      await newRoom.localParticipant.enableCameraAndMicrophone();

      return newRoom;
    } catch (error) {
      console.error('Error connecting to room:', error);
      setError(error.message);
    }
  };

  const disconnect = () => {
    if (room) {
      room.disconnect();
      setRoom(null);
      setIsConnected(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (room) {
        room.disconnect();
      }
    };
  }, [room]);

  return {
    room,
    isConnected,
    error,
    connectToRoom,
    disconnect,
    localParticipant: room?.localParticipant,
  };
}
