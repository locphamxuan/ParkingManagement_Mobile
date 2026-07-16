import { apiRequest, type ApiRes } from './api';

export interface MobileIncident {
  _id: string;
  code: string;
  type: string;
  note?: string;
  target?: string;
  building?: { _id: string; code: string; name: string } | string | null;
  slot?: { _id: string; code: string } | string | null;
  severity: 'medium' | 'high' | 'critical';
  status: 'open' | 'investigating' | 'escalated' | 'resolved' | 'closed';
  resolutionNote?: string;
  createdAt: string;
}

export async function listMyIncidents(token: string): Promise<MobileIncident[]> {
  const res = await apiRequest<ApiRes<{ items?: MobileIncident[]; incidents?: MobileIncident[] } | MobileIncident[]>>(
    '/users/incidents/me',
    {
      method: 'GET',
      token,
    }
  );
  const data = res?.data;
  if (Array.isArray(data)) return data;
  return (data as any)?.items ?? (data as any)?.incidents ?? [];
}

export async function reportIncident(
  token: string,
  payload: {
    type: string;
    buildingId?: string;
    slotId?: string;
    target?: string;
    note?: string;
  }
): Promise<MobileIncident> {
  const res = await apiRequest<ApiRes<{ item?: MobileIncident; incident?: MobileIncident } | MobileIncident>>(
    '/users/incidents',
    {
      method: 'POST',
      body: payload,
      token,
    }
  );
  const data = res?.data;
  if (!data) throw new Error('Failed to report incident');
  return (data as any).item ?? (data as any).incident ?? (data as MobileIncident);
}
