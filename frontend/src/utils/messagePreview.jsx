import React from 'react'
import { Image, Video, Mic, FileText, Paperclip, File } from 'lucide-react'

const ICON_SIZE = 11

function PreviewIcon({ Icon, color }) {
  return (
    <Icon
      size={ICON_SIZE}
      color={color}
      style={{ display: 'inline', verticalAlign: 'middle', flexShrink: 0, marginRight: 2 }}
    />
  )
}

function looksLikeCiphertext(str) {
  if (!str || typeof str !== 'string' || str.length < 20) return false
  if (str.startsWith('encv1:')) return true
  return /^[A-Za-z0-9+/\-_=]{20,}$/.test(str.trim()) && !str.includes(' ')
}

function fmtDur(secs) {
  if (!secs || secs <= 0) return null
  const total = Math.round(secs)
  const mins = Math.floor(total / 60)
  const s = total % 60
  return `${mins}:${String(s).padStart(2, '0')}`
}

function mediaContent(mediaType, fileName, mediaDuration) {
  const ext = fileName ? fileName.split('.').pop().toLowerCase() : ''

  if (mediaType.startsWith('image/')) {
    return <><PreviewIcon Icon={Image} color="#6366f1" />Photo</>
  }
  if (mediaType.startsWith('video/')) {
    return <><PreviewIcon Icon={Video} color="#a855f7" />Video</>
  }
  if (mediaType.startsWith('audio/') || mediaType === 'voice') {
    const dur = fmtDur(mediaDuration)
    return <><PreviewIcon Icon={Mic} color="#10b981" />{dur ? dur : 'Voice note'}</>
  }

  // Custom colors for common file types
  let color = '#6b7280';
  if (ext === 'pdf' || mediaType === 'application/pdf') {
    color = '#ef4444';
  } else if (['xls', 'xlsx', 'csv'].includes(ext) || mediaType.includes('spreadsheet') || mediaType.includes('excel') || mediaType.includes('ms-excel') || mediaType === 'text/csv') {
    color = '#10b981';
  } else if (['doc', 'docx'].includes(ext) || mediaType.includes('wordprocessing') || mediaType.includes('msword')) {
    color = '#3b82f6';
  } else if (['ppt', 'pptx'].includes(ext) || mediaType.includes('presentation') || mediaType.includes('powerpoint')) {
    color = '#f59e0b';
  } else if (ext === 'zip' || mediaType === 'application/zip') {
    color = '#8b5cf6';
  }

  return <><PreviewIcon Icon={FileText} color={color} />{fileName || 'File'}</>
}

export function getMessagePreview(chat, myUsername) {
  if (!chat) return null

  const myLower = myUsername ? myUsername.toLowerCase() : null
  const senderLower = chat.lastSenderName ? chat.lastSenderName.toLowerCase() : null
  const isMe = !!chat.isMyLastMessage || (myLower && senderLower && senderLower === myLower)

  const mType = chat.lastMediaType || chat.mediaType || ''
  const fName = chat.lastMediaFileName || chat.mediaFileName || chat._fileName || ''
  const mDur = chat.lastMediaDuration || chat.mediaDuration || 0

  let media = mType ? mediaContent(mType, fName, mDur) : null

  let content
  if (media) {
    content = media
  } else {
    const text = chat.decryptedText || chat.message || ''
    if (!text || looksLikeCiphertext(text)) {
      content = isMe ? 'Message sent' : 'Message'
    } else {
      // Infer media type from filename extension when lastMediaType is missing.
      // This handles legacy DB rows where mediaType was null but the message field
      // contains the filename (e.g. "voice_1782205656002.webm").
      const ext = text.split('.').pop().toLowerCase()
      const inferredType =
        ['webm', 'mp3', 'ogg', 'wav', 'm4a', 'aac'].includes(ext) ? `audio/${ext}` :
        ['mp4', 'mov', 'avi', 'mkv'].includes(ext) ? `video/${ext}` :
        ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext) ? `image/${ext}` :
        null
      if (inferredType && /^[^\s]{5,}$/.test(text)) {
        media = mediaContent(inferredType, text, mDur)
        content = media
      } else {
        content = text.length > 40 ? text.substring(0, 40) + '…' : text
      }
    }
  }

  const rowStyle = { display: 'inline-flex', alignItems: 'center', gap: 2 }

  if (isMe) {
    return <span style={rowStyle}>You:&nbsp;{content}</span>
  }

  if (chat.lastSenderName) {
    const name = chat.lastSenderName
    const short = name.length > 12 ? name.substring(0, 12) + '…' : name
    return <span style={rowStyle}>{short}:&nbsp;{content}</span>
  }

  return <span style={rowStyle}>{content}</span>
}
