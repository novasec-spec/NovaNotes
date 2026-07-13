// ─────────────────────────────────────────────────────────────────────────────
//  chatSkeleton.tsx — animated shimmer placeholder shown in place of the
//  message list while the first page of messages is loading. The header
//  itself doesn't need a skeleton since otherUser is passed in as a prop
//  and is available immediately — only the message content is unknown.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Dimensions } from 'react-native';

const { width: W } = Dimensions.get('window');

function useShimmer() {
  const val = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(val, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(val, { toValue: 0.35, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return val;
}

function SkeletonBubble({ isOwn, widthPct, colors }: { isOwn: boolean; widthPct: number; colors: any }) {
  const opacity = useShimmer();
  return (
    <View style={[st.row, isOwn ? st.rowOwn : st.rowOther]}>
      {!isOwn && <View style={[st.avatar, { backgroundColor: colors.border }]} />}
      <Animated.View
        style={[
          st.bubble,
          { width: W * widthPct, backgroundColor: colors.border, opacity },
          isOwn ? st.bubbleOwn : st.bubbleOther,
        ]}
      />
    </View>
  );
}

const PATTERN = [
  { isOwn: false, w: 0.5 },
  { isOwn: false, w: 0.34 },
  { isOwn: true, w: 0.45 },
  { isOwn: false, w: 0.56 },
  { isOwn: true, w: 0.3 },
  { isOwn: true, w: 0.4 },
  { isOwn: false, w: 0.6 },
  { isOwn: true, w: 0.36 },
];

export default function ChatSkeleton({ colors }: { colors: any }) {
  return (
    <View style={[st.container, { backgroundColor: colors.background }]}>
      {PATTERN.map((p, i) => (
        <SkeletonBubble key={i} isOwn={p.isOwn} widthPct={p.w} colors={colors} />
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, padding: 14, paddingTop: 20 },
  row: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 14, gap: 8 },
  rowOwn: { justifyContent: 'flex-end' },
  rowOther: { justifyContent: 'flex-start' },
  avatar: { width: 30, height: 30, borderRadius: 15 },
  bubble: { height: 40, borderRadius: 18 },
  bubbleOwn: { borderBottomRightRadius: 5 },
  bubbleOther: { borderBottomLeftRadius: 5 },
});
