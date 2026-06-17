import { apiRequest } from './api';

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
