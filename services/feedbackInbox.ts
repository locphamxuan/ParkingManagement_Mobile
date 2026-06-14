import { apiRequest } from './api';

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
  building?: {
    _id?: string;
    name?: string;
    code?: string;
  } | null;
  parkingSession?: {
    _id?: string;
    plateNumber?: string;
    entryTime?: string;
    exitTime?: string;
    status?: string;
  } | null;
  repliedBy?: {
    _id?: string;
    fullName?: string;
    email?: string;
    role?: string;
  } | null;
}

interface FeedbackInboxResponse {
  data?: {
    items?: FeedbackInboxItem[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

export async function listMyFeedbackInbox(token: string): Promise<FeedbackInboxItem[]> {
  const res = await apiRequest<FeedbackInboxResponse>('/user/feedbacks/me', {
    method: 'GET',
    token,
  });

  return res?.data?.items ?? [];
}
