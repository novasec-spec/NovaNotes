// src/widgets/BubblesWidget.tsx
import React from 'react';
import { FlexWidget, TextWidget, IconWidget } from 'react-native-android-widget';
import type { WidgetData } from './getWidgetData';

// Change this if your "new note" screen lives at a different deep-link path.
// Requires `"scheme": "novanotes"` in app.json — see README-WIDGET.md.
const NEW_NOTE_DEEP_LINK = 'novanotes://notes';

interface Props extends WidgetData {
  /** Current widget size in dp, passed from the task handler so the layout can adapt. */
  width?: number;
  height?: number;
}

export function BubblesWidget(props: Props) {
  const { quoteText, quoteAuthor, streak, moodEmoji, loveNote, dateLabel, height = 110 } = props;

  const isExpanded = height >= 160; // resized taller — show the love note line too

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: '#1A1A2Ecc',
        borderRadius: 20,
        padding: 14,
      }}
    >
      {/* Header row: date · streak · mood */}
      <FlexWidget style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <TextWidget text={dateLabel} style={{ fontSize: 12, color: '#B8B8D1' }} />
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center' }}>
          {moodEmoji && <TextWidget text={moodEmoji} style={{ fontSize: 14, marginEnd: 6 }} />}
          <TextWidget text={`🔥 ${streak}`} style={{ fontSize: 12, color: '#FF6B9D', fontWeight: 'bold' }} />
        </FlexWidget>
      </FlexWidget>

      {/* Quote */}
      <FlexWidget style={{ flexDirection: 'column', flex: 1, justifyContent: 'center' }}>
        <TextWidget
          text={`“${quoteText}”`}
          style={{ fontSize: 14, color: '#FFFFFF', fontWeight: 'bold' }}
          maxLines={isExpanded ? 4 : 2}
          truncate="END"
        />
        <TextWidget text={`— ${quoteAuthor}`} style={{ fontSize: 11, color: '#B8B8D1', marginTop: 2 }} />
      </FlexWidget>

      {/* Optional love note, only shown when the widget has been resized taller */}
      {isExpanded && loveNote && (
        <TextWidget
          text={`💌 ${loveNote}`}
          style={{ fontSize: 12, color: '#FFD1E3', marginTop: 6 }}
          maxLines={2}
          truncate="END"
        />
      )}

      {/* Footer: take-a-note button */}
      <FlexWidget
        clickAction="OPEN_URI"
        clickActionData={{ uri: NEW_NOTE_DEEP_LINK }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#FF6B9D',
          borderRadius: 14,
          height: 32,
          marginTop: 8,
        }}
      >
        <IconWidget font="material" icon="add" size={16} color="#ffffff" />
        <TextWidget text="Take a note" style={{ fontSize: 13, color: '#ffffff', fontWeight: 'bold', marginStart: 4 }} />
      </FlexWidget>
    </FlexWidget>
  );
}
