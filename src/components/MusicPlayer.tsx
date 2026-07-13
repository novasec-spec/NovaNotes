// src/components/MusicPlayer.tsx
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Audio } from 'expo-av';
import NowPlayingService from '../services/NowPlayingService';
import Icon from 'react-native-vector-icons/Ionicons';

interface MusicPlayerProps {
  track: {
    id: string;
    title: string;
    artist: string;
    album?: string;
    artwork?: string;
    uri: string;
  };
}

export default function MusicPlayer({ track }: MusicPlayerProps) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTrack();
    return () => {
      cleanup();
    };
  }, []);

  const loadTrack = async () => {
    try {
      setIsLoading(true);
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: track.uri },
        { shouldPlay: false }
      );
      
      setSound(newSound);
      
      const status = await newSound.getStatusAsync();
      if (status.isLoaded) {
        setDuration(status.durationMillis || 0);
      }

      // Set up playback status listener
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          setIsPlaying(status.isPlaying);
          setPosition(status.positionMillis || 0);
          
          // Update Now Playing
          NowPlayingService.updateNowPlaying({
            title: track.title,
            artist: track.artist,
            album: track.album,
            artwork: track.artwork,
            isPlaying: status.isPlaying,
            duration: status.durationMillis || 0,
            position: status.positionMillis || 0,
            onPlayPause: togglePlayPause,
          });
        }
      });

      setIsLoading(false);
    } catch (error) {
      console.error('Failed to load track:', error);
      setIsLoading(false);
    }
  };

  const togglePlayPause = async () => {
    if (!sound) return;
    
    try {
      if (isPlaying) {
        await sound.pauseAsync();
      } else {
        await sound.playAsync();
      }
    } catch (error) {
      console.error('Playback error:', error);
    }
  };

  const showNowPlaying = () => {
    NowPlayingService.showNowPlaying({
      title: track.title,
      artist: track.artist,
      album: track.album,
      artwork: track.artwork,
      isPlaying: isPlaying,
      duration: duration,
      position: position,
      onPlayPause: togglePlayPause,
    });
  };

  const cleanup = async () => {
    if (sound) {
      await sound.unloadAsync();
    }
    NowPlayingService.hideNowPlaying();
  };

  return (
    <View style={styles.container}>
      {track.artwork && (
        <Image source={{ uri: track.artwork }} style={styles.artwork} />
      )}
      <View style={styles.info}>
        <Text style={styles.title}>{track.title}</Text>
        <Text style={styles.artist}>{track.artist}</Text>
      </View>
      <View style={styles.controls}>
        <TouchableOpacity onPress={showNowPlaying} style={styles.nowPlayingBtn}>
          <Icon name="notifications-outline" size={22} color="#FF6B9D" />
        </TouchableOpacity>
        <TouchableOpacity onPress={togglePlayPause} style={styles.playBtn}>
          <Icon name={isPlaying ? 'pause' : 'play'} size={28} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    padding: 12,
    marginHorizontal: 16,
  },
  artwork: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginRight: 12,
  },
  info: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  artist: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nowPlayingBtn: {
    padding: 8,
  },
  playBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FF6B9D',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
