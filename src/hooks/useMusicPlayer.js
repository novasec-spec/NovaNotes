// src/hooks/useMusicPlayer.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { Event } from 'react-native-track-player';
import MusicPlayerService from '../services/MusicPlayerService';

export function useMusicPlayer() {
  const [currentTrack, setCurrentTrack] = useState(null);
  const [queue, setQueue] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [repeatMode, setRepeatMode] = useState('off');
  const [shuffle, setShuffle] = useState(false);
  const [error, setError] = useState(null);
  
  const positionInterval = useRef(null);

  // Update position every second
  const startPositionUpdates = useCallback(() => {
    if (positionInterval.current) {
      clearInterval(positionInterval.current);
    }
    positionInterval.current = setInterval(async () => {
      try {
        const pos = await MusicPlayerService.getPosition();
        if (pos !== null && pos !== undefined) {
          setPosition(pos);
        }
      } catch (e) {
        // Silently fail
      }
    }, 1000);
  }, []);

  const stopPositionUpdates = useCallback(() => {
    if (positionInterval.current) {
      clearInterval(positionInterval.current);
      positionInterval.current = null;
    }
  }, []);

  // Load current track info
  const loadCurrentTrack = useCallback(async () => {
    try {
      const track = await MusicPlayerService.getCurrentTrack();
      setCurrentTrack(track);
      if (track) {
        setIsPlaying(track.isPlaying || false);
        setIsLoading(track.isLoading || false);
        setPosition(track.position || 0);
        setDuration(track.duration || 0);
        if (track.isPlaying) {
          startPositionUpdates();
        } else {
          stopPositionUpdates();
        }
      }
    } catch (error) {
      console.error('Failed to load current track:', error);
    }
  }, [startPositionUpdates, stopPositionUpdates]);

  // Play a track
  const playTrack = useCallback(async (track) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const success = await MusicPlayerService.playTrack(track);
      if (success) {
        await loadCurrentTrack();
        startPositionUpdates();
      } else {
        setError('Failed to play track');
      }
    } catch (err) {
      setError(err.message || 'Playback failed');
      console.error('Play error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [loadCurrentTrack, startPositionUpdates]);

  // Play queue
  const playQueue = useCallback(async (tracks, startIndex = 0) => {
    try {
      setIsLoading(true);
      setError(null);
      setQueue(tracks);
      
      const success = await MusicPlayerService.playQueue(tracks, startIndex);
      if (success) {
        await loadCurrentTrack();
        startPositionUpdates();
      } else {
        setError('Failed to play queue');
      }
    } catch (err) {
      setError(err.message || 'Playback failed');
      console.error('Queue play error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [loadCurrentTrack, startPositionUpdates]);

  // Toggle play/pause
  const togglePlay = useCallback(async () => {
    try {
      if (isPlaying) {
        await MusicPlayerService.pause();
        stopPositionUpdates();
        setIsPlaying(false);
      } else {
        await MusicPlayerService.play();
        startPositionUpdates();
        setIsPlaying(true);
      }
      await loadCurrentTrack();
    } catch (err) {
      setError(err.message || 'Toggle play failed');
      console.error('Toggle play error:', err);
    }
  }, [isPlaying, loadCurrentTrack, startPositionUpdates, stopPositionUpdates]);

  // Next track
  const nextTrack = useCallback(async () => {
    try {
      await MusicPlayerService.skipToNext();
      await loadCurrentTrack();
    } catch (err) {
      setError(err.message || 'Next track failed');
      console.error('Next track error:', err);
    }
  }, [loadCurrentTrack]);

  // Previous track
  const prevTrack = useCallback(async () => {
    try {
      await MusicPlayerService.skipToPrevious();
      await loadCurrentTrack();
    } catch (err) {
      setError(err.message || 'Previous track failed');
      console.error('Prev track error:', err);
    }
  }, [loadCurrentTrack]);

  // Seek to position
  const seekTo = useCallback(async (newPosition) => {
    try {
      await MusicPlayerService.seekTo(newPosition);
      setPosition(newPosition);
    } catch (err) {
      setError(err.message || 'Seek failed');
      console.error('Seek error:', err);
    }
  }, []);

  // Set repeat mode
  const setRepeat = useCallback(async (mode) => {
    try {
      await MusicPlayerService.setRepeatMode(mode);
      setRepeatMode(mode);
    } catch (err) {
      setError(err.message || 'Set repeat failed');
      console.error('Set repeat error:', err);
    }
  }, []);

  // Toggle shuffle
  const toggleShuffle = useCallback(async () => {
    try {
      const newShuffle = !shuffle;
      await MusicPlayerService.setShuffleMode(newShuffle);
      setShuffle(newShuffle);
    } catch (err) {
      setError(err.message || 'Toggle shuffle failed');
      console.error('Toggle shuffle error:', err);
    }
  }, [shuffle]);

  // Stop playback
  const stopPlayback = useCallback(async () => {
    try {
      await MusicPlayerService.stop();
      stopPositionUpdates();
      setCurrentTrack(null);
      setIsPlaying(false);
      setPosition(0);
      setDuration(0);
    } catch (err) {
      setError(err.message || 'Stop failed');
      console.error('Stop error:', err);
    }
  }, [stopPositionUpdates]);

  // Setup player on mount
  useEffect(() => {
    const setup = async () => {
      await MusicPlayerService.setupPlayer();
      await loadCurrentTrack();
      
      // Listen for playback events
      MusicPlayerService.addEventListener(Event.PlaybackProgress, async () => {
        // Position updates handled by interval
      });

      MusicPlayerService.addEventListener(Event.PlaybackPlay, () => {
        setIsPlaying(true);
        startPositionUpdates();
      });

      MusicPlayerService.addEventListener(Event.PlaybackPause, () => {
        setIsPlaying(false);
        stopPositionUpdates();
      });

      MusicPlayerService.addEventListener(Event.PlaybackStopped, () => {
        setIsPlaying(false);
        stopPositionUpdates();
        setPosition(0);
      });

      MusicPlayerService.addEventListener(Event.PlaybackEnded, () => {
        loadCurrentTrack();
      });
    };

    setup();

    return () => {
      stopPositionUpdates();
    };
  }, [loadCurrentTrack, startPositionUpdates, stopPositionUpdates]);

  return {
    currentTrack,
    queue,
    isPlaying,
    isLoading,
    position,
    duration,
    repeatMode,
    shuffle,
    error,
    playTrack,
    playQueue,
    togglePlay,
    nextTrack,
    prevTrack,
    seekTo,
    setRepeat,
    toggleShuffle,
    stopPlayback,
    loadCurrentTrack,
  };
}
