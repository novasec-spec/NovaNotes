#!/bin/bash

# ============================================
# YouTube Music Downloader for Termux
# ============================================

# --- Configuration ---
# Save directory (Termux standard music folder)
DOWNLOAD_DIR="$HOME/storage/shared/Music"
LOG_FILE="$HOME/music-downloads.log"

# Audio quality: 192k is a good balance
QUALITY="192"

# --- Helper Functions ---
log_message() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> "$LOG_FILE"
}

check_dependencies() {
    echo "🔍 Checking dependencies..."
    if ! command -v yt-dlp &> /dev/null; then
        echo "❌ yt-dlp not found. Installing..."
        pip install yt-dlp
    fi
    if ! command -v ffmpeg &> /dev/null; then
        echo "❌ ffmpeg not found. Installing..."
        pkg install ffmpeg -y
    fi
    echo "✅ Dependencies ready!"
}

setup_storage() {
    if [ ! -d "$HOME/storage" ]; then
        echo "📁 Granting storage access..."
        termux-setup-storage
        sleep 3
    fi
    mkdir -p "$DOWNLOAD_DIR"
    echo "📁 Downloads will be saved to: $DOWNLOAD_DIR"
}

download_music() {
    local url="$1"
    echo "🎵 Downloading: $url"
    log_message "Starting download: $url"
    
    # The core yt-dlp command
    yt-dlp \
        --extract-audio \
        --audio-format mp3 \
        --audio-quality "$QUALITY" \
        --output "$DOWNLOAD_DIR/%(title)s.%(ext)s" \
        --embed-thumbnail \
        --add-metadata \
        --no-playlist \
        "$url"
    
    if [ $? -eq 0 ]; then
        echo "✅ Download successful!"
        log_message "Success: $url"
    else
        echo "❌ Download failed for: $url"
        log_message "FAILED: $url"
    fi
    echo "----------------------------------------"
}

# --- Main Loop ---
clear
echo "======================================"
echo "🎧  YouTube Music Downloader"
echo "======================================"
echo "📍 Supports: YouTube & YouTube Music"
echo "🎵 Format: MP3 ($QUALITY kbps)"
echo "📁 Saves to: Music folder"
echo "======================================"

check_dependencies
setup_storage

while true; do
    echo ""
    echo "📎 Paste your link (or type 'quit' to exit):"
    read -p "➡️  " url
    
    if [[ "$url" == "quit" || "$url" == "exit" ]]; then
        echo "👋 Goodbye!"
        break
    fi
    
    if [[ -z "$url" ]]; then
        echo "⚠️  Please paste a valid URL."
        continue
    fi
    
    download_music "$url"
done
