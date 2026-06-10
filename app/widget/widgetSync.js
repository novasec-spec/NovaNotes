import { setItem, reloadAll, getItem } from "fumedeme-expo-widget";
import { getAllWidgetData } from './dataManager';

// Use the same group ID as in app.json
const GROUP_ID = "group.expo.modules.moodtracker.example";

// Update widget with latest data
export const updateWidget = async () => {
  try {
    // Get fresh data from storage
    const widgetData = await getAllWidgetData();
    
    // Set all widget data
    setItem("mood", widgetData.mood, GROUP_ID);
    setItem("moodEmoji", widgetData.moodEmoji, GROUP_ID);
    setItem("quote", widgetData.quote, GROUP_ID);
    setItem("specialDateDisplay", widgetData.specialDateDisplay, GROUP_ID);
    setItem("lastUpdated", widgetData.timestamp, GROUP_ID);
    
    // Force widget to refresh
    reloadAll();
    
    console.log("✅ Widget updated successfully:", widgetData);
    return true;
  } catch (error) {
    console.error("❌ Widget update failed:", error);
    return false;
  }
};

// Read current widget data (for debugging)
export const getWidgetData = () => {
  try {
    return {
      mood: getItem("mood", GROUP_ID),
      moodEmoji: getItem("moodEmoji", GROUP_ID),
      quote: getItem("quote", GROUP_ID),
      specialDateDisplay: getItem("specialDateDisplay", GROUP_ID),
      lastUpdated: getItem("lastUpdated", GROUP_ID)
    };
  } catch (error) {
    console.error("Error reading widget data:", error);
    return null;
  }
};

// Force immediate widget refresh
export const refreshWidget = () => {
  try {
    reloadAll();
    console.log("🔄 Widget refresh triggered");
    return true;
  } catch (error) {
    console.error("❌ Widget refresh failed:", error);
    return false;
  }
};
