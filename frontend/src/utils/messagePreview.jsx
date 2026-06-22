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
  return /^[A-Za-z0-9+/\-_=]{20,}$/.test(str.trim()) && !str.includes(' ')
}

function fmtDur(secs) {
  if (!secs || secs <= 0) return null
  const total = Math.round(secs)
  const mins = Math.floor(total / 60)
  const s = total % 60
  return `${mins}:${String(s).padStart(2, '0')}s`
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

  const media = mType ? mediaContent(mType, fName, mDur) : null

  let content
  if (media) {
    content = media
  } else {
    const text = chat.decryptedText || chat.message || ''
    if (!text || looksLikeCiphertext(text)) {
      content = isMe ? 'Message sent' : 'Message'
    } else {
      content = text.length > 40 ? text.substring(0, 40) + '…' : text
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
