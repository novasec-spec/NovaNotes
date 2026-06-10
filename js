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

  // Ensure constants directory exists
  ensureConstantsDir() {
    if (!fs.existsSync(this.constantsDir)) {
      fs.mkdirSync(this.constantsDir, { recursive: true });
      console.log('✅ Created constants directory');
    }
  }

  // Generate unique ID
  generateId() {
    return crypto.randomBytes(8).toString('hex');
  }

  // Create the notification update file with proper formatting
  createNotificationUpdate(notification) {
    this.ensureConstantsDir();
    
    const fileContent = `// constants/RemoteNotification.ts
// AUTO-GENERATED - DO NOT EDIT MANUALLY
// Last updated: ${new Date().toISOString()}
// Notification ID: ${notification.id}

export interface RemoteNotification {
  id: string;
  title: string;
  body: string;
  type: 'love_message' | 'memory_reminder' | 'surprise' | 'custom';
  cooldown?: number;
  sound?: boolean;
  data?: any;
  createdAt: string;
}

export const REMOTE_NOTIFICATION: RemoteNotification = {
  id: '${notification.id}',
  title: '${notification.title.replace(/'/g, "\\'")}',
  body: '${notification.body.replace(/'/g, "\\'")}',
  type: '${notification.type}',
  cooldown: ${notification.cooldown || 3600000},
  sound: true,
  data: ${JSON.stringify(notification.data || {})},
  createdAt: '${new Date().toISOString()}'
};

export function shouldShowNotification(): boolean {
  try {
    const lastShownKey = \`last_notification_\${REMOTE_NOTIFICATION.id}\`;
    const lastShown = localStorage?.getItem(lastShownKey);
    const now = Date.now();
    
    if (lastShown && now - parseInt(lastShown) < (REMOTE_NOTIFICATION.cooldown || 3600000)) {
      return false;
    }
    
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(lastShownKey, now.toString());
    }
    
    return true;
  } catch (error) {
    return true;
  }
}
`;

    const filePath = path.join(this.constantsDir, 'RemoteNotification.ts');
    fs.writeFileSync(filePath, fileContent);
    console.log(`✅ Notification update created at: ${filePath}`);
    return filePath;
  }

  // Build and publish OTA update
  async publishUpdate(message, options = {}) {
    const notification = {
      id: this.generateId(),
      title: options.title || this.getDefaultTitle(options.type),
      body: message,
      type: options.type || 'custom',
      cooldown: options.cooldown || 3600000,
      data: options.data || {},
      createdAt: new Date().toISOString()
    };

    // Create the update file
    this.createNotificationUpdate(notification);

    // Build and publish using eas update
    console.log('📦 Building and publishing OTA update...');
    
    return new Promise((resolve, reject) => {
      const command = 'EAS_SKIP_AUTO_FINGERPRINT=1 CI=1 eas update --branch production --message "notification again"' + notification.title + '"';
      
      exec(command, { cwd: this.projectDir }, (error, stdout, stderr) => {
        if (error) {
          console.error('❌ Failed to publish:', error);
          reject(error);
          return;
        }
        
        console.log('✅ OTA Update published successfully!');
        console.log('📱 The app will show the notification on next load');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`📧 Title: ${notification.title}`);
        console.log(`💬 Message: ${notification.body}`);
        console.log(`🆔 ID: ${notification.id}`);
        console.log(`⏰ Cooldown: ${notification.cooldown / 60000} minutes`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('\n💡 Tip: The notification will appear when she opens the app');
        resolve(notification);
      });
    });
  }

  getDefaultTitle(type) {
    const titles = {
      'love_message': '💕 Thinking of You',
      'memory_reminder': '📸 Memory Reminder', 
      'surprise': '🎁 Surprise!',
      'custom': '💌 Love Note'
    };
    return titles[type] || titles.custom;
  }

  // Send a love message
  async sendLoveMessage(message, options = {}) {
    return await this.publishUpdate(message, {
      title: options.title || '💕 Thinking of You',
      type: 'love_message',
      ...options
    });
  }

  // Send a memory reminder
  async sendMemoryReminder(memoryTitle, options = {}) {
    const message = `Remember when we had ${memoryTitle}? 💭`;
    return await this.publishUpdate(message, {
      title: options.title || '📸 Memory Reminder',
      type: 'memory_reminder',
      data: { memory: memoryTitle },
      ...options
    });
  }

  // Send a surprise notification
  async sendSurprise(message, options = {}) {
    return await this.publishUpdate(message, {
      title: options.title || '🎁 Surprise!',
      type: 'surprise',
      ...options
    });
  }

  // Send scheduled notification (for future)
  async sendScheduled(message, options = {}) {
    return await this.publishUpdate(message, {
      type: 'custom',
      ...options
    });
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const message = args[1];
  
  const sender = new RemoteNotificationSender(process.cwd());
  
  console.log('\n📱 Remote Notification Sender');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  switch(command) {
    case 'love':
      await sender.sendLoveMessage(message || 'Just thinking about you! 💕');
      break;
    case 'memory':
      await sender.sendMemoryReminder(message || 'that special moment');
      break;
    case 'surprise':
      await sender.sendSurprise(message || 'Something special is waiting for you! 🎁');
      break;
    case 'custom':
      const title = args[2] || '💌 Love Note';
      await sender.sendScheduled(message, { title });
      break;
    default:
      console.log(`
Usage:
  node scripts/sendRemoteNotification.js love "Your message here"
  node scripts/sendRemoteNotification.js memory "our first date"  
  node scripts/sendRemoteNotification.js surprise "Check the app!"
  node scripts/sendRemoteNotification.js custom "Custom message" "Custom Title"

Examples:
  node scripts/sendRemoteNotification.js love "I miss you so much! 💕"
  node scripts/sendRemoteNotification.js memory "our trip to the beach"
  node scripts/sendRemoteNotification.js surprise "Open the app for a special gift!"
      `);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = RemoteNotificationSender;
