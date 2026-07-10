import { useState, useEffect } from 'react';
import { getAvatarUrl, getInitials, stringToColor } from '../utils/avatarUtils';

// Pass either a raw `avatarPath` (resolved via getAvatarUrl) or an already-resolved `src`.
// Falls back to a colored initials circle when there's no image, or the image fails to load.
export default function Avatar({ src, avatarPath, username, size = 36, className = '', style = {} }) {
  const resolvedSrc = src || getAvatarUrl(avatarPath);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => { setImgFailed(false); }, [resolvedSrc]);

  const showInitials = !resolvedSrc || imgFailed;

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        overflow: 'hidden',
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: showInitials ? stringToColor(username) : 'transparent',
        fontSize: size * 0.38,
        fontWeight: 600,
        color: '#fff',
        userSelect: 'none',
        ...style,
      }}
    >
      {!showInitials && (
        <img
          src={resolvedSrc}
          alt={username || 'avatar'}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          onError={() => setImgFailed(true)}
          loading="lazy"
        />
      )}
      {showInitials && <span className="stay-white">{getInitials(username)}</span>}
    </div>
  );
}
