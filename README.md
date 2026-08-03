🌟 Nova — Your Digital Life, Organized

https://img.shields.io/badge/Expo-54.0.34-000.svg?style=flat&logo=expo
https://img.shields.io/badge/React%20Native-0.81.5-61DAFB.svg?style=flat&logo=react
https://img.shields.io/badge/TypeScript-5.9.2-3178C6.svg?style=flat&logo=typescript
https://img.shields.io/badge/Supabase-2.107.0-3ECF8E.svg?style=flat&logo=supabase
https://img.shields.io/badge/License-MIT-green.svg

---

Nova is a complete personal ecosystem for your digital life. Not just a notes app — it's where your thoughts, memories, conversations, moods, AI companion, tasks, and life history all live together in harmony.

---

📱 About

Nova is a modern, feature-rich React Native application designed to be your personal digital companion. It brings together everything that matters in one beautiful, dark-themed app with real-time synchronization, offline-first architecture, and AI-powered features.

"Your second brain. Your digital life, organized." 💫

---

✨ Key Features

🏠 Home Dashboard

· Personalized Greeting — Dynamic morning/afternoon/evening welcome
· Streak Tracking — Daily usage with milestone celebrations (7, 30, 100 days) 🎉
· Anniversary Counter — Track your journey in years, months, days 💕
· Daily Love Reason — Rotating reasons why you're loved
· Mood Tracker — 8 moods with emoji icons and colors
· Quick Access — 8 action tiles for instant navigation
· Love Quotes — Daily rotating quotes with tap-to-copy
· Notification Bell — Real-time unread count badge

📝 Smart Notes

· Rich Text Editor — Full-screen editing experience
· Voice Notes — Record and playback voice memos 🎙️
· Photo Attachments — Add images to your notes
· Doodle Canvas — Draw and save sketches 🎨
· Tags & Categories — Organize with custom tags
· Favorite & Pin — Priority sorting for important notes
· Archive — Hide notes without deleting
· Undo Delete — 5-second safety net
· Search & Filter — Find notes instantly
· Cloud Backup — Automatic Supabase sync ☁️

💬 Real-time Chat

· Instant Messaging — Powered by Supabase Realtime
· User List — See all registered users
· Online Status — Presence tracking with green dot 🟢
· Typing Indicators — See when someone is typing ✏️
· Read Receipts — ✓ (delivered) and ✓✓ (read)
· Media Sharing — Images, videos, voice notes, files 📎
· Push Notifications — Incoming message alerts 🔔
· Unread Badge — Tab badge with unread count
· Swipe Actions — Pin, Mute, Archive, Delete
· Search Conversations — Find messages quickly

🎵 Vibe & Mood Tracking

· 30+ Moods — Across 5 categories (Feelings, Energy, Wellness, Social, Spirit)
· Mood-Based Quotes — Encouraging quotes for each mood
· Mood-Based Music — Song suggestions that match your vibe 🎵
· Weekly Mood Chart — Visual mood tracking
· Journal Entries — Daily diary with ratings
· Daily Affirmation — Inspirational messages ✨
· Mood Statistics — Total logs, weekly averages
· Mood Summary — Weekly breakdown modal

📖 Faith & Prayer

· Verse of the Day — Daily Bible verses 📖
· Prayer Journal — Track prayer requests and answers 🙏
· Sermon Notes — Take notes during sermons
· Praise Reports — Share testimonies
· Prayer Reminder — Daily prayer notification
· Faith Stats — Track your spiritual journey

✅ Tasks

· Task Management — Create, edit, delete tasks
· Priority Levels — Low, Medium, High
· Task Categories — Organize by category
· Task Sharing — Share tasks with other users
· Task Filters — All, Active, Completed
· Task Stats — Total, active, completed counts
· Real-time Sync — Tasks sync across devices

🤖 AI Companion (MUNGA)

· Gemini AI Integration — Powered by Google Gemini 🤖
· 15+ Functions — Advice, motivation, jokes, prayer, and more
· Quick Actions — Pre-built action buttons
· Chat History — Persistent conversation storage
· Typing Indicator — AI typing simulation
· Dark/Light Theme — Follows app theme

🔐 Secret Vault

· PIN Lock — 4-digit PIN protection 🔒
· Secret Messages — Private notes only you can see
· Hidden Photos — Secure photo storage
· Device ID Tracking — Unique device identification

📸 Memories

· Photo Gallery — Upload and view images
· Captions & Dates — Add context to memories
· Sort by Date — Chronological timeline
· Cloud Backup — Photos synced to Supabase ☁️

🔔 Smart Notifications

· Notification Center — Full inbox-style notifications 📬
· Push Notifications — Real-time alerts
· Read/Unread Status — Mark notifications as read
· Swipe Actions — Delete or mark read
· Filter by Type — All, Unread, Archived
· Notification Badge — Unread count on tab icon

📱 Android Widgets

· Bubbles Widget — Home screen widget showing:
  · Today's quote
  · Streak count
  · Mood emoji
  · Love note
  · Quick actions (Note, Chat)
  · Unread count badge 🎯

🔔 Quick Settings Tile

· Custom Tile — Quick access from notification shade
· Unread Count Display — Shows badge on tile
· One-Tap Open — Opens app instantly

🔐 Security & Privacy

· Secure Storage — Sensitive data encrypted
· PIN Protection — Vault access control
· Environment Variables — Configurable API keys
· Row Level Security — Supabase RLS policies

🎨 Dark Theme

· Full Dark Mode — Beautiful dark interface
· Consistent Colors — Brand colors throughout
· Eye Comfort — Optimized for night use

---

🏗️ Tech Stack

Core Technologies

Technology Version Purpose
React Native 0.81.5 Mobile framework
Expo ~54.0.34 Development platform
TypeScript ~5.9.2 Type safety
React Navigation ^7.x Navigation

Backend & Database

Technology Version Purpose
Supabase ^2.107.0 Database, Auth, Real-time
Firebase 9.23.0 Push notifications (FCM)

UI & Styling

Technology Version Purpose
React Native Reanimated ~4.1.1 Animations
React Native Gesture Handler ~2.28.0 Swipe gestures
React Native Vector Icons ^10.3.0 Icons
Date-fns Latest Date formatting

AI & Chat

Technology Version Purpose
Gemini AI Latest AI Companion
LiveKit Latest Video/Audio calls

Notifications & Widgets

Technology Version Purpose
Expo Notifications ~0.32.17 Push notifications
Expo Task Manager ~14.0.9 Background tasks
React Native Android Widget Latest Home screen widgets

Media & Storage

Technology Version Purpose
Expo AV Latest Audio recording/playback
Expo Image Picker ~17.0.11 Photo picker
Expo File System ~19.0.23 File operations
Expo Secure Store ~15.0.8 Secure storage

---

📁 Project Structure

```
src/
├── app/
│   ├── (tabs)/              # Main tab navigation
│   │   ├── chat/            # Chat feature
│   │   ├── faith/           # Faith feature
│   │   ├── index/           # Home screen
│   │   ├── memories/        # Memories feature
│   │   ├── notes/           # Notes feature
│   │   ├── notifications/   # Notifications feature
│   │   ├── tasks/           # Tasks feature
│   │   ├── vault/           # Secret vault
│   │   └── vibe/            # Today's vibe
│   ├── call/                # Video/audio calling
│   ├── _layout.tsx          # Root layout
│   └── splash.tsx           # Splash screen
├── components/              # Reusable components
│   ├── MoodTracker.tsx      # Mood selection component
│   ├── MungaBot.tsx         # AI companion
│   └── TaskShareModal.tsx   # Task sharing modal
├── config/                  # Configuration
│   └── supabase.ts          # Supabase client
├── contexts/                # React Context
│   ├── AuthContext.tsx      # Authentication
│   ├── NotificationContext.tsx # Notifications
│   └── ThemeContext.tsx     # Dark/light theme
├── hooks/                   # Custom hooks
├── services/                # Services
│   ├── CallService.ts       # WebRTC calls
│   ├── NotificationService.ts # Notifications
│   └── supabaseBackup.ts    # Cloud backup
├── types/                   # TypeScript types
└── widgets/                 # Android widgets
    ├── BubblesWidget.tsx    # Home screen widget
    └── syncBubblesWidget.tsx # Widget sync
```

---

🚀 Installation

Prerequisites

· Node.js (v18 or later)
· npm or yarn
· Expo CLI
· Android Studio (for Android builds)
· Xcode (for iOS builds)

Step 1: Clone the Repository

```bash
git clone https://github.com/yourusername/nova.git
cd nova
```

Step 2: Install Dependencies

```bash
npm install
# or
yarn install
```

Step 3: Environment Variables

Create a .env file in the root directory:

```env
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# LiveKit (Video/Audio Calls)
EXPO_PUBLIC_LIVEKIT_URL=your_livekit_url

# Sentry (Error Tracking)
SENTRY_AUTH_TOKEN=your_sentry_token

# Google Sign-In
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=your_ios_client_id
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=your_android_client_id
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=your_web_client_id
```

Step 4: Supabase Setup

Run the SQL scripts in the supabase/ folder:

1. Go to your Supabase dashboard
2. Open SQL Editor
3. Copy and run the SQL files in order:
   · tables.sql — Create all tables
   · policies.sql — Row Level Security policies
   · functions.sql — Edge Functions

Step 5: Run the App

```bash
# Start Expo development server
npx expo start

# Run on Android
npx expo run:android

# Run on iOS
npx expo run:ios

# Build for production (Android)
eas build --platform android --profile preview

# Build for production (iOS)
eas build --platform ios --profile preview
```

---

📱 Key Features Walkthrough

1. Authentication

· Email/Password sign-up and sign-in
· Google Sign-In integration
· Persistent sessions with AsyncStorage
· Secure password reset flow

2. Real-time Chat

· Powered by Supabase Realtime
· Instant message delivery
· Typing indicators
· Online/offline presence
· Read receipts
· Media sharing (images, videos, voice notes)

3. AI Companion (MUNGA)

· Powered by Google Gemini AI
· 15+ built-in functions
· Quick action buttons
· Persistent conversation history
· Natural language processing

4. Mood Tracking

· 30+ moods across 5 categories
· Mood-based quotes and music
· Weekly mood charts
· Mood statistics and trends
· Journal entries with ratings

5. Notes System

· Rich text editing
· Voice notes recording
· Photo attachments
· Doodle canvas
· Tags and categories
· Favorite and pin
· Archive functionality
· Undo delete
· Cloud backup

6. Task Management

· Create, edit, delete tasks
· Priority levels
· Task categories
· Task sharing with other users
· Filters and sorting

7. Faith Features

· Verse of the day
· Prayer journal
· Sermon notes
· Praise reports
· Daily prayer reminders

---

🛠️ Development

Code Style

· ESLint for linting
· TypeScript for type safety
· Prettier for formatting

Scripts

```bash
# Start development
npm start

# Run on Android
npm run android

# Run on iOS
npm run ios

# Run on web
npm run web

# Lint
npm run lint

# Type check
npm run type-check

# Build for production
npm run build
```

Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm test -- --coverage
```

---

📊 Database Schema

Users Table

```sql
users (
  id UUID PRIMARY KEY,
  username TEXT UNIQUE,
  email TEXT,
  avatar_url TEXT,
  online BOOLEAN,
  last_seen TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
```

Messages Table

```sql
messages (
  id UUID PRIMARY KEY,
  chat_id UUID REFERENCES chats(id),
  sender_id UUID REFERENCES users(id),
  text TEXT,
  image_url TEXT,
  video_url TEXT,
  audio_url TEXT,
  file_url TEXT,
  file_name TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
```

Notifications Table

```sql
notifications (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  type TEXT,
  title TEXT,
  body TEXT,
  read BOOLEAN,
  created_at TIMESTAMPTZ
)
```

---

🤝 Contributing

1. Fork the repository
2. Create your feature branch (git checkout -b feature/AmazingFeature)
3. Commit your changes (git commit -m 'Add some AmazingFeature')
4. Push to the branch (git push origin feature/AmazingFeature)
5. Open a Pull Request

---

📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

🙏 Acknowledgments

· Expo — For the amazing development platform
· Supabase — For the open-source Firebase alternative
· React Native — For cross-platform mobile development
· Google Gemini — For AI capabilities
· All Contributors — For making this project possible

---

📞 Support

· 📧 Email: support@novanotes.com
· 🐛 Issues: GitHub Issues
· 💬 Discord: Join Discord

---

🌟 Star History

https://api.star-history.com/svg?repos=novasec-spec/nova&type=Date

---

Made with ❤️ by the Nova Team

---
