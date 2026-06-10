import SwiftUI
import WidgetKit

// MARK: - Data Models
struct WidgetData: Codable {
    let text: String
    let timestamp: String
}

// MARK: - Timeline Entry
struct WidgetEntry: TimelineEntry {
    let date: Date
    let data: String
    let lastUpdate: String
}

// MARK: - Data Manager
class WidgetDataManager {
    static let shared = WidgetDataManager()
    
    func getData() -> String {
        let userDefaults = UserDefaults(suiteName: "group.expo.modules.moodtracker.example")
        return userDefaults?.string(forKey: "savedData") ?? "No data yet"
    }
}

// MARK: - Widget View
struct WidgetView: View {
    let entry: WidgetEntry
    let widgetName: String
    
    var body: some View {
        VStack(spacing: 16) {
            Text(widgetName)
                .font(.headline)
                .fontWeight(.bold)
                .foregroundColor(Color(red: 0.13, green: 0.59, blue: 0.95))
            
            VStack(spacing: 8) {
                Text("Data received from app:")
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundColor(.secondary)
                
                Text(entry.data)
                    .font(.subheadline)
                    .foregroundColor(entry.data != "No data yet" ? Color(red: 0.30, green: 0.69, blue: 0.31) : .gray)
                
                if !entry.lastUpdate.isEmpty {
                    Text("Updated: \(entry.lastUpdate)")
                        .font(.caption2)
                        .foregroundColor(.gray)
                }
            }
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(.systemBackground))
    }
}

// MARK: - Timeline Provider
struct WidgetProvider: TimelineProvider {
    func placeholder(in context: Context) -> WidgetEntry {
        WidgetEntry(
            date: Date(),
            data: "No data yet",
            lastUpdate: ""
        )
    }
    
    func getSnapshot(in context: Context, completion: @escaping (WidgetEntry) -> Void) {
        let data = WidgetDataManager.shared.getData()
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm:ss"
        let timestamp = formatter.string(from: Date())
        
        let entry = WidgetEntry(
            date: Date(),
            data: data,
            lastUpdate: timestamp
        )
        completion(entry)
    }
    
    func getTimeline(in context: Context, completion: @escaping (Timeline<WidgetEntry>) -> Void) {
        let data = WidgetDataManager.shared.getData()
        let currentDate = Date()
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm:ss"
        let timestamp = formatter.string(from: currentDate)
        
        let entry = WidgetEntry(
            date: currentDate,
            data: data,
            lastUpdate: timestamp
        )
        
        // Update every minute
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 1, to: currentDate)!
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        
        completion(timeline)
    }
}

// MARK: - Widget Configuration
@main
struct widget: Widget {
    let kind = "widget"
    private let widgetName = "MoodWidget"
    
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: WidgetProvider()) { entry in
            WidgetView(entry: entry, widgetName: widgetName)
        }
        .configurationDisplayName(widgetName)
        .description("Displays data from the app")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}