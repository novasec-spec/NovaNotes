#!/data/data/com.termux/files/usr/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
#  send-notification.sh — Fixed for Expo Push API (2026)
#  Bubbles — Push notification sender for Alice 💕
# ─────────────────────────────────────────────────────────────────────────────

# ── Alice's Expo push token ───────────────────────────────────────────────────
EXPO_TOKEN="ExponentPushToken[se9b_cIBZiQxmbvd7IfkUc]"
EXPO_API="https://exp.host/--/api/v2/push/send"

# ── Colours ───────────────────────────────────────────────────────────────────
PINK='\033[0;35m'
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

# ─────────────────────────────────────────────────────────────────────────────
#  Helpers
# ─────────────────────────────────────────────────────────────────────────────
banner() {
  clear
  echo -e "${PINK}"
  echo "  ╔══════════════════════════════════════════════╗"
  echo "  ║   🫧  Bubbles — Push Notification Sender     ║"
  echo "  ║      Send love directly to Alice 💕          ║"
  echo "  ╚══════════════════════════════════════════════╝"
  echo -e "${RESET}"
}

# Better JSON escaping
json_escape() {
  printf '%s' "$1" | python3 -c '
import sys, json
print(json.dumps(sys.stdin.read().strip())[1:-1], end="")
' 2>/dev/null || echo "$1" | sed 's/"/\\"/g'
}

# Send the actual push notification
send_push() {
  local TITLE="$1"
  local BODY="$2"
  local CATEGORY="${3:-}"
  local SOUND="${4:-default}"
  local PRIORITY="${5:-high}"
  local DATA="${6:-{\"type\":\"notification\"}}"

  local SAFE_TITLE=$(json_escape "$TITLE")
  local SAFE_BODY=$(json_escape "$BODY")

  # Build clean JSON
  local PAYLOAD=$(cat << EOF
{
  "to": "$EXPO_TOKEN",
  "title": "$SAFE_TITLE",
  "body": "$SAFE_BODY",
  "sound": "$SOUND",
  "priority": "$PRIORITY",
  "channelId": "${CATEGORY:-default}",
  "data": $DATA
EOF
)

  # Only add categoryId if we have one
  if [[ -n "$CATEGORY" ]]; then
    PAYLOAD+=$',\n  "categoryId": "'"$CATEGORY"'"'
  fi

  PAYLOAD+=$'\n}'
  
  echo -e "\n\( {DIM}Sending to Expo... \){RESET}"

  RESPONSE=$(curl -s -X POST "$EXPO_API" \
    -H "Accept: application/json" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD")

  # Parse response
  STATUS=$(echo "$RESPONSE" | python3 -c '
import sys, json
try:
    d = json.load(sys.stdin)
    data = d.get("data", [{}])[0] if isinstance(d.get("data"), list) else d.get("data", {})
    status = data.get("status", "error")
    print(status)
    if status != "ok":
        print("Error:", data.get("message", d.get("errors")))
except Exception as e:
    print("parse_error")
' 2>/dev/null)

  if [[ "$STATUS" == "ok" ]]; then
    echo -e "\( {GREEN} \){BOLD}✅  Notification sent successfully!${RESET}"
    echo -e "${DIM}    Category : \( {CATEGORY:-none} \){RESET}"
    echo -e "${DIM}    Title    : \( TITLE \){RESET}"
  else
    echo -e "\( {RED} \){BOLD}❌  Send failed.${RESET}"
    echo -e "${DIM}    Response: \( RESPONSE \){RESET}"
  fi
}

# Log sent notification
log_sent() {
  local TITLE="$1"
  local BODY="$2"
  local CATEGORY="${3:-none}"
  local LOG_FILE="$HOME/.bubbles_sent_log"
  echo "$(date '+%Y-%m-%d %H:%M:%S') | $CATEGORY | $TITLE | $BODY" >> "$LOG_FILE"
}

# ... (rest of your functions remain mostly the same, just updated calls)

# Example updated send_love_note (apply pattern to others)
send_love_note() {
  banner
  echo -e "\( {PINK} \){BOLD}💕  Love Note${RESET}\n"

  # ... your template logic ...

  [[ -z "$TITLE" || -z "\( BODY" ]] && { echo -e " \){RED}Cancelled.${RESET}"; sleep 1; return; }

  local DATA='{"type":"love_note","timestamp":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}'
  send_push "$TITLE" "$BODY" "LOVE_NOTE" "default" "high" "$DATA"
  log_sent "$TITLE" "$BODY" "LOVE_NOTE"

  echo -e "\nPress Enter to continue..."
  read -r
}

# Apply the same pattern to other functions (send_reminder, send_mood_check, etc.)
# For brevity, update all send_push calls similarly.

# ── Test Token ────────────────────────────────────────────────────────────────
test_token() {
  banner
  echo -e "\( {CYAN} \){BOLD}🔑  Sending test notification...${RESET}\n"

  local DATA='{"type":"test","timestamp":"'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}'
  send_push "Test from Termux 🛠️" "If you see this, push is working! 💕" "LOVE_NOTE" "default" "high" "$DATA"
}

# Main menu stays the same...
main_menu() {
  while true; do
    banner
    echo -e "  \( {BOLD}Send a notification to Alice: \){RESET}\n"
    echo -e "  \( {PINK}1) \){RESET}  💕  Love Note"
    echo -e "  \( {PINK}2) \){RESET}  ⏰  Reminder"
    echo -e "  \( {PINK}3) \){RESET}  😊  Mood Check"
    echo -e "  \( {PINK}4) \){RESET}  📸  Memory Reminder"
    echo -e "  \( {PINK}5) \){RESET}  📍  Check-in"
    echo -e "  \( {PINK}6) \){RESET}  🎁  Surprise"
    echo -e "  \( {PINK}7) \){RESET}  🔧  Custom"
    echo -e "  \( {PINK}8) \){RESET}  📜  View history"
    echo -e "  \( {PINK}9) \){RESET}  🔑  Test token"
    echo -e "  \( {PINK}0) \){RESET}  🚪  Exit"
    echo -n "  Choose [0-9]: "
    read -r CHOICE

    case "$CHOICE" in
      1) send_love_note ;;
      2) send_reminder ;;
      3) send_mood_check ;;
      4) send_memory_reminder ;;
      5) send_checkin ;;
      6) send_surprise ;;
      7) send_custom ;;
      8) view_history ;;
      9) test_token ;;
      0) echo -e "\n\( {PINK}Bye! 💕 \){RESET}"; exit 0 ;;
      *) echo -e "\( {RED}Invalid choice. \){RESET}" ;;
    esac
  done
}

# Entry point
if ! command -v curl &> /dev/null; then
  echo -e "\( {RED}Error: curl is required. \){RESET}"
  exit 1
fi

if ! command -v python3 &> /dev/null; then
  echo -e "\( {RED}Error: python3 is required. \){RESET}"
  exit 1
fi

main_menu
