import { apiRequest } from './api';

// ─── Feedback inbox (replies from managers) ───────────────────────────────────

export interface FeedbackInboxItem {
  _id: string;
  rating: number;
  comment?: string;
  staffReply?: string | null;
  status?: 'pending' | 'resolved';
  updatedAt?: string;
  createdAt?: string;
  portraitImageUrl?: string | null;
  plateImageUrl?: string | null;
  building?: { _id?: string; name?: string; code?: string } | null;
  parkingSession?: {
    _id?: string;
    plateNumber?: string;
    entryTime?: string;
    exitTime?: string;
    status?: string;
  } | null;
  repliedBy?: { _id?: string; fullName?: string; email?: string; role?: string } | null;
}

export async function listMyFeedbackInbox(token: string): Promise<FeedbackInboxItem[]> {
  const res = await apiRequest<{ data?: { items?: FeedbackInboxItem[] } }>('/user/feedbacks/me', {
    token,
  });
  return res?.data?.items ?? [];
}

// ─── Submit feedback ──────────────────────────────────────────────────────────

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
