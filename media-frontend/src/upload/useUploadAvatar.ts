import { useCallback, useEffect, useRef, useState } from 'react';
import {
  updateProfileAvatar,
} from '../api/operations_v2';
import { AdvancedUploader } from './advancedUploader';
import type { MediaStatus, UploadProgressState } from './types';
import { mediaSocket } from './websocket';

const IDLE: UploadProgressState = {
  mediaId: null,
  uploadId: null,
  phase: 'IDLE',
  uploadedBytes: 0,
  totalBytes: 0,
  uploadedParts: 0,
  totalParts: 0,
  status: null,
};

export function useUploadAvatar(accessToken: string | null): {
  progress: UploadProgressState;
  uploadAvatar: (file: File, tokenOverride?: string) => Promise<{ mediaId: string }>;
  reset: () => void;
} {
  const [progress, setProgress] = useState<UploadProgressState>(IDLE);
  const accessTokenRef = useRef(accessToken);
  accessTokenRef.current = accessToken;

  useEffect(() => {
    if (!accessToken) return;
    const off = mediaSocket.onEvent((event) => {
      if (!event.mediaId) return;
      setProgress((p) => {
        if (p.mediaId && p.mediaId !== event.mediaId) return p;
        return { ...p, status: mediaSocketStatus(event) ?? p.status };
      });
    });
    mediaSocket.connect(accessToken);
    return () => {
      off();
      mediaSocket.disconnect();
    };
  }, [accessToken]);

  const uploadAvatar = useCallback(async (file: File, tokenOverride?: string) => {
    const activeToken = tokenOverride || accessTokenRef.current;
    if (activeToken) {
      localStorage.setItem('accessToken', activeToken);
    }
    setProgress({
      ...IDLE,
      phase: 'CREATING_SESSION',
      totalBytes: file.size,
      status: 'PENDING',
    });

    const mediaId = await new Promise<string>((resolve, reject) => {
      const uploader = new AdvancedUploader(file, (info) => {
        if (info.phase === 'UPLOADING') {
          setProgress((p) => ({
            ...p,
            mediaId: uploader.getMediaId() || p.mediaId,
            phase: 'UPLOADING',
            uploadedBytes: info.uploadedBytes,
            totalBytes: info.totalBytes,
          }));
        } else if (info.phase === 'COMPLETING') {
          setProgress((p) => ({ ...p, phase: 'COMPLETING' }));
        } else if (info.phase === 'DONE') {
          const mid = uploader.getMediaId();
          if (mid) resolve(mid);
          else reject(new Error('No mediaId from uploader'));
        } else if (info.phase === 'ERROR') {
          reject(new Error(info.error || 'Upload failed'));
        }
      });
      uploader.start().catch(reject);
    });

    setProgress((p) => ({
      ...p,
      mediaId,
      phase: 'LINKING_AVATAR',
      status: 'UPLOADED',
    }));

    await updateProfileAvatar(mediaId);

    setProgress((p) => ({ ...p, phase: 'DONE', status: 'READY' }));
    return { mediaId };
  }, []);

  const reset = useCallback(() => setProgress(IDLE), []);

  return { progress, uploadAvatar, reset };
}

function mediaSocketStatus(event: { event: string }): MediaStatus | null {
  switch (event.event) {
    case 'SCAN_STARTED':
      return 'SCANNING';
    case 'SCAN_COMPLETED':
    case 'PROCESSING_STARTED':
      return 'PROCESSING';
    case 'SCAN_FAILED':
    case 'PROCESSING_FAILED':
      return 'FAILED';
    case 'READY':
      return 'READY';
    case 'DELETE_COMPLETED':
      return 'DELETED';
    default:
      return null;
  }
}
