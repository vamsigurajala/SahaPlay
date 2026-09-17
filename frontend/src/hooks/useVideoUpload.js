import { useState, useRef, useCallback } from 'react';

const CHUNK_SIZE = 1024 * 1024; // 1MB
// Chunks used to go out one at a time, each awaiting its own full round trip
// before the next even started — on any real network the connection sat
// idle between chunks waiting on the server's response, which is what
// actually capped how fast the ready-threshold (see server.js) and everyone
// else's playback caught up, regardless of real available bandwidth. This
// many chunks now go out in parallel instead; the server tracks exactly
// which indices have actually landed (not just how many), so out-of-order
// arrival from concurrent uploads can never corrupt what gets served.
const UPLOAD_CONCURRENCY = 3;

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
        const err = await initRes.json().catch(() => ({}));
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

      // Step 2: Upload chunks with priority ordering and retries per chunk
      // MP4 files may store their moov metadata atom at the very start (faststart)
      // or at the very end of the file (standard camera/rip recordings).
      // Prioritize chunk 0 (head) and chunk totalChunks - 1 (tail, plus totalChunks - 2 if large),
      // so both header and footer metadata land on the server in the first ~3MB.
      const queue = [];
      queue.push(0);
      if (totalChunks > 1) {
        queue.push(totalChunks - 1);
      }
      if (totalChunks > 4) {
        queue.push(totalChunks - 2);
      }
      for (let idx = 1; idx < totalChunks; idx++) {
        if (!queue.includes(idx)) {
          queue.push(idx);
        }
      }

      let queuePos = 0;
      let completedCount = 0;
      let firstError = null;
      let stopped = false;

      const uploadOne = async (i) => {
        let attempts = 0;
        const maxAttempts = 4;
        while (attempts < maxAttempts) {
          if (abortRef.current || stopped) return;
          try {
            attempts++;
            const start = i * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, file.size);
            const chunk = file.slice(start, end);

            const formData = new FormData();
            formData.append('chunk', chunk);

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 35000);

            const res = await fetch(`${serverUrl}/api/stream/${streamKey}/chunk/${i}`, {
              method: 'POST',
              headers: token ? { 'Authorization': `Bearer ${token}` } : {},
              body: formData,
              signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!res.ok) {
              const text = await res.text().catch(() => '');
              throw new Error(`HTTP ${res.status}: ${text || 'Chunk failed'}`);
            }

            await res.json();
            completedCount += 1;
            const progress = Math.round((completedCount / totalChunks) * 100);
            console.log('[UPLOAD] Chunk', i + 1, 'of', totalChunks, `(${progress}% overall)`);
            setUploadState(prev => ({ ...prev, progress }));
            return; // Successful chunk upload
          } catch (err) {
            console.warn(`[UPLOAD] Chunk ${i} attempt ${attempts} failed:`, err.message);
            if (abortRef.current) return;
            if (attempts >= maxAttempts) {
              throw err;
            }
            // Exponential backoff before retry (1s, 2s, 3s)
            await new Promise(r => setTimeout(r, 1000 * attempts));
          }
        }
      };

      const worker = async () => {
        while (!abortRef.current && !stopped) {
          if (queuePos >= queue.length) return;
          const i = queue[queuePos++];
          try {
            await uploadOne(i);
          } catch (err) {
            firstError = err;
            stopped = true;
            return;
          }
        }
      };

      await Promise.all(
        Array.from({ length: Math.min(UPLOAD_CONCURRENCY, totalChunks) }, () => worker())
      );

      if (firstError) throw firstError;

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
    setUploadState(prev => {
      const keyToCancel = prev.streamKey;
      if (socket && roomId) {
        socket.emit('stream_cancelled', { roomId, streamKey: keyToCancel });
      }
      return {
        isUploading: false,
        progress: 0,
        filename: '',
        streamKey: null,
        error: null,
        canPlay: false
      };
    });
  }, [socket, roomId]);

  return { uploadState, uploadFile, cancelUpload };
}
