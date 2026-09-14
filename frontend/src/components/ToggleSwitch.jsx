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
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
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
          : 'rgba(255,255,255,0.15)',
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
  );
}
