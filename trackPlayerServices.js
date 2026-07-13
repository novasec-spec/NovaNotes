// trackPlayerServices.js
import TrackPlayer from 'react-native-track-player';

module.exports = async function() {
  // Handle remote commands from notification
  TrackPlayer.addEventListener('remote-play', () => {
    TrackPlayer.play();
  });

  TrackPlayer.addEventListener('remote-pause', () => {
    TrackPlayer.pause();
  });

  TrackPlayer.addEventListener('remote-next', () => {
    TrackPlayer.skipToNext();
  });

  TrackPlayer.addEventListener('remote-previous', () => {
    TrackPlayer.skipToPrevious();
  });

  TrackPlayer.addEventListener('remote-seek', (event) => {
    TrackPlayer.seekTo(event.position);
  });

  TrackPlayer.addEventListener('remote-stop', () => {
    TrackPlayer.destroy();
  });

  TrackPlayer.addEventListener('remote-duck', (event) => {
    if (event.paused) {
      TrackPlayer.pause();
    }
  });

  TrackPlayer.addEventListener('playback-play', () => {
    console.log('▶️ Playback started');
  });

  TrackPlayer.addEventListener('playback-pause', () => {
    console.log('⏸️ Playback paused');
  });

  TrackPlayer.addEventListener('playback-queue-ended', () => {
    console.log('⏹️ Queue ended');
  });

  console.log('✅ Track Player Service Registered');
};
