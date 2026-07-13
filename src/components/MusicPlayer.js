// src/components/MusicPlayer.js
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Dimensions,
  ActivityIndicator,
  Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Slider from '@react-native-community/slider';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

const MusicPlayer = ({ 
  track, 
  isPlaying, 
  isLoading, 
  position, 
  duration, 
  onPlayPause, 
  onNext, 
  onPrevious, 
  onSeek,
  onRepeat,
  onShuffle,
  repeatMode,
  shuffle,
  onClose,
  onAddToQueue,
}) => {
  const [slideValue, setSlideValue] = useState(0);
  const [artworkLoaded, setArtworkLoaded] = useState(false);

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = duration > 0 ? position / duration : 0;

  // Update slide value when position changes
  useEffect(() => {
    setSlideValue(position);
  }, [position]);

  return (
    <View style={styles.container}>
      {/* Artwork with gradient overlay */}
      <View style={styles.artworkContainer}>
        {track?.artwork ? (
          <Image 
            source={{ uri: track.artwork }}
            style={styles.artwork}
            onLoadStart={() => setArtworkLoaded(false)}
            onLoadEnd={() => setArtworkLoaded(true)}
          />
        ) : (
          <LinearGradient
            colors={['#FF6B9D', '#A855F7']}
            style={styles.artworkPlaceholder}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Icon name="musical-notes" size={60} color="#FFF" />
          </LinearGradient>
        )}
        {!artworkLoaded && track?.artwork && (
          <View style={styles.artworkLoading}>
            <ActivityIndicator color="#FF6B9D" />
          </View>
        )}
      </View>

      {/* Track info */}
      <View style={styles.infoContainer}>
        <Text style={styles.title} numberOfLines={1}>
          {track?.title || 'No track playing'}
        </Text>
        <Text style={styles.artist} numberOfLines={1}>
          {track?.artist || 'Unknown Artist'}
        </Text>
        {track?.album && (
          <Text style={styles.album} numberOfLines={1}>
            {track.album}
          </Text>
        )}
      </View>

      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={duration || 1}
          value={slideValue}
          onSlidingComplete={onSeek}
          minimumTrackTintColor="#FF6B9D"
          maximumTrackTintColor="rgba(255,255,255,0.2)"
          thumbTintColor="#FF6B9D"
          disabled={!track}
        />
        <View style={styles.timeContainer}>
          <Text style={styles.timeText}>{formatTime(position)}</Text>
          <Text style={styles.timeText}>{formatTime(duration)}</Text>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controlsContainer}>
        <TouchableOpacity onPress={onShuffle} style={styles.controlButton}>
          <Icon 
            name="shuffle" 
            size={24} 
            color={shuffle ? '#FF6B9D' : 'rgba(255,255,255,0.5)'} 
          />
        </TouchableOpacity>

        <TouchableOpacity onPress={onPrevious} style={styles.controlButton}>
          <Icon name="play-skip-back" size={30} color="#FFF" />
        </TouchableOpacity>

        <TouchableOpacity 
          onPress={onPlayPause} 
          style={styles.playButton}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="large" color="#FFF" />
          ) : (
            <Icon 
              name={isPlaying ? 'pause' : 'play'} 
              size={36} 
              color="#FFF" 
            />
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={onNext} style={styles.controlButton}>
          <Icon name="play-skip-forward" size={30} color="#FFF" />
        </TouchableOpacity>

        <TouchableOpacity onPress={onRepeat} style={styles.controlButton}>
          <Icon 
            name="repeat" 
            size={24} 
            color={repeatMode !== 'off' ? '#FF6B9D' : 'rgba(255,255,255,0.5)'} 
          />
          {repeatMode === 'one' && (
            <View style={styles.repeatOneIndicator} />
          )}
        </TouchableOpacity>
      </View>

      {/* Queue & Add buttons */}
      <View style={styles.bottomRow}>
        {onAddToQueue && (
          <TouchableOpacity onPress={onAddToQueue} style={styles.queueButton}>
            <Icon name="list-outline" size={20} color="rgba(255,255,255,0.6)" />
            <Text style={styles.queueButtonText}>Add to queue</Text>
          </TouchableOpacity>
        )}
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Icon name="close" size={24} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    padding: 24,
    margin: 16,
    width: width - 32,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  artworkContainer: {
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  artwork: {
    width: 240,
    height: 240,
    borderRadius: 20,
    backgroundColor: '#2A2A2A',
  },
  artworkPlaceholder: {
    width: 240,
    height: 240,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  artworkLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 20,
  },
  infoContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 4,
  },
  artist: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
  },
  album: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 2,
  },
  progressContainer: {
    marginBottom: 20,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -8,
    paddingHorizontal: 4,
  },
  timeText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
  },
  controlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 10,
  },
  controlButton: {
    padding: 10,
    position: 'relative',
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FF6B9D',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6B9D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  repeatOneIndicator: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF6B9D',
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  queueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  queueButtonText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
  },
  closeButton: {
    padding: 4,
  },
});

export default MusicPlayer;
