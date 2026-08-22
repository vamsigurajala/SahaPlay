// ── Chat bubble "Customize" themes (Instagram-style) ──────────────────────────
// Shared between GlobalChatWidget.jsx and RoomChatPanel.jsx — two independent
// private/group chat UIs in this codebase that both need the exact same
// theme list so a theme picked in one reads identically in the other.
//
// 'default' is intentionally each surface's existing sent-bubble gradient,
// unchanged — picking "Default" (or never opening the picker at all) must
// look exactly like it always has. Every other entry replaces that gradient,
// and forces the chat background to the app's own light/dark appearance
// (not a hardcoded color) so the gradient reads clearly, matching
// Instagram's own per-conversation theme behavior.
export const CHAT_THEMES = [
  { id: 'default', name: 'Default', gradient: 'linear-gradient(135deg,var(--brand-1),var(--brand-2))' },
  { id: 'ocean', name: 'Ocean', gradient: 'linear-gradient(180deg,#1d4ed8 0%,#2563eb 100%)' },
  { id: 'berry', name: 'Berry', gradient: 'linear-gradient(180deg,#1e3a8a 0%,#7c3aed 55%,#ef4444 100%)' },
  { id: 'candy', name: 'Candy', gradient: 'linear-gradient(180deg,#22d3ee 0%,#f9a8d4 50%,#93c5fd 100%)' },
  { id: 'unicorn', name: 'Unicorn', gradient: 'linear-gradient(180deg,#7c3aed 0%,#d946ef 100%)' },
  { id: 'maple', name: 'Maple', gradient: 'linear-gradient(180deg,#7f1d1d 0%,#b45309 100%)' },
  { id: 'sushi', name: 'Sushi', gradient: 'linear-gradient(180deg,#f87171 0%,#fbbf24 100%)' },
  { id: 'rocket', name: 'Rocket', gradient: 'linear-gradient(180deg,#ef4444 0%,#ec4899 50%,#f59e0b 100%)' },
  { id: 'lollipop', name: 'Lollipop', gradient: 'linear-gradient(180deg,#f472b6 0%,#a78bfa 100%)' },
  { id: 'shadow', name: 'Shadow', gradient: 'linear-gradient(180deg,#4c1d95 0%,#312e81 100%)' },
  { id: 'sunset', name: 'Sunset', gradient: 'linear-gradient(180deg,#db2777 0%,#fb923c 100%)' },
  { id: 'mint', name: 'Mint', gradient: 'linear-gradient(180deg,#0891b2 0%,#34d399 100%)' },
];

// Roughly the average rendered height (px) of one message bubble, used to
// approximate each bubble's position along ONE continuous gradient spanning
// the whole conversation (background-position/-size on each sent bubble) —
// an index-based estimate rather than measuring real DOM heights, since the
// point is "later messages read as a visibly different shade than earlier
// ones", not pixel-perfect continuity across bubbles of varying height.
export const CHAT_THEME_BUBBLE_STRIDE = 70;

// Every gradient above is ordered so its 0% stop is the DARKEST color and its
// 100% stop is the LIGHTEST — the rendering code (GlobalChatWidget.jsx /
// RoomChatPanel.jsx) maps the oldest sent bubble (index 0) to 0% and the
// newest to 100%, so this ordering is what makes older messages (scrolled up,
// out of view) read dark and the most recent message (closest to the
// composer) read light. Keep this invariant when editing/adding a theme —
// don't just reorder for looks, reorder by actual luminance.
