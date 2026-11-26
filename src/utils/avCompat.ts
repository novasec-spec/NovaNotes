// src/utils/avCompat.ts
//
// expo-av was removed from the Expo SDK, so this file re-creates the small part
// of its `Audio` API that the app uses (Sound, Recording, permissions, audio
// mode) on top of expo-audio. Screens import `Audio` from here instead of
// 'expo-av' and keep working unchanged.
import { Platform } from 'react-native';
import {
  AudioModule,
  RecordingPresets,
  createAudioPlayer,
  requestRecordingPermissionsAsync,
  setAudioModeAsync as setExpoAudioModeAsync,
} from 'expo-audio';
import type { AudioMode, AudioPlayer, AudioRecorder, AudioStatus, RecordingOptions } from 'expo-audio';

type SoundSource = number | string | { uri: string; headers?: Record<string, string> };

type InitialStatus = {
  shouldPlay?: boolean;
  volume?: number;
  rate?: number;
  isLooping?: boolean;
  positionMillis?: number;
  progressUpdateIntervalMillis?: number;
};

export type AVPlaybackStatus = {
  isLoaded: boolean;
  isPlaying: boolean;
  isBuffering: boolean;
  didJustFinish: boolean;
  positionMillis: number;
  durationMillis: number;
  rate: number;
  volume: number;
  isLooping: boolean;
};

type LegacyAudioMode = {
  allowsRecordingIOS?: boolean;
  staysActiveInBackground?: boolean;
  playsInSilentModeIOS?: boolean;
  shouldDuckAndroid?: boolean;
  playThroughEarpieceAndroid?: boolean;
  interruptionModeIOS?: number;
  interruptionModeAndroid?: number;
};

const LOAD_TIMEOUT_MS = 15000;

function toLegacyStatus(player: AudioPlayer, status?: AudioStatus): AVPlaybackStatus {
  const s = status ?? player.currentStatus;
  return {
    isLoaded: s?.isLoaded ?? player.isLoaded,
    isPlaying: s?.playing ?? player.playing,
    isBuffering: s?.isBuffering ?? player.isBuffering,
    didJustFinish: s?.didJustFinish ?? false,
    positionMillis: Math.round((s?.currentTime ?? player.currentTime ?? 0) * 1000),
    durationMillis: Math.round((s?.duration ?? player.duration ?? 0) * 1000),
    rate: s?.playbackRate ?? player.playbackRate,
    volume: player.volume,
    isLooping: s?.loop ?? player.loop,
  };
}

class Sound {
  private player: AudioPlayer | null = null;
  private subscription: { remove(): void } | null = null;
  private onStatus: ((status: AVPlaybackStatus) => void) | null = null;

  static async createAsync(
    source: SoundSource,
    initialStatus: InitialStatus = {},
    onPlaybackStatusUpdate?: ((status: AVPlaybackStatus) => void) | null
  ): Promise<{ sound: Sound; status: AVPlaybackStatus }> {
    const sound = new Sound();
    if (onPlaybackStatusUpdate) sound.setOnPlaybackStatusUpdate(onPlaybackStatusUpdate);
    const status = await sound.loadAsync(source, initialStatus);
    return { sound, status };
  }

  async loadAsync(source: SoundSource, initialStatus: InitialStatus = {}): Promise<AVPlaybackStatus> {
    if (this.player) await this.unloadAsync();

    const player = createAudioPlayer(source as any, {
      updateInterval: initialStatus.progressUpdateIntervalMillis ?? 500,
    });
    this.player = player;
    this.subscription = player.addListener('playbackStatusUpdate', (status) => {
      this.onStatus?.(toLegacyStatus(player, status));
    });

    if (initialStatus.volume != null) player.volume = initialStatus.volume;
    if (initialStatus.isLooping != null) player.loop = initialStatus.isLooping;
    if (initialStatus.rate != null) player.setPlaybackRate(initialStatus.rate);

    await this.waitUntilLoaded(player);

    if (initialStatus.positionMillis) await player.seekTo(initialStatus.positionMillis / 1000);
    if (initialStatus.shouldPlay) player.play();
    return toLegacyStatus(player);
  }

  // expo-av resolved loadAsync once the file was ready; expo-audio loads in the
  // background, so wait for the first "loaded" status before returning.
  private waitUntilLoaded(player: AudioPlayer): Promise<void> {
    if (player.isLoaded) return Promise.resolve();
    return new Promise((resolve) => {
      const done = () => {
        clearTimeout(timer);
        sub.remove();
        resolve();
      };
      const sub = player.addListener('playbackStatusUpdate', (status) => {
        if (status.isLoaded) done();
      });
      const timer = setTimeout(done, LOAD_TIMEOUT_MS);
    });
  }

  setOnPlaybackStatusUpdate(callback: ((status: AVPlaybackStatus) => void) | null) {
    this.onStatus = callback;
  }

  async getStatusAsync(): Promise<AVPlaybackStatus> {
    if (!this.player) return { ...EMPTY_STATUS };
    return toLegacyStatus(this.player);
  }

  async playAsync() {
    this.player?.play();
  }

  async pauseAsync() {
    this.player?.pause();
  }

  async stopAsync() {
    if (!this.player) return;
    this.player.pause();
    await this.player.seekTo(0);
  }

  async setPositionAsync(positionMillis: number) {
    await this.player?.seekTo(positionMillis / 1000);
  }

  async setVolumeAsync(volume: number) {
    if (this.player) this.player.volume = volume;
  }

  async setRateAsync(rate: number, shouldCorrectPitch = true) {
    if (!this.player) return;
    this.player.shouldCorrectPitch = shouldCorrectPitch;
    this.player.setPlaybackRate(rate);
  }

  async setIsLoopingAsync(isLooping: boolean) {
    if (this.player) this.player.loop = isLooping;
  }

  async unloadAsync() {
    const player = this.player;
    this.player = null;
    this.subscription?.remove();
    this.subscription = null;
    if (!player) return;
    try {
      player.pause();
    } catch {}
    try {
      player.remove();
    } catch {}
  }
}

const EMPTY_STATUS: AVPlaybackStatus = {
  isLoaded: false,
  isPlaying: false,
  isBuffering: false,
  didJustFinish: false,
  positionMillis: 0,
  durationMillis: 0,
  rate: 1,
  volume: 1,
  isLooping: false,
};

// Same flattening expo-audio's useAudioRecorder hook applies to a preset.
function toPlatformRecordingOptions(options: RecordingOptions) {
  const platformOptions =
    Platform.OS === 'ios' ? options.ios : Platform.OS === 'android' ? options.android : options.web;
  return {
    extension: options.extension,
    sampleRate: options.sampleRate,
    numberOfChannels: options.numberOfChannels,
    bitRate: options.bitRate,
    isMeteringEnabled: options.isMeteringEnabled ?? false,
    ...platformOptions,
  };
}

class Recording {
  private recorder: AudioRecorder | null = null;
  private uri: string | null = null;
  private durationMillis = 0;

  static async createAsync(
    options: RecordingOptions = RecordingPresets.HIGH_QUALITY
  ): Promise<{ recording: Recording }> {
    const recording = new Recording();
    const recorder = new AudioModule.AudioRecorder(toPlatformRecordingOptions(options) as any);
    recording.recorder = recorder;
    await recorder.prepareToRecordAsync();
    recorder.record();
    return { recording };
  }

  async getStatusAsync() {
    const state = this.recorder?.getStatus();
    return {
      canRecord: state?.canRecord ?? false,
      isRecording: state?.isRecording ?? false,
      isDoneRecording: !this.recorder && this.uri != null,
      durationMillis: state?.durationMillis ?? this.durationMillis,
    };
  }

  async pauseAsync() {
    this.recorder?.pause();
  }

  async startAsync() {
    this.recorder?.record();
  }

  async stopAndUnloadAsync() {
    const recorder = this.recorder;
    if (!recorder) return;
    try {
      this.durationMillis = recorder.getStatus().durationMillis;
    } catch {}
    await recorder.stop();
    this.uri = recorder.uri;
    this.recorder = null;
    try {
      recorder.release();
    } catch {}
  }

  getURI(): string | null {
    return this.uri ?? this.recorder?.uri ?? null;
  }
}

async function setAudioModeAsync(mode: LegacyAudioMode): Promise<void> {
  const next: Partial<AudioMode> = {};
  if (mode.allowsRecordingIOS != null) next.allowsRecording = mode.allowsRecordingIOS;
  if (mode.playsInSilentModeIOS != null) next.playsInSilentMode = mode.playsInSilentModeIOS;
  if (mode.staysActiveInBackground != null) next.shouldPlayInBackground = mode.staysActiveInBackground;
  if (mode.playThroughEarpieceAndroid != null) next.shouldRouteThroughEarpiece = mode.playThroughEarpieceAndroid;
  // expo-av used 1 = "do not mix"; shouldDuckAndroid lowered other apps instead of pausing them.
  if (mode.interruptionModeIOS === 1 || mode.interruptionModeAndroid === 1) next.interruptionMode = 'doNotMix';
  else if (mode.shouldDuckAndroid) next.interruptionMode = 'duckOthers';
  await setExpoAudioModeAsync(next);
}

export const Audio = {
  Sound,
  Recording,
  RecordingOptionsPresets: RecordingPresets,
  requestPermissionsAsync: requestRecordingPermissionsAsync,
  setAudioModeAsync,
};

// Lets `Audio.Sound` / `Audio.Recording` keep working as types, as they did with expo-av.
export declare namespace Audio {
  export type Sound = InstanceType<typeof Audio.Sound>;
  export type Recording = InstanceType<typeof Audio.Recording>;
}
