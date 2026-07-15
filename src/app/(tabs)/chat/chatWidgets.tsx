// ─────────────────────────────────────────────────────────────────────────────
//  chatWidgets.tsx — small standalone pieces used inside the chat screen:
//  avatar, typing dots, date separator, voice player, reaction picker,
//  attachment sheet, image lightbox, and message bubble content.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Image, ActivityIndicator, StyleSheet,
  Animated, Dimensions, Modal, Pressable, Linking,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Audio } from 'expo-av';
import {
  PINK, WHITE, SUCCESS, REACTIONS, ChatMessage, User,
  fmtDur, haptic, isUrl, getInitials, avatarColor,
} from './chatShared';
import { showChatAlert } from './chatAlertModal';

const { width: W, height: H } = Dimensions.get('window');

// ── Online pulse ──────────────────────────────────────────────────────────
export function OnlinePulse() {
  const scale = useRef(new Animated.Value(1)).current;
  const opac = useRef(new Animated.Value(0.8)).current;
  useEffect(() => {
    Animated.loop(Animated.parallel([
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.8, duration: 900, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(opac, { toValue: 0, duration: 900, useNativeDriver: true }),
        Animated.timing(opac, { toValue: 0.8, duration: 900, useNativeDriver: true }),
      ]),
    ])).start();
  }, []);
  return (
    <View style={{ position: 'absolute', bottom: -1, right: -1, width: 18, height: 18, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{
        position: 'absolute', width: 16, height: 16, borderRadius: 8,
        backgroundColor: SUCCESS, transform: [{ scale }], opacity: opac,
      }} />
      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: SUCCESS, borderWidth: 2, borderColor: WHITE }} />
    </View>
  );
}

// ── Avatar ────────────────────────────────────────────────────────────────
export function ChatAvatar({ uri, name, userId, size = 40, online, onPress }: {
  uri?: string; name?: string; userId?: string; size?: number; online?: boolean; onPress?: () => void;
}) {
  const [err, setErr] = useState(false);
  const bg = userId ? avatarColor(userId) : PINK;
  const initials = getInitials(name);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={onPress ? 0.7 : 1} style={{ position: 'relative' }}>
      {uri && !err ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          onError={() => setErr(true)}
        />
      ) : (
        <View style={{
          width: size, height: size, borderRadius: size / 2,
          backgroundColor: bg, alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ fontSize: size * 0.38, color: WHITE, fontWeight: '700' }}>
            {initials || '?'}
          </Text>
        </View>
      )}
      {online && <OnlinePulse />}
    </TouchableOpacity>
  );
}

// ── Typing dots ───────────────────────────────────────────────────────────
export function TypingDots({ color = WHITE }: { color?: string }) {
  const dots = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

  useEffect(() => {
    const anims = dots.map((d, i) =>
      Animated.loop(Animated.sequence([
        Animated.delay(i * 120),
        Animated.timing(d, { toValue: 1, duration: 330, useNativeDriver: true }),
        Animated.timing(d, { toValue: 0, duration: 330, useNativeDriver: true }),
      ]))
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, []);

  return (
    <View style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
      {dots.map((d, i) => (
        <Animated.View key={i} style={{
          width: 8, height: 8, borderRadius: 4, backgroundColor: color,
          opacity: d.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
          transform: [{ translateY: d.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) }],
        }} />
      ))}
    </View>
  );
}

// ── Date separator ────────────────────────────────────────────────────────
export function DateSep({ label, colors }: { label: string; colors: any }) {
  return (
    <View style={{ alignItems: 'center', marginVertical: 16 }}>
      <View style={{
        backgroundColor: colors.card,
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 14,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 1,
      }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.muted, letterSpacing: 0.5 }}>
          {label}
        </Text>
      </View>
    </View>
  );
}

// ── Voice player ──────────────────────────────────────────────────────────
export function VoicePlayer({ uri, isOwn }: { uri: string; isOwn: boolean }) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(0);
  const [loading, setLoading] = useState(false);
  const [speed, setSpeed] = useState(1.0);

  useEffect(() => () => { sound?.unloadAsync(); }, [sound]);

  const toggle = async () => {
    if (playing && sound) { await sound.pauseAsync(); setPlaying(false); return; }
    if (sound) { await sound.playAsync(); setPlaying(true); return; }
    setLoading(true);
    try {
      const { sound: s } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true },
        (st) => {
          if (!st.isLoaded) return;
          setPos(st.positionMillis / 1000);
          setDur((st.durationMillis ?? 0) / 1000);
          setPlaying(st.isPlaying);
          if (st.didJustFinish) { setPlaying(false); setPos(0); s.setPositionAsync(0); }
        }
      );
      setSound(s);
      await s.setRateAsync(speed, true);
    } catch { showChatAlert('Error', 'Cannot play voice note'); }
    setLoading(false);
  };

  const cycleSpeed = async () => {
    const next = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
    setSpeed(next);
    await sound?.setRateAsync(next, true);
    haptic('light');
  };

  const prog = dur > 0 ? pos / dur : 0;
  const tc = isOwn ? 'rgba(255,255,255,0.9)' : PINK;
  const fill = isOwn ? WHITE : PINK;
  const bg = isOwn ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.05)';

  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 12,
      padding: 12, borderRadius: 14, backgroundColor: bg,
      minWidth: 180, marginBottom: 4,
    }}>
      <TouchableOpacity onPress={toggle}>
        {loading ? (
          <ActivityIndicator size={28} color={tc} />
        ) : (
          <Icon name={playing ? 'pause-circle' : 'play-circle'} size={34} color={tc} />
        )}
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <View style={{
          height: 4, borderRadius: 2,
          backgroundColor: isOwn ? 'rgba(255,255,255,0.3)' : '#ddd',
          overflow: 'hidden',
        }}>
          <View style={{ height: 4, borderRadius: 2, width: `${prog * 100}%`, backgroundColor: fill }} />
        </View>
        <Text style={{ fontSize: 11, marginTop: 4, color: tc }}>{fmtDur(dur || pos)}</Text>
      </View>
      <TouchableOpacity onPress={cycleSpeed}>
        <Text style={{ fontSize: 11, fontWeight: '800', color: tc }}>{speed}×</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Reaction picker ───────────────────────────────────────────────────────
export function ReactionPicker({ onSelect, onClose }: { onSelect: (e: string) => void; onClose: () => void }) {
  const scale = useRef(new Animated.Value(0.5)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 100, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Pressable
      style={{
        position: 'absolute', inset: 0,
        justifyContent: 'center', alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.25)',
      }}
      onPress={onClose}
    >
      <Animated.View style={{
        flexDirection: 'row',
        backgroundColor: WHITE,
        borderRadius: 40,
        padding: 10,
        gap: 2,
        transform: [{ scale }],
        opacity,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 12,
      }}>
        {REACTIONS.map(e => (
          <TouchableOpacity
            key={e}
            onPress={() => { onSelect(e); onClose(); }}
            style={{
              width: 48, height: 48,
              alignItems: 'center', justifyContent: 'center',
              borderRadius: 24,
            }}
          >
            <Text style={{ fontSize: 28 }}>{e}</Text>
          </TouchableOpacity>
        ))}
      </Animated.View>
    </Pressable>
  );
}

// ── Attachment sheet ──────────────────────────────────────────────────────
export function AttachSheet({ visible, onClose, onPick }: {
  visible: boolean; onClose: () => void;
  onPick: (t: 'gallery' | 'camera' | 'document' | 'location') => void;
}) {
  if (!visible) return null;
  const OPTIONS = [
    { icon: 'images', color: '#3B82F6', label: 'Gallery', key: 'gallery' },
    { icon: 'camera', color: PINK, label: 'Camera', key: 'camera' },
    { icon: 'document-text', color: '#F59E0B', label: 'Document', key: 'document' },
    { icon: 'location', color: SUCCESS, label: 'Location', key: 'location' },
  ] as const;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}
        onPress={onClose}
      >
        <View style={{
          backgroundColor: WHITE,
          borderTopLeftRadius: 32,
          borderTopRightRadius: 32,
          padding: 24,
          paddingBottom: 40,
        }}>
          <View style={{
            width: 40, height: 4, borderRadius: 2,
            backgroundColor: '#DDD', alignSelf: 'center',
            marginBottom: 20,
          }} />
          <Text style={{
            fontSize: 18, fontWeight: '700',
            textAlign: 'center', marginBottom: 24,
          }}>Share</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
            {OPTIONS.map(o => (
              <TouchableOpacity
                key={o.key}
                onPress={() => { onPick(o.key as any); onClose(); }}
                style={{ alignItems: 'center', gap: 8 }}
              >
                <View style={{
                  width: 64, height: 64, borderRadius: 32,
                  backgroundColor: o.color + '18',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon name={o.icon} size={30} color={o.color} />
                </View>
                <Text style={{ fontSize: 12, color: '#666', fontWeight: '600' }}>{o.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={{
              marginTop: 20, padding: 14, borderRadius: 14,
              backgroundColor: '#F5F5F5', alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: '600', color: '#888' }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
}

// ── Image lightbox ───────────────────────────────────────────────────────
export function Lightbox({ uri, onClose }: { uri: string | null; onClose: () => void }) {
  if (!uri) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={{
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.97)',
        justifyContent: 'center',
        alignItems: 'center',
      }}>
        <TouchableOpacity
          onPress={onClose}
          style={{
            position: 'absolute', top: 52, right: 20,
            zIndex: 10, padding: 8,
          }}
        >
          <Icon name="close-circle" size={40} color={WHITE} />
        </TouchableOpacity>
        <Image
          source={{ uri }}
          style={{ width: W, height: H * 0.8 }}
          resizeMode="contain"
        />
      </View>
    </Modal>
  );
}

// ── Message bubble content ───────────────────────────────────────────────
export function BubbleContent({
  msg,
  isOwn,
  isDeleted,
  replyMsg,
  colors,
  user,
  otherUser,
  onImagePress,
}: {
  msg: ChatMessage;
  isOwn: boolean;
  isDeleted: boolean;
  replyMsg?: ChatMessage;
  colors: any;
  user: User;
  otherUser: User;
  onImagePress: (uri: string) => void;
}) {
  if (isDeleted) {
    return (
      <Text style={{
        fontSize: 13,
        fontStyle: 'italic',
        color: isOwn ? 'rgba(255,255,255,0.7)' : colors.muted,
      }}>
        This message was deleted
      </Text>
    );
  }

  if (msg.call_id) {
    return <CallBubbleContent msg={msg} isOwn={isOwn} colors={colors} />;
  }

  const textColor = isOwn ? WHITE : colors.text;

  return (
    <>
      {/* Reply quote */}
      {replyMsg && (
        <View style={[bc.replyQuote, {
          borderLeftColor: isOwn ? 'rgba(255,255,255,0.6)' : PINK,
          backgroundColor: isOwn ? 'rgba(255,255,255,0.12)' : PINK + '12',
        }]}>
          <Text style={[bc.replyUser, { color: isOwn ? 'rgba(255,255,255,0.9)' : PINK }]}>
            {replyMsg.sender_id === user.id ? 'You' : otherUser.username}
          </Text>
          <Text style={[bc.replyText, { color: isOwn ? 'rgba(255,255,255,0.75)' : colors.muted }]} numberOfLines={2}>
            {replyMsg.text || 'Media'}
          </Text>
        </View>
      )}

      {/* Image */}
      {(msg._localImageUri || msg.image_url) && (
        <TouchableOpacity
          onPress={() => onImagePress((msg._localImageUri || msg.image_url)!)}
          activeOpacity={0.9}
        >
          <Image
            source={{ uri: msg._localImageUri || msg.image_url }}
            style={bc.image}
            resizeMode="cover"
          />
          {msg._sendStatus === 'sending' && (
            <View style={bc.imageOverlay}>
              <ActivityIndicator size="large" color={WHITE} />
            </View>
          )}
        </TouchableOpacity>
      )}

      {/* Video */}
      {(msg._localVideoUri || msg.video_url) && (
        <TouchableOpacity
          onPress={() => onImagePress((msg._localVideoUri || msg.video_url)!)}
          activeOpacity={0.9}
          style={{ position: 'relative' }}
        >
          <Image
            source={{ uri: msg._localVideoUri || msg.video_url }}
            style={bc.image}
            resizeMode="cover"
          />
          <View style={bc.videoOverlay}>
            <Icon name="play-circle" size={50} color={WHITE} />
          </View>
        </TouchableOpacity>
      )}

      {/* Audio */}
      {msg.audio_url && (
        <VoicePlayer uri={msg._localAudioUri || msg.audio_url} isOwn={isOwn} />
      )}

      {/* File */}
      {msg.file_url && !msg.image_url && !msg.audio_url && !msg.video_url && (
        <TouchableOpacity
          style={[bc.fileRow, {
            backgroundColor: isOwn ? 'rgba(255,255,255,0.15)' : colors.background,
          }]}
          onPress={() => msg.file_url && Linking.openURL(msg.file_url)}
        >
          <MCIcon name="file-outline" size={24} color={isOwn ? WHITE : PINK} />
          <Text style={[bc.fileName, { color: textColor }]} numberOfLines={1}>
            {msg.file_name || 'File'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Text with auto-link */}
      {!!msg.text && (
        isUrl(msg.text) ? (
          <Text
            style={[bc.text, {
              color: isOwn ? WHITE : PINK,
              textDecorationLine: 'underline',
            }]}
            onPress={() => Linking.openURL(msg.text!)}
          >
            {msg.text}
          </Text>
        ) : (
          <Text style={[bc.text, { color: textColor }]}>
            {msg.text}
          </Text>
        )
      )}
    </>
  );
}

// ── Call bubble content ───────────────────────────────────────────────────
// Rendered instead of the normal text/media content whenever a message is
// a call log (msg.call_id set — written by CallService.logCallToChat).
// sender_id on these messages is always the caller, so `isOwn` here means
// "I made this call" and !isOwn means "I received this call" — that's all
// that's needed to pick the right label for each side of the same row.
function CallBubbleContent({ msg, isOwn, colors }: { msg: ChatMessage; isOwn: boolean; colors: any }) {
  const isVideo = msg.call_type === 'video';
  const status = msg.call_status ?? 'completed';
  const missed = status === 'missed' || status === 'cancelled' || status === 'declined';

  const label = (() => {
    if (status === 'completed') return fmtDur(msg.call_duration ?? 0);
    if (status === 'declined') return isOwn ? 'Call declined' : 'You declined';
    // 'missed' and 'cancelled' both read as a missed call to whoever
    // didn't place it, and as "no answer" to whoever did.
    return isOwn ? 'No answer' : 'Missed call';
  })();

  const iconColor = isOwn ? WHITE : (missed ? '#EF4444' : PINK);
  const textColor = isOwn ? WHITE : (missed ? '#EF4444' : colors.text);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 }}>
      <Icon name={isVideo ? 'videocam' : 'call'} size={18} color={iconColor} />
      <Text style={{ fontSize: 14, fontWeight: '600', color: textColor }}>
        {isVideo ? 'Video call' : 'Voice call'} · {label}
      </Text>
    </View>
  );
}

const bc = StyleSheet.create({
  replyQuote: {
    borderLeftWidth: 3,
    paddingLeft: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 8,
  },
  replyUser: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  replyText: {
    fontSize: 13,
  },
  image: {
    width: 220,
    height: 170,
    borderRadius: 14,
    marginBottom: 6,
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoOverlay: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -25,
    marginLeft: -25,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    marginBottom: 4,
  },
  fileName: {
    flex: 1,
    fontSize: 13,
  },
  text: {
    fontSize: 15,
    lineHeight: 21,
  },
});
