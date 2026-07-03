import { useState, useRef, useCallback } from 'react';

const CHUNK_SIZE = 1024 * 1024; // 1MB

export function useVideoUpload({ socket, roomId, serverUrl }) {
  const [uploadState, setUploadState] = useState({
    isUploading: false,
    progress: 0,
    filename: '',
    streamKey: null,
    error: null,
    canPlay: false
  });
  const abortRef = useRef(false);

  const uploadFile = useCallback(async (file) => {
    if (!file || !roomId) return;
    console.log('[UPLOAD] Starting:', file.name, `${(file.size / 1024 / 1024).toFixed(1)}MB`, 'roomId:', roomId);

    abortRef.current = false;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const token = localStorage.getItem('watch_token');

    setUploadState({
      isUploading: true,
      progress: 0,
      filename: file.name,
      streamKey: null,
      error: null,
      canPlay: false
    });

    try {
      // Step 1: Initialize upload session
      const initRes = await fetch(`${serverUrl}/api/stream/init`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          roomId,
          filename: file.name,
          mimetype: file.type || 'video/mp4',
          totalSize: file.size,
          totalChunks
        })
      });

      if (!initRes.ok) {
        const err = await initRes.json();
        throw new Error(err.error || 'Upload init failed');
      }

      const { streamKey } = await initRes.json();
      console.log('[UPLOAD] Init success, key:', streamKey);
      setUploadState(prev => ({ ...prev, streamKey }));

      // Notify room that upload has started (viewers will see loading indicator)
      socket.emit('stream_started', {
        roomId,
        streamKey,
        filename: file.name,
        totalSize: file.size
      });

      // Step 2: Upload chunks sequentially
      for (let i = 0; i < totalChunks; i++) {
        if (abortRef.current) break;

        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);

        const formData = new FormData();
        formData.append('chunk', chunk);

        const res = await fetch(`${serverUrl}/api/stream/${streamKey}/chunk/${i}`, {
          method: 'POST',
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
          body: formData
        });

        if (!res.ok) throw new Error('Chunk upload failed');

        const { progress } = await res.json();
        console.log('[UPLOAD] Chunk', i + 1, 'of', totalChunks, `(${progress}%)`);
        setUploadState(prev => ({ ...prev, progress }));
      }

      if (!abortRef.current) {
        setUploadState(prev => ({ ...prev, isUploading: false, progress: 100, canPlay: true }));
      }
    } catch (err) {
      console.log('[UPLOAD] Error:', err.message);
      if (!abortRef.current) {
        setUploadState(prev => ({ ...prev, isUploading: false, error: err.message }));
      }
    }
  }, [roomId, socket, serverUrl]);

  const cancelUpload = useCallback(() => {
    abortRef.current = true;
    setUploadState({
      isUploading: false,
      progress: 0,
      filename: '',
      streamKey: null,
      error: null,
      canPlay: false
    });
    if (socket && roomId) {
      socket.emit('stream_cancelled', { roomId });
    }
  }, [socket, roomId]);

  return { uploadState, uploadFile, cancelUpload };
}
