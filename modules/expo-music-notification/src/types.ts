export interface MusicNotificationTrack {
  id: string;
  title: string;
  artist: string;
  album?: string;
  /** Local content:// / file:// uri, or an http(s) url. Optional. */
  artworkUri?: string;
  /** Track duration in seconds. */
  duration: number;
}

export type MusicNotificationEventName =
  | 'MusicNotification:onPlay'
  | 'MusicNotification:onPause'
  | 'MusicNotification:onNext'
  | 'MusicNotification:onPrevious'
  | 'MusicNotification:onSeek'
  | 'MusicNotification:onStop';

export interface MusicNotificationSeekPayload {
  positionSeconds: number;
}

export interface MusicNotificationSubscription {
  remove: () => void;
}
