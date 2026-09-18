import React from 'react'
import { Image, Video, Mic, FileText, Paperclip, File, Phone, PhoneMissed, BarChart2 } from 'lucide-react'
import { isSahaplayOfficialGroup } from '../lib/sahaplayOfficial'
import { CALL_LOG_PREFIX } from '../contexts/CallContext'

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

// A poll message's decryptedText IS the poll definition itself (see
// sendPollMessage/submitPollEdit in GlobalChatWidget.jsx — it's
// JSON.stringify({question, options, allowMultiple})), with no distinguishing
// prefix the way call-log rows have CALL_LOG_PREFIX. Detected by shape
// (parses to an object with a question string + options array) rather than
// threading an isPoll flag through every conversation-summary code path.
function isPollJSON(text) {
  if (!text || typeof text !== 'string' || text[0] !== '{') return false
  try {
    const obj = JSON.parse(text)
    return !!(obj && typeof obj.question === 'string' && Array.isArray(obj.options))
  } catch {
    return false
  }
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

function callLogContent(text, myUsername) {
  const raw = text.slice(CALL_LOG_PREFIX.length)
  let data
  try { data = JSON.parse(raw) } catch { return null }
  const { callType, status, initiatedBy } = data || {}
  const isVideo = callType === 'video'
  const Icon = isVideo ? Video : Phone
  const iWasCaller = !!(initiatedBy && myUsername && initiatedBy.toLowerCase() === myUsername.toLowerCase())
  const missedForMe = status === 'missed' && !iWasCaller
  const label = isVideo ? 'Video call' : 'Voice call'
  // Fixed brand colors (not theme-derived) so the call type/outcome reads at a
  // glance regardless of light/dark mode: red always means "you missed this",
  // purple = video, green = voice — same color-coding as the in-bubble version.
  const color = missedForMe ? '#ef4444' : (isVideo ? '#8b5cf6' : '#10b981')
  return (
    <>
      <PreviewIcon Icon={missedForMe ? PhoneMissed : Icon} color={color} />
      {label}
    </>
  )
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
    if (text && text.startsWith(CALL_LOG_PREFIX)) {
      content = callLogContent(text, myUsername) || 'Call'
    } else if (isPollJSON(text)) {
      content = <><PreviewIcon Icon={BarChart2} color="#f59e0b" />Poll</>
    } else if (!text) {
      content = chat.type === 'room' ? 'Start a conversation' : 'Start a private chat';
    } else if (looksLikeCiphertext(text)) {
      content = isMe ? 'Message sent' : 'Encrypted message';
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

  // The mandatory SahaPlay announcements group has no real two-party sender
  // to attribute a preview to — it's a one-way bulletin every user is forced
  // into, not a conversation the viewer is part of authoring. Any prefix
  // here (the admin's own "You:" on their own posts, or a name at all) leaks
  // an identity that shouldn't be shown; every viewer, admin included, should
  // just see the bare message text, matching the in-bubble "SahaPlay" sender
  // label's own intent of never surfacing who's actually behind the account.
  if (isSahaplayOfficialGroup(chat)) {
    return <span style={rowStyle}>{content}</span>
  }

  if (isMe) {
    return <span style={rowStyle}>You:&nbsp;{content}</span>
  }

  // Group chats need the sender name (could be any member) — private DMs
  // don't, since the row is already labeled with who it's from, so
  // repeating that name in front of every preview is pure noise.
  if (chat.type === 'room' && chat.lastSenderName) {
    const short = chat.lastSenderName.length > 12 ? chat.lastSenderName.substring(0, 12) + '…' : chat.lastSenderName
    return <span style={rowStyle}>{short}:&nbsp;{content}</span>
  }

  return <span style={rowStyle}>{content}</span>
}
