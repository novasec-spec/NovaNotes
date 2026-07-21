// ─────────────────────────────────────────────────────────────────────────────
//  chatHeader.tsx — top bar: back button, avatar + name + status/typing,
//  voice/video call buttons, search toggle, settings button.
//
//  Bug fixes vs. the original inline header:
//   - Removed the leftover "Voice Call — coming soon" placeholder button that
//     was left behind after real calling was wired up (it just showed a fake
//     alert and duplicated the real call button next to it).
//   - Removed a stray `// For video call variant` line that sat directly in
//     JSX between the two call buttons — in JSX that isn't a comment, it's
//     literal text, so it was rendering as visible text in the header.
//   - The video/voice call buttons referenced `styles.callButton`, which was
//     never defined (the stylesheet only had `headerCallButton` and `hdrBtn`),
//     so the buttons had no size/shape. They now use a real, defined style.
//   - Call icons were hardcoded blue (#007AFF) on a pink gradient header,
//     which was low-contrast; they now use white/translucent-white to match
//     the rest of the header.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { Alert, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { ChatAvatar, TypingDots } from './chatWidgets';
import { GRADIENT, WHITE, SUCCESS, User, fmtTime, haptic } from './chatShared';
import { showChatAlert } from './chatAlertModal';
import { s } from './chatStyles';
import { useRouter } from 'expo-router';
import  CallService  from '../../../services/CallService';

interface Props {
  otherUser: User;
  isOnline: boolean;
  otherTyping: boolean;
  showSearch: boolean;
  onBack: () => void;
  onAvatarPress: () => void;
  onToggleSearch: () => void;
  onSettingsPress: () => void;
}

export default function ChatHeader({
  otherUser, isOnline, otherTyping, showSearch,
  onBack, onAvatarPress, onToggleSearch, onSettingsPress,
}: Props) {
const router = useRouter();

const startVideoCall = async () => {
  try {
    const call = await CallService.initiateCall(otherUser.id, 'video');

    // Call creation failed
    if (!call) {
      Alert.alert('Call Failed', 'Unable to start the call. Please try again.');
      return;
    }

    // Navigate to calling screen
    router.push({
      pathname: '/CallingScreen',
      params: {
        callId: call.id,
        otherUserId: otherUser.id,
        otherUserName: otherUser.username,
        otherUserAvatar: otherUser.avatar_url ?? '',
        type: 'video',
      },
    });
  } catch (error) {
    console.error('Failed to start call:', error);
    Alert.alert('Error', 'Failed to initiate call.');
  }
};

const startAudioCall = async () => {
  const call = await CallService.initiateCall(otherUser.id, 'audio');

  if (!call) return;

  router.push({
    pathname: '/CallingScreen',
    params: {
      callId: call.id,
      otherUserId: otherUser.id,
      otherUserName: otherUser.username,
      otherUserAvatar: otherUser.avatar_url ?? '',
      type: 'audio',
    },
  });
};
  
  return (
    <LinearGradient
      colors={GRADIENT}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={s.header}
    >
      <TouchableOpacity onPress={onBack} style={s.hdrBtn} activeOpacity={0.7}>
        <Icon name="arrow-back" size={24} color={WHITE} />
      </TouchableOpacity>

      <TouchableOpacity
        style={s.hdrInfo}
        onPress={onAvatarPress}
        activeOpacity={0.8}
      >
        <ChatAvatar
          uri={otherUser.avatar_url}
          name={otherUser.username}
          userId={otherUser.id}
          size={42}
          online={isOnline}
          onPress={onAvatarPress}
        />
        <View style={{ marginLeft: 12, flex: 1 }}>
          <Text style={s.hdrName} numberOfLines={1}>
            {otherUser.display_name || otherUser.username}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {otherTyping ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <TypingDots color="rgba(255,255,255,0.8)" />
                <Text style={s.hdrStatus}>typing...</Text>
              </View>
            ) : (
              <>
                {isOnline && <View style={s.hdrOnlineDot} />}
                <Text style={s.hdrStatus}>
                  {isOnline ? 'Online' : `Last seen ${fmtTime(otherUser.last_seen || new Date().toISOString())}`}
                </Text>
              </>
            )}
          </View>
        </View>
      </TouchableOpacity>
<TouchableOpacity
  style={s.hdrBtn}
  onPress={startAudioCall}
>
  <Icon
    name="call"
    size={22}
    color={WHITE}
  />
</TouchableOpacity>

<TouchableOpacity
  style={s.hdrBtn}
  onPress={startVideoCall}
>
  <Icon
    name="videocam"
    size={22}
    color={WHITE}
  />
</TouchableOpacity>
      <View style={{ flexDirection: 'row', gap: 2 }}>
        <TouchableOpacity
          style={s.hdrBtn}
          onPress={onToggleSearch}
        >
          <Icon name={showSearch ? 'close' : 'search'} size={22} color={WHITE} />
        </TouchableOpacity>
        <TouchableOpacity
          style={s.hdrBtn}
          onPress={onSettingsPress}
        >
          <Icon name="ellipsis-vertical" size={22} color={WHITE} />
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const headerStyles = StyleSheet.create({
  callBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
});
