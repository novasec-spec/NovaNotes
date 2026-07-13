// src/widgets/BubblesWidget.tsx
"use no memo";
import React from 'react';
import { FlexWidget, TextWidget, IconWidget, ImageWidget } from 'react-native-android-widget';
import type { WidgetData } from './getWidgetData';

const NEW_NOTE_DEEP_LINK = 'novanote://notes';
const CHAT_DEEP_LINK = 'novanote://chat';

interface Props extends WidgetData {
  width?: number;
  height?: number;
}

export function BubblesWidget(props: Props) {
  const {
    quoteText,
    quoteAuthor,
    quoteCategory,
    streak,
    moodEmoji,
    moodColor,
    loveNote,
    dateLabel,
    userName,
    unreadCount,
    taskCount,
    dailyAffirmation,
    height = 110,
  } = props;

  const isExpanded = height >= 160;
  const isLarge = height >= 220;

  // Get category color
  const getCategoryColor = (category?: string): string => {
    const colors: Record<string, string> = {
      love: '#FF6B9D',
      motivation: '#F59E0B',
      faith: '#8B5CF6',
      wisdom: '#3B82F6',
      gratitude: '#22C55E',
    };
    return colors[category || 'love'] || '#FF6B9D';
  };

  const categoryColor = getCategoryColor(quoteCategory);

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: '#1A1A2E',
        borderRadius: 20,
        padding: 14,
        borderWidth: 1,
        borderColor: categoryColor + '44',
      }}
    >
      {/* Header row: date · userName · streak · mood */}
      <FlexWidget style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TextWidget text={dateLabel} style={{ fontSize: 11, color: '#B8B8D1' }} />
          <TextWidget text={` · ${userName}`} style={{ fontSize: 11, color: '#FF6B9D', fontWeight: 'bold', marginLeft: 4 }} />
        </FlexWidget>
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center' }}>
          {moodEmoji && (
            <FlexWidget
              style={{
                backgroundColor: (moodColor || '#FF6B9D') + '33',
                borderRadius: 12,
                paddingHorizontal: 6,
                paddingVertical: 2,
                marginRight: 6,
              }}
            >
              <TextWidget text={moodEmoji} style={{ fontSize: 14 }} />
            </FlexWidget>
          )}
          <FlexWidget style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FF6B9D22', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 }}>
            <TextWidget text="🔥" style={{ fontSize: 12 }} />
            <TextWidget text={`${streak}`} style={{ fontSize: 11, color: '#FF6B9D', fontWeight: 'bold', marginLeft: 2 }} />
          </FlexWidget>
        </FlexWidget>
      </FlexWidget>

      {/* Quote */}
      <FlexWidget style={{ flexDirection: 'column', flex: 1, justifyContent: 'center', marginVertical: 4 }}>
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TextWidget
            text={quoteCategory?.toUpperCase() || 'LOVE'}
            style={{ fontSize: 8, color: categoryColor, fontWeight: 'bold', letterSpacing: 1 }}
          />
        </FlexWidget>
        <TextWidget
          text={`“${quoteText}”`}
          style={{ fontSize: 14, color: '#FFFFFF', fontWeight: 'bold' }}
          maxLines={isLarge ? 4 : isExpanded ? 3 : 2}
          truncate="END"
        />
        <TextWidget text={`— ${quoteAuthor}`} style={{ fontSize: 11, color: '#B8B8D1', marginTop: 2 }} />
      </FlexWidget>

      {/* Expanded: Daily Affirmation */}
      {isExpanded && dailyAffirmation && (
        <FlexWidget
          style={{
            backgroundColor: '#FF6B9D15',
            borderRadius: 10,
            paddingHorizontal: 10,
            paddingVertical: 6,
            marginVertical: 4,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <TextWidget text="✨" style={{ fontSize: 12, marginRight: 6 }} />
          <TextWidget text={dailyAffirmation} style={{ fontSize: 11, color: '#FFD1E3' }} maxLines={1} truncate="END" />
        </FlexWidget>
      )}

      {/* Expanded: Love Note */}
      {isExpanded && loveNote && (
        <TextWidget
          text={`💌 ${loveNote}`}
          style={{ fontSize: 12, color: '#FFD1E3', marginVertical: 2 }}
          maxLines={2}
          truncate="END"
        />
      )}

      {/* Footer: Action Buttons */}
      <FlexWidget style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
        {/* Take a note button */}
        <FlexWidget
          clickAction="OPEN_URI"
          clickActionData={{ uri: NEW_NOTE_DEEP_LINK }}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#FF6B9D',
            borderRadius: 14,
            height: 32,
          }}
        >
          <TextWidget text="" style={{ fontSize: 14 }} />
          <TextWidget text="Note" style={{ fontSize: 12, color: '#ffffff', fontWeight: 'bold', marginLeft: 4 }} />
        </FlexWidget>

        {/* Chat button with badge */}
        <FlexWidget
          clickAction="OPEN_URI"
          clickActionData={{ uri: CHAT_DEEP_LINK }}
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#3B82F6',
            borderRadius: 14,
            height: 32,
            position: 'relative',
          }}
        >
          <TextWidget text="" style={{ fontSize: 14 }} />
          <TextWidget text="Chat" style={{ fontSize: 12, color: '#ffffff', fontWeight: 'bold', marginLeft: 4 }} />
          {unreadCount > 0 && (
            <FlexWidget
              style={{
                position: 'absolute',
                top: -4,
                right: -4,
                backgroundColor: '#EF4444',
                borderRadius: 10,
                paddingHorizontal: 5,
                paddingVertical: 1,
                minWidth: 18,
                alignItems: 'center',
              }}
            >
              <TextWidget text={unreadCount > 99 ? '99+' : String(unreadCount)} style={{ fontSize: 9, color: '#ffffff', fontWeight: 'bold' }} />
            </FlexWidget>
          )}
        </FlexWidget>

        {/* Tasks button */}
        {taskCount > 0 && (
          <FlexWidget
            clickAction="OPEN_URI"
            clickActionData={{ uri: 'novanote://tasks' }}
            style={{
              flex: 0.7,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#22C55E',
              borderRadius: 14,
              height: 32,
            }}
          >
            <TextWidget text="✅" style={{ fontSize: 14 }} />
            <TextWidget text={String(taskCount)} style={{ fontSize: 12, color: '#ffffff', fontWeight: 'bold', marginLeft: 4 }} />
          </FlexWidget>
        )}
      </FlexWidget>

      {/* Last updated */}
      {props.lastBackup && (
        <TextWidget
          text={`🔄 Updated ${new Date(props.lastBackup).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
          style={{ fontSize: 8, color: '#666', marginTop: 4, textAlign: 'center' }}
        />
      )}
    </FlexWidget>
  );
}
