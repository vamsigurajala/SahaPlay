/**
 * ToggleSwitch.jsx
 *
 * A plain on/off switch — matches the app's brand gradient when on,
 * transparent/muted track when off. Built as its own small component since
 * no shared switch existed anywhere in the app yet (the only prior
 * on/off UI pattern in Profile.jsx was a plain checkbox, e.g. the delete-
 * account confirmation). Accessible as a real switch (role="switch",
 * aria-checked) rather than a styled checkbox, so screen readers and
 * keyboard users get the same "this is a toggle" semantics sighted users
 * see visually.
 */
export default function ToggleSwitch({ checked, onChange, disabled = false, label }) {
  return (
    <>
      {/* The off-state track was a translucent white overlay
          (rgba(255,255,255,0.15)) — reads fine on this app's dark cards,
          but nearly disappears against a light-mode white card, making an
          OFF toggle look broken/invisible. Kept as an inline style for the
          ON state (unaffected, no complaints there) and moved the OFF
          state to a class so light mode can override it with a visibly
          grey track. */}
      <style>{`
        .toggle-switch-track.off { background: rgba(255,255,255,0.15); }
        html[data-theme='light'] .toggle-switch-track.off { background: #cbd5e1 !important; }
      `}</style>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`toggle-switch-track${checked ? '' : ' off'}`}
        style={{
          position: 'relative',
          width: 44,
          height: 26,
          flexShrink: 0,
          borderRadius: 999,
          border: 'none',
          padding: 0,
          cursor: disabled ? 'default' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          background: checked
            ? 'linear-gradient(135deg,var(--brand-1),var(--brand-2))'
            : undefined,
          transition: 'background 0.2s ease',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 3,
            left: checked ? 21 : 3,
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: '#fff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
            transition: 'left 0.2s ease',
          }}
        />
      </button>
    </>
  );
}
