// ─────────────────────────────────────────────────────────────────────────────
//  chatStyles.tsx — shared StyleSheet used by the chat screen and its pieces
// ─────────────────────────────────────────────────────────────────────────────
import { StyleSheet, Dimensions, Platform } from 'react-native';
import { PINK, WHITE, SUCCESS, DANGER } from './chatShared';

const { width: W, height: H } = Dimensions.get('window');

export const s = StyleSheet.create({
  root: { flex: 1 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: Platform.OS === 'android' ? 12 : 0,
    paddingBottom: 12,
    gap: 4,
  },
  hdrBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  hdrInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  hdrName: {
    fontSize: 17,
    fontWeight: '700',
    color: WHITE,
  },
  hdrStatus: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  hdrOnlineDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: SUCCESS,
  },

  seenTooltip: {
    position: 'absolute',
    top: 100,
    alignSelf: 'center',
    zIndex: 99,
    backgroundColor: 'rgba(30,30,30,0.9)',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 22,
  },

  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  blockedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },

  // ── Selection header ──
  selectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  selectionText: {
    fontSize: 16,
    fontWeight: '600',
  },

  // ── Search ──
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  searchResult: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  searchResultSender: {
    fontSize: 13,
    fontWeight: '600',
  },
  searchResultText: {
    fontSize: 14,
    marginTop: 2,
  },
  searchResultTime: {
    fontSize: 11,
    marginTop: 4,
  },
  searchEmpty: {
    alignItems: 'center',
    paddingTop: 60,
    gap: 12,
  },
  searchEmptyText: {
    fontSize: 15,
  },

  // ── Starred drawer ──
  starredDrawer: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: W * 0.85,
    height: '100%',
    zIndex: 50,
    paddingTop: 44,
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
  },
  starredHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  starredTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  starredItem: {
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  starredMsg: {
    fontSize: 14,
  },
  starredTime: {
    fontSize: 11,
    marginTop: 4,
  },
  starredEmpty: {
    padding: 40,
    textAlign: 'center',
    fontSize: 15,
  },
  starredBtn: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },

  // ── Messages ──
  msgList: { padding: 14, paddingBottom: 8 },
  emptyList: { flex: 1, justifyContent: 'center' },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  lockCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FF6B9D18',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FF6B9D33',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    marginTop: 6,
  },
  emptyEncryption: {
    fontSize: 13,
    marginTop: 12,
  },

  msgRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 6, gap: 8 },
  ownRow: { justifyContent: 'flex-end' },
  otherRow: { justifyContent: 'flex-start' },
  bubbleWrap: { maxWidth: W * 0.78 },
  bubble: { padding: 12, borderRadius: 18 },
  ownBubble: { borderBottomRightRadius: 5, overflow: 'hidden' },
  otherBubble: { borderBottomLeftRadius: 5 },

  msgFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 3 },
  ownFooter: { justifyContent: 'flex-end' },
  otherFooter: { justifyContent: 'flex-start' },
  editedTxt: { fontSize: 10, fontStyle: 'italic' },
  timeTxt: { fontSize: 10 },

  reactionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 },
  reactionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
  },

  swipeAction: {
    backgroundColor: PINK,
    width: 70,
    borderRadius: 16,
    marginBottom: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Typing ──
  typingWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 8,
  },
  typingBubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
  },

  // ── Reply bar ──
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: 1,
    gap: 8,
  },
  replyLine: { width: 3, borderRadius: 2, alignSelf: 'stretch' },
  replyUser: { fontSize: 12, fontWeight: '700' },
  replyPreview: { fontSize: 13 },

  // ── Input bar ──
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  inputIconBtn: { padding: 4 },
  inputPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 26,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 44,
    maxHeight: 130,
  },
  input: {
    flex: 1,
    fontSize: 15,
    maxHeight: 110,
    paddingVertical: 4,
  },
  sendBtn: { padding: 2 },
  sendGrad: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Recording ──
  recBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    gap: 12,
  },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: DANGER },
  recTxt: { flex: 1, fontSize: 14, fontWeight: '600' },
  recStop: { padding: 2 },

  // ── Blocked ──
  blockedInput: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    alignItems: 'center',
  },

  // ── Scroll FAB ──
  scrollFab: {
    position: 'absolute',
    bottom: 100,
    right: 18,
    borderRadius: 26,
    overflow: 'hidden',
    shadowColor: PINK,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  scrollFabTouch: {
    width: 48,
    height: 48,
  },
  scrollFabGrad: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
