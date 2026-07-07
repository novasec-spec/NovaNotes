// widget-task-handler.tsx
// Location: project root (same folder as your index.js) — this is what
// registerWidgetTaskHandler in index.js imports.
//
// This is the piece that was missing before: Android was showing the
// `previewImage` you configured in app.json forever because nothing ever
// told it what to actually render, and no element had a `clickAction` so
// taps did nothing.

import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { BubblesWidget } from './src/widgets/BubblesWidget';
import { getWidgetData } from './src/widgets/getWidgetData';

const nameToWidget = {
  // This key MUST match the "name" you gave the widget in app.json's
  // react-native-android-widget plugin config ("Bubbles").
  Bubbles: BubblesWidget,
};

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const widgetInfo = props.widgetInfo;
  const Widget = nameToWidget[widgetInfo.widgetName as keyof typeof nameToWidget];
  if (!Widget) return;

  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED': {
      const data = await getWidgetData();
      props.renderWidget(<Widget {...data} width={widgetInfo.width} height={widgetInfo.height} />);
      break;
    }

    case 'WIDGET_DELETED':
      // Nothing per-instance is stored right now, so no cleanup needed.
      // If you later add a configuration screen (e.g. "which mood set"),
      // clear that instance's saved config here using widgetInfo.widgetId.
      break;

    case 'WIDGET_CLICK': {
      // "OPEN_APP" and "OPEN_URI" (used for the note button) are handled
      // natively by the library and never reach here — this branch is only
      // for custom clickAction identifiers you define yourself.
      if (props.clickAction === 'refresh') {
        const data = await getWidgetData();
        props.renderWidget(<Widget {...data} width={widgetInfo.width} height={widgetInfo.height} />);
      }
      break;
    }

    default:
      break;
  }
}
