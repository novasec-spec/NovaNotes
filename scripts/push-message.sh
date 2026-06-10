
#!/data/data/com.termux/files/usr/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
#  push-message.sh
#  Bubbles app — OTA message pusher
#  Run this from your project root: bash scripts/push-message.sh
# ─────────────────────────────────────────────────────────────────────────────

# ── Config ────────────────────────────────────────────────────────────────────
MESSAGES_FILE="./assets/messages.json"
EAS_BRANCH="production"          # change to "preview" if you use a preview build

# ── Colours ───────────────────────────────────────────────────────────────────
PINK='\033[0;35m'
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
RESET='\033[0m'

# ── Helpers ───────────────────────────────────────────────────────────────────
banner() {
  clear
  echo -e "${PINK}"
  echo "  ╔══════════════════════════════════════════╗"
  echo "  ║   🫧  Bubbles — Message Pusher  💕       ║"
  echo "  ║      Push love notes to Alice via OTA    ║"
  echo "  ╚══════════════════════════════════════════╝"
  echo -e "${RESET}"
}

# Read current version from messages.json
get_version() {
  python3 -c "import json; d=json.load(open('$MESSAGES_FILE')); print(d['version'])"
}

# Read current message count
get_count() {
  python3 -c "import json; d=json.load(open('$MESSAGES_FILE')); print(len(d['messages']))"
}

# Pretty-print current messages
show_messages() {
  echo -e "${CYAN}${BOLD}Current messages in payload:${RESET}"
  python3 << 'PYEOF'
import json, sys

with open('./assets/messages.json') as f:
    data = json.load(f)

msgs = data.get('messages', [])
if not msgs:
    print("  (no messages yet)")
else:
    for i, m in enumerate(msgs, 1):
        trigger = m.get('triggerType', '?')
        extra   = ''
        if trigger == 'delay':
            extra = f"  after {m.get('delayMinutes','?')} min"
        elif trigger == 'scheduled':
            extra = f"  at {m.get('scheduleAt','?')}"
        elif trigger == 'daily':
            extra = f"  daily {m.get('hour','?'):02d}:{m.get('minute','?'):02d}"
        print(f"  [{i}] {m['id']}")
        print(f"       Title  : {m['title']}")
        print(f"       Body   : {m['body']}")
        print(f"       Trigger: {trigger}{extra}")
        print(f"       Category: {m.get('category','love')}")
        print()
PYEOF
}

# ── Add a new message ─────────────────────────────────────────────────────────
add_message() {
  banner
  echo -e "${PINK}${BOLD}✍️  Write a new message for Alice${RESET}\n"

  # Title
  echo -e "${YELLOW}Notification title:${RESET}"
  read -r MSG_TITLE
  if [[ -z "$MSG_TITLE" ]]; then
    echo -e "${RED}Title cannot be empty.${RESET}"
    sleep 1; return
  fi

  # Body
  echo -e "${YELLOW}Notification body (the actual message):${RESET}"
  read -r MSG_BODY
  if [[ -z "$MSG_BODY" ]]; then
    echo -e "${RED}Body cannot be empty.${RESET}"
    sleep 1; return
  fi

  # Trigger type
  echo -e "\n${YELLOW}Trigger type:${RESET}"
  echo "  1) immediate  — fires ~3 seconds after app opens"
  echo "  2) delay      — fires after N minutes"
  echo "  3) scheduled  — fires at a specific date & time"
  echo "  4) daily      — fires every day at a set time"
  echo -n "Choose [1-4]: "
  read -r TRIGGER_CHOICE

  TRIGGER_TYPE="immediate"
  EXTRA_JSON=""

  case "$TRIGGER_CHOICE" in
    1)
      TRIGGER_TYPE="immediate"
      ;;
    2)
      echo -n "Delay in minutes: "
      read -r DELAY_MIN
      TRIGGER_TYPE="delay"
      EXTRA_JSON="\"delayMinutes\": $DELAY_MIN,"
      ;;
    3)
      echo -e "Schedule datetime ${CYAN}(format: 2025-06-15T08:00:00)${RESET}:"
      read -r SCHEDULE_AT
      TRIGGER_TYPE="scheduled"
      EXTRA_JSON="\"scheduleAt\": \"$SCHEDULE_AT\","
      ;;
    4)
      echo -n "Hour (0-23): "
      read -r HOUR
      echo -n "Minute (0-59): "
      read -r MINUTE
      TRIGGER_TYPE="daily"
      EXTRA_JSON="\"hour\": $HOUR, \"minute\": $MINUTE,"
      ;;
    *)
      echo -e "${RED}Invalid choice. Defaulting to immediate.${RESET}"
      TRIGGER_TYPE="immediate"
      ;;
  esac

  # Category
  echo -e "\n${YELLOW}Category:${RESET}"
  echo "  1) love       2) reminder      3) surprise     4) milestone"
  echo -n "Choose [1-4] (default 1): "
  read -r CAT_CHOICE
  case "$CAT_CHOICE" in
    2) CATEGORY="reminder" ;;
    3) CATEGORY="surprise" ;;
    4) CATEGORY="milestone" ;;
    *) CATEGORY="love" ;;
  esac

  # Generate unique ID
  MSG_ID="msg_$(date +%s)"
  TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

  # Escape quotes in title and body for JSON safety
  SAFE_TITLE=$(echo "$MSG_TITLE" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read().strip()))" | tr -d '"')
  SAFE_BODY=$(echo  "$MSG_BODY"  | python3 -c "import sys,json; print(json.dumps(sys.stdin.read().strip()))" | tr -d '"')

  # Append to messages.json and bump version
  python3 << PYEOF
import json, sys

with open('./assets/messages.json', 'r') as f:
    data = json.load(f)

new_msg = {
    "id":          "$MSG_ID",
    "title":       "$SAFE_TITLE",
    "body":        "$SAFE_BODY",
    "triggerType": "$TRIGGER_TYPE",
    "sent":        False,
    "category":    "$CATEGORY",
}

# Add trigger-specific fields
if "$TRIGGER_TYPE" == "delay":
    new_msg["delayMinutes"] = int("${DELAY_MIN:-5}")
elif "$TRIGGER_TYPE" == "scheduled":
    new_msg["scheduleAt"] = "$SCHEDULE_AT"
elif "$TRIGGER_TYPE" == "daily":
    new_msg["hour"]   = int("${HOUR:-8}")
    new_msg["minute"] = int("${MINUTE:-0}")

data["messages"].append(new_msg)
data["version"]   += 1
data["updatedAt"]  = "$TIMESTAMP"

with open('./assets/messages.json', 'w') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print(f"  Added: {new_msg['id']}  |  New version: {data['version']}")
PYEOF

  echo -e "\n${GREEN}✅ Message added!${RESET}"
  sleep 1
}

# ── Remove a message by index ─────────────────────────────────────────────────
remove_message() {
  banner
  show_messages

  COUNT=$(get_count)
  if [[ "$COUNT" -eq 0 ]]; then
    echo -e "${RED}No messages to remove.${RESET}"
    sleep 1; return
  fi

  echo -e "${YELLOW}Enter message number to remove (1-$COUNT), or 0 to cancel:${RESET}"
  read -r REMOVE_IDX

  if [[ "$REMOVE_IDX" -eq 0 ]]; then return; fi

  TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

  python3 << PYEOF
import json, sys

idx = int("$REMOVE_IDX") - 1
with open('./assets/messages.json', 'r') as f:
    data = json.load(f)

if 0 <= idx < len(data['messages']):
    removed = data['messages'].pop(idx)
    data['version']  += 1
    data['updatedAt'] = "$TIMESTAMP"
    with open('./assets/messages.json', 'w') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"  Removed: {removed['id']}  |  New version: {data['version']}")
else:
    print("  Invalid index.")
    sys.exit(1)
PYEOF

  echo -e "${GREEN}✅ Removed.${RESET}"
  sleep 1
}

# ── Clear all messages ────────────────────────────────────────────────────────
clear_all_messages() {
  echo -e "${RED}${BOLD}Are you sure you want to clear ALL messages? (y/N):${RESET}"
  read -r CONFIRM
  if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
    echo "Cancelled."; sleep 1; return
  fi

  TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

  python3 << PYEOF
import json
with open('./assets/messages.json', 'r') as f:
    data = json.load(f)
data['messages']  = []
data['version']  += 1
data['updatedAt'] = "$TIMESTAMP"
with open('./assets/messages.json', 'w') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
print(f"  Cleared. New version: {data['version']}")
PYEOF

  echo -e "${GREEN}✅ All messages cleared.${RESET}"
  sleep 1
}

# ── Push OTA update ───────────────────────────────────────────────────────────
push_ota() {
  banner
  VERSION=$(get_version)
  COUNT=$(get_count)

  echo -e "${PINK}${BOLD}📡 Push OTA Update to Alice's phone${RESET}\n"
  echo -e "  Payload version : ${CYAN}${VERSION}${RESET}"
  echo -e "  Messages inside : ${CYAN}${COUNT}${RESET}"
  echo ""
  show_messages

  echo -e "${YELLOW}${BOLD}Add a commit message for this update:${RESET}"
  echo -n "> "
  read -r COMMIT_MSG
  if [[ -z "$COMMIT_MSG" ]]; then
    COMMIT_MSG="Push messages v${VERSION}"
  fi

  echo ""
  echo -e "${YELLOW}Branch to push to [${EAS_BRANCH}]:${RESET}"
  echo -n "> "
  read -r BRANCH_INPUT
  BRANCH="${BRANCH_INPUT:-$EAS_BRANCH}"

  echo ""
  echo -e "${CYAN}Running:EAS_SKIP_AUTO_FINGERPRINT=1 CI=1 eas update --branch ${BRANCH} --message \"${COMMIT_MSG}\"${RESET}"
  echo -e "${YELLOW}Continue? (y/N):${RESET}"
  read -r GO

  if [[ "$GO" != "y" && "$GO" != "Y" ]]; then
    echo "Cancelled."; sleep 1; return
  fi

  echo ""
  echo -e "${PINK}Pushing...${RESET}"
  echo "────────────────────────────────────────────"

  # Run the actual EAS update
EAS_SKIP_AUTO_FINGERPRINT=1 CI=1 eas update --branch production --message "your update message"
  EXIT_CODE=$?
  echo "────────────────────────────────────────────"

  if [[ $EXIT_CODE -eq 0 ]]; then
    echo -e "\n${GREEN}${BOLD}✅ OTA update pushed successfully!${RESET}"
    echo -e "Alice's phone will pick it up next time she opens the app."
    echo -e "Notifications will fire automatically on next launch. 💕"
  else
    echo -e "\n${RED}${BOLD}❌ EAS update failed (exit code $EXIT_CODE).${RESET}"
    echo -e "Check your EAS login: ${CYAN}eas whoami${RESET}"
    echo -e "Or check your network connection."
  fi

  echo ""
  echo -e "Press Enter to continue..."
  read -r
}

# ── Preview what will fire ────────────────────────────────────────────────────
preview_payload() {
  banner
  VERSION=$(get_version)
  echo -e "${CYAN}${BOLD}Payload preview (version $VERSION):${RESET}\n"
  python3 -c "
import json
with open('./assets/messages.json') as f:
    data = json.load(f)
print(json.dumps(data, indent=2, ensure_ascii=False))
"
  echo ""
  echo -e "Press Enter to continue..."
  read -r
}

# ── Check EAS login status ────────────────────────────────────────────────────
check_eas() {
  banner
  echo -e "${CYAN}Checking EAS status...${RESET}\n"
  eas whoami
  echo ""
  echo -e "${CYAN}Checking project config...${RESET}\n"
  cat app.json | python3 -c "
import json,sys
d = json.load(sys.stdin)
expo = d.get('expo', {})
print(f'  App name  : {expo.get(\"name\", \"?\")}')
print(f'  Slug      : {expo.get(\"slug\", \"?\")}')
print(f'  Version   : {expo.get(\"version\", \"?\")}')
print(f'  Project ID: {expo.get(\"extra\", {}).get(\"eas\", {}).get(\"projectId\", \"not set\")}')
" 2>/dev/null || echo "  (could not read app.json)"
  echo ""
  echo -e "Press Enter to continue..."
  read -r
}

# ── Main menu ─────────────────────────────────────────────────────────────────
main_menu() {
  while true; do
    banner

    VERSION=$(get_version)
    COUNT=$(get_count)

    echo -e "  Payload version : ${CYAN}${BOLD}v${VERSION}${RESET}"
    echo -e "  Messages ready  : ${CYAN}${BOLD}${COUNT}${RESET}"
    echo ""
    echo -e "  ${BOLD}What do you want to do?${RESET}"
    echo ""
    echo -e "  ${PINK}1)${RESET} ✍️  Write a new message for Alice"
    echo -e "  ${PINK}2)${RESET} 👀  View all messages in payload"
    echo -e "  ${PINK}3)${RESET} 🗑️  Remove a message"
    echo -e "  ${PINK}4)${RESET} 💣  Clear all messages"
    echo -e "  ${PINK}5)${RESET} 📋  Preview full JSON payload"
    echo -e "  ${PINK}6)${RESET} 📡  Push OTA update to Alice's phone"
    echo -e "  ${PINK}7)${RESET} 🔑  Check EAS login & project config"
    echo -e "  ${PINK}0)${RESET} 🚪  Exit"
    echo ""
    echo -n "  Choose [0-7]: "
    read -r CHOICE

    case "$CHOICE" in
      1) add_message        ;;
      2) banner; show_messages; echo "Press Enter..."; read -r ;;
      3) remove_message     ;;
      4) clear_all_messages ;;
      5) preview_payload    ;;
      6) push_ota           ;;
      7) check_eas          ;;
      0) echo -e "\n${PINK}Bye! 💕${RESET}\n"; exit 0 ;;
      *) echo -e "${RED}Invalid choice.${RESET}"; sleep 0.5 ;;
    esac
  done
}

# ─────────────────────────────────────────────────────────────────────────────
#  Entry point
# ─────────────────────────────────────────────────────────────────────────────

# Check we're in the right directory
if [[ ! -f "$MESSAGES_FILE" ]]; then
  echo -e "${RED}Error: Run this script from your project root directory."
  echo -e "Expected: $MESSAGES_FILE${RESET}"
  exit 1
fi

# Check python3 is available
if ! command -v python3 &> /dev/null; then
  echo -e "${RED}Error: python3 is required. Install with: pkg install python${RESET}"
  exit 1
fi

main_menu
