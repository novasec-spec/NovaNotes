// src/app/chat/types.ts
export interface User {
  id: string;
  email: string;
  username: string;
  avatar_url: string;
  online: boolean;
  last_seen: string;
}

export interface Chat {
  id: string;
  user1_id: string;
  user2_id: string;
  last_message: string;
  last_message_time: string;
  other_user: User;
  unread_count: number;
  created_at: string;
}

export interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  text: string;
  image_url?: string;
  video_url?: string;
  audio_url?: string;
  file_url?: string;
  file_name?: string;
  read_at: string | null;
  delivered_at: string | null;
  created_at: string;
}
