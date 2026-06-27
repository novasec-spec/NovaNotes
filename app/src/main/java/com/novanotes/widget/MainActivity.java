package com.novanotes.widget;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.os.Bundle;
import android.widget.Button;
import android.widget.EditText;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;

public class MainActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        EditText noteInput = findViewById(R.id.note_input);
        Button saveButton = findViewById(R.id.save_button);
        Button updateWidgetButton = findViewById(R.id.update_widget_button);

        saveButton.setOnClickListener(v -> {
            String note = noteInput.getText().toString();
            // Save note logic here
            Toast.makeText(this, "Note saved!", Toast.LENGTH_SHORT).show();
        });

        updateWidgetButton.setOnClickListener(v -> {
            AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(this);
            ComponentName widgetProvider = new ComponentName(this, NovaNotesWidget.class);
            int[] appWidgetIds = appWidgetManager.getAppWidgetIds(widgetProvider);

            // Trigger widget update
            NovaNotesWidget.updateAppWidget(this, appWidgetManager, appWidgetIds);
            Toast.makeText(this, "Widget updated!", Toast.LENGTH_SHORT).show();
        });
    }
}
