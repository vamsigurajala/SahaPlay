export default function StreamUploadProgress({ uploadState, onCancel }) {
  const { isUploading, progress, filename, error, canPlay } = uploadState;

  if (!isUploading && !error) return null;
  // Automatically hide upload overlay once progress reaches 10% so it does not clutter the screen
  if (progress >= 10 && !error) return null;

  return (
    <div style={{
      position: 'absolute',
      bottom: '80px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(0,0,0,0.88)',
      borderRadius: '12px',
      padding: '16px 24px',
      minWidth: '300px',
      maxWidth: '420px',
      zIndex: 1100,
      border: '1px solid rgba(255,255,255,0.1)',
      backdropFilter: 'blur(8px)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
    }}>
      {error ? (
        <div style={{ color: '#f87171', fontSize: '0.875rem' }}>
          Upload failed: {error}
        </div>
      ) : (
        <>
          <div style={{
            color: 'white',
            fontSize: '0.8rem',
            marginBottom: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              Uploading: {filename}
            </span>
            <span style={{ flexShrink: 0, fontWeight: 700, color: 'var(--brand-1-light)' }}>{progress}%</span>
          </div>

          <div style={{
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '999px',
            height: '6px',
            overflow: 'hidden',
            marginBottom: '10px'
          }}>
            <div style={{
              background: 'linear-gradient(90deg, var(--brand-2-dark), var(--brand-1-light))',
              height: '100%',
              width: `${progress}%`,
              borderRadius: '999px',
              transition: 'width 0.3s ease',
              boxShadow: progress > 0 ? '0 0 8px rgba(167,139,250,0.5)' : 'none'
            }} />
          </div>

          {isUploading && (
            <div style={{
              color: '#86efac',
              fontSize: '0.72rem',
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <span>Playing locally — uploading to room...</span>
            </div>
          )}

          <button
            onClick={onCancel}
            style={{
              background: 'none',
              border: '1px solid rgba(255,255,255,0.15)',
              color: '#9ca3af',
              borderRadius: '6px',
              padding: '3px 12px',
              fontSize: '0.72rem',
              cursor: 'pointer',
              transition: 'color 0.15s'
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#9ca3af'; }}
          >
            Cancel
          </button>
        </>
      )}
    </div>
  );
}
