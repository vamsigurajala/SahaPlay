// The center tap-to-pause/play flash and the bottom control bar's own
// play/pause button must always show the SAME icon for the state the video
// is transitioning INTO, not the state it's leaving. The bottom bar computes
// this from its live (post-toggle) isPlaying value; the center flash is set
// from inside the tap handler where isPlaying is still the PRE-toggle value
// (closure, read before togglePlayPause()'s setState lands) — so it must
// invert that value to land on the same icon the bar is about to show. Get
// this backwards (as happened this session) and the two visibly contradict
// each other for a moment: a Pause icon flashing in the center while the bar
// underneath already shows Play, or vice versa.
export function getCenterFeedbackType(preToggleIsPlaying) {
  return preToggleIsPlaying ? 'play' : 'pause';
}
