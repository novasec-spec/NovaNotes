// ─────────────────────────────────────────────────────────────────────────────
//  widgets/BubblesWidget.tsx
// ─────────────────────────────────────────────────────────────────────────────
//
//  This is your widget's UI — written ENTIRELY in React.
//  No XML, no Kotlin. These special components map to native Android
//  RemoteViews under the hood:
//
//    FlexWidget   → LinearLayout / FrameLayout (flexbox-style)
//    TextWidget   → TextView
//    ImageWidget  → ImageView
//
//  ⚠️ You CANNOT use regular <View>, <Text>, ScrollView, etc. here —
//  only the *Widget primitives from 'react-native-android-widget'.
//  No hooks, no useState — this renders ONCE per data update via the
//  task handler (widget-task-handler.tsx).
//
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

// ── Props — passed in by widget-task-handler.tsx every refresh ───────────────
export interface BubblesWidgetProps {
  herName:     string;   // "Alice"
  quote:       string;
  quoteAuthor: string;
  moodEmoji:   string;   // "😊"
  moodLabel:   string;   // "Feeling good"
  streak:      number;
  loveNote:    string;   // preview of latest love note
  updatedAt:   string;   // "Updated 3:45 PM"
}

// ── Colours — matches your app's pastel theme ────────────────────────────────
const PINK      = '#FF6B9D';
const TEXT_DARK = '#3A1A2E';
const TEXT_SOFT = '#C4A0B8';
const BG        = '#FEFAFB';
const BORDER    = '#FFD6E8';

export function BubblesWidget(props: BubblesWidgetProps) {
  const {
    herName     = 'Alice',
    quote       = 'You are my favourite person 💕',
    quoteAuthor = '— with love',
    moodEmoji   = '😊',
    moodLabel   = 'Feeling good',
    streak      = 1,
    loveNote    = 'Something sweet is waiting for you 🌸',
    updatedAt   = '',
  } = props;

  return (
    <FlexWidget
      style={{
        height:          'match_parent',
        width:           'match_parent',
        flexDirection:   'column',
        backgroundColor: BG,
        borderRadius:    20,
        padding:         14,
        borderColor:     BORDER,
        // clickAction makes the WHOLE widget tappable — opens the app
        // (handled in widget-task-handler.tsx via clickActionData)
      }}
      clickAction="OPEN_APP"
    >
      {/* ── Top row: greeting + mood ── */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          alignItems:    'center',
          width:         'match_parent',
          marginBottom:  8,
        }}
      >
        <TextWidget
          text={`Hey ${herName} 💕`}
          style={{
            fontSize:   13,
            color:      PINK,
            fontWeight: 'bold',
            flex:       1,
          }}
        />
        <TextWidget
          text={moodEmoji}
          style={{ fontSize: 20, marginRight: 4 }}
        />
        <TextWidget
          text={moodLabel}
          style={{ fontSize: 11, color: TEXT_SOFT }}
        />
      </FlexWidget>

      {/* ── Divider ── */}
      <FlexWidget
        style={{
          height:          1,
          width:           'match_parent',
          backgroundColor: BORDER,
          marginBottom:    10,
        }}
      />

      {/* ── Quote ── */}
      <TextWidget
        text={`"${quote}"`}
        style={{
          fontSize:   13,
          color:      TEXT_DARK,
          fontStyle:  'italic',
          marginBottom: 2,
        }}
        maxLines={3}
      />
      <TextWidget
        text={quoteAuthor}
        style={{
          fontSize:   11,
          color:      PINK,
          fontWeight: 'bold',
          marginBottom: 10,
        }}
      />

      {/* ── Divider ── */}
      <FlexWidget
        style={{
          height:          1,
          width:           'match_parent',
          backgroundColor: BORDER,
          marginBottom:    8,
        }}
      />

      {/* ── Bottom row: love note preview + streak ── */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          alignItems:    'center',
          width:         'match_parent',
        }}
      >
        <TextWidget
          text={loveNote}
          style={{
            fontSize: 11,
            color:    TEXT_SOFT,
            flex:     1,
            marginRight: 8,
          }}
          maxLines={2}
        />
        <FlexWidget
          style={{
            backgroundColor: '#FFE4EE',
            borderRadius:    12,
            paddingVertical: 4,
            paddingHorizontal: 8,
          }}
        >
          <TextWidget
            text={`${streak} day${streak !== 1 ? 's' : ''} 🔥`}
            style={{ fontSize: 11, color: PINK, fontWeight: 'bold' }}
          />
        </FlexWidget>
      </FlexWidget>

      {/* ── Updated time ── */}
      {updatedAt ? (
        <TextWidget
          text={updatedAt}
          style={{ fontSize: 9, color: TEXT_SOFT, marginTop: 6 }}
        />
      ) : null}
    </FlexWidget>
  );
}
