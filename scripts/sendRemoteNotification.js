#!/usr/bin/env node
// scripts/sendRemoteNotification.js
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class RemoteNotificationSender {
  constructor(projectDir) {
    this.projectDir = projectDir;
    this.constantsDir = path.join(projectDir, 'constants');
  }

  ensureConstantsDir() {
    if (!fs.existsSync(this.constantsDir)) {
      fs.mkdirSync(this.constantsDir, { recursive: true });
    }
  }

  generateId() {
    return crypto.randomBytes(8).toString('hex');
  }

  getCategoryForType(type, options = {}) {
    const categories = {
      'love_message': 'love_message',
      'memory_reminder': 'memory_reminder',
      'surprise': 'love_message',
      'mood_check': 'mood_check',
      'note_reminder': 'note_reminder'
    };
    if (options.category) return options.category;
    return categories[type] || 'love_message';
  }

  getButtonsForCategory(category) {
    const buttons = {
      'love_message': ['💌 Reply', '❤️ Send Love', 'Later'],
      'memory_reminder': ['📸 View Memory', '⏰ Remind Later', 'Dismiss'],
      'mood_check': ['😊 Happy', '🥰 Loved', '😢 Sad', 'Open App'],
      'note_reminder': ['📖 Read Note', '⏰ Snooze', 'Dismiss']
    };
    return buttons[category] || buttons.love_message;
  }

  createNotificationUpdate(notification) {
    this.ensureConstantsDir();
    
    const fileContent = `// constants/RemoteNotification.ts
// AUTO-GENERATED - DO NOT EDIT MANUALLY
// Last updated: ${new Date().toISOString()}
// Notification ID: ${notification.id}
// Category: ${notification.categoryIdentifier}

export interface RemoteNotification {
  id: string;
  title: string;
  body: string;
  type: string;
  categoryIdentifier: string;
  cooldown?: number;
  sound?: boolean;
  data?: any;
  createdAt: string;
}

export const REMOTE_NOTIFICATION: RemoteNotification | null = {
  id: '${notification.id}',
  title: '${notification.title.replace(/'/g, "\\'")}',
  body: '${notification.body.replace(/'/g, "\\'")}',
  type: '${notification.type}',
  categoryIdentifier: '${notification.categoryIdentifier}',
  cooldown: ${notification.cooldown || 3600000},
  sound: true,
  data: ${JSON.stringify(notification.data || {})},
  createdAt: '${new Date().toISOString()}'
};

export function shouldShowNotification(): boolean {
  try {
    const lastShownKey = 'last_notification_' + (REMOTE_NOTIFICATION?.id || '');
    const lastShown = typeof localStorage !== 'undefined' ? localStorage.getItem(lastShownKey) : null;
    const now = Date.now();
    
    if (lastShown && REMOTE_NOTIFICATION && now - parseInt(lastShown) < (REMOTE_NOTIFICATION.cooldown || 3600000)) {
      return false;
    }
    
    if (typeof localStorage !== 'undefined' && REMOTE_NOTIFICATION) {
      localStorage.setItem(lastShownKey, now.toString());
    }
    
    return true;
  } catch (error) {
    return true;
  }
}
`;
    const filePath = path.join(this.constantsDir, 'RemoteNotification.ts');
    fs.writeFileSync(filePath, fileContent, 'utf8');
    console.log(`✅ Notification update created at: ${filePath}`);
    console.log(`   📌 Category: ${notification.categoryIdentifier}`);
    console.log(`   🔘 Buttons: ${this.getButtonsForCategory(notification.categoryIdentifier).join(', ')}`);
    return filePath;
  }

  async publishUpdate(message, options = {}) {
    const category = this.getCategoryForType(options.type, options);
    
    const notification = {
      id: this.generateId(),
      title: options.title || this.getDefaultTitle(options.type),
      body: message,
      type: options.type || 'custom',
      categoryIdentifier: category,
      cooldown: options.cooldown || 3600000,
      sound: true,
      data: options.data || {},
      createdAt: new Date().toISOString()
    };

    this.createNotificationUpdate(notification);

    console.log('📦 Building and publishing OTA update...');
    
    const cleanMessage = notification.title.replace(/[^\x00-\x7F]/g, '').trim();
    const command = `EAS_SKIP_AUTO_FINGERPRINT=1 CI=1 eas update --branch production --auto --message "${cleanMessage}"`;
    
    return new Promise((resolve, reject) => {
      exec(command, { 
        cwd: this.projectDir,
        maxBuffer: 10 * 1024 * 1024
      }, (error, stdout, stderr) => {
        if (error) {
          console.error('❌ Failed to publish:', error.message);
  console.error('❌ Failed to publish:', error);
  console.error('STDERR:', stderr);
  console.error('STDOUT:', stdout);
          reject(error);
          return;
        }
        
        console.log('✅ OTA Update published successfully!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`📧 Title: ${notification.title}`);
        console.log(`💬 Message: ${notification.body}`);
        console.log(`🏷️ Category: ${notification.categoryIdentifier}`);
        console.log(`🆔 ID: ${notification.id}`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('\n💡 The notification with buttons will appear when she opens the app!');
        resolve(notification);
      });
    });
  }

  getDefaultTitle(type) {
    const titles = {
      'love_message': '💕 Thinking of You',
      'memory_reminder': '📸 Memory Reminder', 
      'surprise': '🎁 Surprise',
      'mood_check': '🌙 How Are You Feeling?',
      'note_reminder': '📝 Note Reminder',
      'custom': '💌 Love Note'
    };
    return titles[type] || titles.custom;
  }

  // ==========================================================
  // PUBLIC METHODS - USE THESE
  // ==========================================================

  async sendLoveMessage(message, options = {}) {
    return await this.publishUpdate(message, {
      title: options.title || '💕 Thinking of You',
      type: 'love_message',
      category: 'love_message',
      data: {
        sender: 'Your Love',
        loveMessage: message,
        timestamp: new Date().toISOString(),
        ...options.data
      },
      ...options
    });
  }

  async sendMemoryReminder(memoryTitle, options = {}) {
    const message = `Remember when we had ${memoryTitle}? 💭`;
    return await this.publishUpdate(message, {
      title: options.title || '📸 Memory Reminder',
      type: 'memory_reminder',
      category: 'memory_reminder',
      data: {
        memory: memoryTitle,
        memoryId: options.memoryId || `memory_${Date.now()}`,
        ...options.data
      },
      ...options
    });
  }

  async sendMoodCheck(message, options = {}) {
    return await this.publishUpdate(message, {
      title: options.title || '🌙 Mood Check-in',
      type: 'mood_check',
      category: 'mood_check',
      data: {
        checkInTime: new Date().toISOString(),
        ...options.data
      },
      ...options
    });
  }

  async sendNoteReminder(noteTitle, options = {}) {
    const message = `Don't forget to read: ${noteTitle}`;
    return await this.publishUpdate(message, {
      title: options.title || '📝 Note Reminder',
      type: 'note_reminder',
      category: 'note_reminder',
      data: {
        noteTitle: noteTitle,
        noteId: options.noteId || `note_${Date.now()}`,
        ...options.data
      },
      ...options
    });
  }

  async sendSurprise(message, options = {}) {
    return await this.publishUpdate(message, {
      title: options.title || '🎁 Surprise',
      type: 'surprise',
      category: 'love_message',
      data: {
        surprise: true,
        message: message,
        ...options.data
      },
      ...options
    });
  }
}

// ==========================================================
// CLI INTERFACE
// ==========================================================
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const message = args.slice(1).join(' ');
  
  const sender = new RemoteNotificationSender(process.cwd());
  
  console.log('\n📱 Remote Notification Sender (with Buttons)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  if (!command || command === 'help') {
    console.log(`
Usage:
  node scripts/sendRemoteNotification.js love "Your message"        → 💌 Reply / ❤️ Send Love / Later
  node scripts/sendRemoteNotification.js memory "memory name"      → 📸 View / ⏰ Remind Later / Dismiss  
  node scripts/sendRemoteNotification.js mood "How was your day?"  → 😊 Happy / 🥰 Loved / 😢 Sad / Open App
  node scripts/sendRemoteNotification.js note "note title"         → 📖 Read / ⏰ Snooze / Dismiss
  node scripts/sendRemoteNotification.js surprise "message"        → 💌 Reply / ❤️ Send Love / Later

Examples:
  node scripts/sendRemoteNotification.js love "I was thinking about you"
  node scripts/sendRemoteNotification.js memory "our first date"
  node scripts/sendRemoteNotification.js mood "How are you feeling right now?"
  node scripts/sendRemoteNotification.js note "the sweet note I wrote you"
  node scripts/sendRemoteNotification.js surprise "Open the app for a gift"
`);
    return;
  }
  
  if (!message || message.length === 0) {
    console.error('❌ Please provide a message');
    console.log('Example: node scripts/sendRemoteNotification.js love "I love you"');
    return;
  }
  
  try {
    switch(command) {
      case 'love':
        await sender.sendLoveMessage(message);
        break;
      case 'memory':
        await sender.sendMemoryReminder(message);
        break;
      case 'mood':
        await sender.sendMoodCheck(message);
        break;
      case 'note':
        await sender.sendNoteReminder(message);
        break;
      case 'surprise':
        await sender.sendSurprise(message);
        break;
      default:
        console.error(`❌ Unknown command: ${command}`);
        console.log('Available commands: love, memory, mood, note, surprise');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = RemoteNotificationSender;
