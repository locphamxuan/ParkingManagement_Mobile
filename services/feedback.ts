import { Platform } from 'react-native';
import { apiRequest, API_BASE, ApiError } from './api';

export interface SubmitFeedbackPayload {
  parkingSessionId: string;
  rating: number;
  comment: string;
  portraitImageUrl?: string | null;
  plateImageUrl?: string | null;
}

export interface FeedbackItem {
  _id: string;
  parkingSession?: string;
  rating: number;
  comment: string;
  portraitImageUrl?: string | null;
  plateImageUrl?: string | null;
  status?: 'pending' | 'resolved';
  staffReply?: string | null;
  createdAt?: string;
}

interface SubmitFeedbackResponse {
  data?: {
    feedback?: FeedbackItem;
  };
}

interface UploadImageResponse {
  data?: {
    url?: string;
    filename?: string;
  };
}

const guessImageMeta = (uri: string, fallbackType?: string): { name: string; type: string } => {
  const cleaned = uri.split('?')[0];
  const extMatch = /\.(\w+)$/.exec(cleaned);
  const ext = (extMatch?.[1] || 'jpg').toLowerCase();
  const typeByExt: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    heic: 'image/heic',
    heif: 'image/heif',
  };
  const type = fallbackType || typeByExt[ext] || 'image/jpeg';
  const name = `upload_${Date.now()}.${ext}`;
  return { name, type };
};

const extFromMime = (mime: string): string => {
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/heic') return 'heic';
  if (mime === 'image/heif') return 'heif';
  return 'jpg';
};

/**
 * Uploads a locally-picked image to the backend and returns a public URL that
 * both the manager web dashboard and the mobile app can render.
 *
 * Web (Expo Web): the image picker returns a `blob:` URL. We must fetch it to
 * obtain a real Blob and append that to FormData; appending `{ uri, name, type }`
 * here would just be JSON-stringified by the browser and the server would
 * receive an empty file (400 "No image file provided").
 *
 * Native (iOS/Android): React Native's FormData accepts `{ uri, name, type }`
 * directly and streams the file from disk.
 */
export async function uploadFeedbackImage(token: string, localUri: string): Promise<string> {
  const form = new FormData();

  if (Platform.OS === 'web') {
    const blob = await (await fetch(localUri)).blob();
    const mime = blob.type || 'image/jpeg';
    const ext = extFromMime(mime);
    const filename = `upload_${Date.now()}.${ext}`;
    form.append('image', blob, filename);
  } else {
    const { name, type } = guessImageMeta(localUri);
    form.append('image', { uri: localUri, name, type } as unknown as Blob);
  }

  const res = await fetch(`${API_BASE}/user/feedbacks/upload`, {
    method: 'POST',
    headers: {
      // NOTE: do NOT set Content-Type manually; fetch adds the multipart boundary.
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: form,
  });

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (!res.ok) {
    const message =
      typeof payload === 'object' && payload !== null && 'message' in payload
        ? String((payload as { message?: unknown }).message)
        : `Upload failed (${res.status})`;
    const errorCode =
      typeof payload === 'object' && payload !== null && 'errorCode' in payload
        ? String((payload as { errorCode?: unknown }).errorCode)
        : undefined;
    throw new ApiError(message, res.status, errorCode, payload);
  }

  const url = (payload as UploadImageResponse)?.data?.url;
  if (!url) {
    throw new ApiError('Upload succeeded but no URL returned', 500);
  }
  return url;
}

export async function submitParkingFeedback(
  token: string,
  payload: SubmitFeedbackPayload,
): Promise<FeedbackItem | null> {
  const res = await apiRequest<SubmitFeedbackResponse>('/user/feedbacks', {
    method: 'POST',
    token,
    body: {
      parkingSessionId: payload.parkingSessionId,
      rating: payload.rating,
      comment: payload.comment,
      portraitImageUrl: payload.portraitImageUrl?.trim() || null,
      plateImageUrl: payload.plateImageUrl?.trim() || null,
    },
  });

  return res?.data?.feedback ?? null;
}
