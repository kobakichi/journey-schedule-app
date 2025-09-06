export type DaySchedule = {
  id: number;
  date: string; // ISO
  title?: string | null;
  notes?: string | null;
  items: ScheduleItem[];
};

export type ScheduleItem = {
  id: number;
  title: string;
  emoji?: string | null;
  color?: string | null;
  startTime: string; // ISO
  endTime?: string | null; // ISO
  location?: string | null;
  kind?: 'general' | 'move' | null;
  departurePlace?: string | null;
  arrivalPlace?: string | null;
  notes?: string | null;
};

export type User = {
  id: number;
  email?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
  publicSlug?: string | null;
};

const json = (r: Response) => r.ok ? r.json() : r.json().then(e => Promise.reject(e));

export async function fetchDay(dateStr: string, owner?: number | string): Promise<{ schedule: DaySchedule | null }>{
  const q = new URLSearchParams({ date: dateStr });
  if (typeof owner === 'number' && Number.isFinite(owner)) q.set('ownerId', String(owner));
  if (typeof owner === 'string' && owner) q.set('owner', owner);
  const res = await fetch(`/api/day?${q.toString()}`);
  const data = await json(res);
  if (!data.schedule) return { schedule: null };
  // normalize dates to ISO strings
  data.schedule.date = new Date(data.schedule.date).toISOString();
  data.schedule.items = data.schedule.items.map((it: any) => ({
    ...it,
    startTime: new Date(it.startTime).toISOString(),
    endTime: it.endTime ? new Date(it.endTime).toISOString() : null,
    kind: it.kind ? String(it.kind).toLowerCase() : null,
  }));
  return data;
}

export async function upsertDay(input: { date: string; title?: string; notes?: string }){
  const res = await fetch('/api/day', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  return json(res);
}

export async function createItem(input: {
  date: string; title: string; emoji?: string; color?: string; startTime: string; endTime?: string; location?: string; notes?: string; kind?: 'general'|'move'; departurePlace?: string; arrivalPlace?: string; ownerId?: number; ownerSlug?: string;
}) {
  const res = await fetch('/api/item', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  return json(res);
}

export async function updateItem(id: number, input: Partial<{ title: string; emoji: string; color: string; startTime: string; endTime: string; date: string; location: string; notes: string; kind: 'general'|'move'; departurePlace: string; arrivalPlace: string; }>) {
  const res = await fetch(`/api/item/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  return json(res);
}

export async function deleteItem(id: number) {
  const res = await fetch(`/api/item/${id}`, { method: 'DELETE' });
  return json(res);
}

const pad = (n: number) => String(n).padStart(2, '0');
export const toDateInput = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
export const toTimeInput = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

export async function me(): Promise<{ user: User | null }> {
  const res = await fetch('/api/me');
  return json(res);
}

export async function loginWithGoogleIdToken(idToken: string): Promise<{ user: User }>{
  const res = await fetch('/api/auth/google', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken })
  });
  return json(res);
}

export async function logout() {
  const res = await fetch('/api/logout', { method: 'POST' });
  return json(res);
}

// Sharing APIs
export type ShareEntry = { id: number; canEdit: boolean; sharedWithUserId: number; sharedWith?: { id: number; email?: string | null; name?: string | null } };
export async function listDayShares(date: string): Promise<{ shares: ShareEntry[] }>{
  const res = await fetch(`/api/share/day?date=${encodeURIComponent(date)}`);
  return json(res);
}
export async function addDayShare(input: { date: string; email: string; canEdit?: boolean }): Promise<{ share: { id: number; canEdit: boolean; sharedWithUserId: number } }>{
  const res = await fetch('/api/share/day', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  return json(res);
}
export async function removeDayShare(date: string, userId: number): Promise<{ ok: true }>{
  const q = new URLSearchParams({ date, userId: String(userId) });
  const res = await fetch(`/api/share/day?${q.toString()}`, { method: 'DELETE' });
  return json(res);
}

export async function listSharedOwners(date: string): Promise<{ owners: { id: number; email?: string | null; name?: string | null }[] }>{
  const res = await fetch(`/api/shared/day/list?date=${encodeURIComponent(date)}`);
  return json(res);
}

// Invite APIs (token-based)
export type InviteMeta = { token: string; invitedEmail?: string | null; canEdit: boolean; expiresAt?: string | null; redeemedAt?: string | null; owner?: { id: number; email?: string | null; name?: string | null }; date?: string; expired?: boolean };
export async function createInvite(input: { date: string; canEdit?: boolean; email?: string; ttlHours?: number }): Promise<{ invite: { id: number; token: string; canEdit: boolean; invitedEmail?: string | null; expiresAt?: string | null } }>{
  const res = await fetch('/api/share/day/invite', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
  return json(res);
}
export async function listInvites(date: string): Promise<{ invites: { id: number; token: string; invitedEmail?: string | null; canEdit: boolean; expiresAt?: string | null; redeemedAt?: string | null; redeemedByUserId?: number | null }[] }>{
  const res = await fetch(`/api/share/day/invites?date=${encodeURIComponent(date)}`);
  return json(res);
}
export async function deleteInvite(id: number): Promise<{ ok: true }>{
  const res = await fetch(`/api/share/day/invite/${id}`, { method: 'DELETE' });
  return json(res);
}
export async function getInvite(token: string): Promise<{ invite: InviteMeta }>{
  const res = await fetch(`/api/share/invite/${encodeURIComponent(token)}`);
  return json(res);
}
export async function acceptInvite(token: string): Promise<{ ok: true; ownerId: number; date: string }>{
  const res = await fetch(`/api/share/invite/${encodeURIComponent(token)}/accept`, { method: 'POST' });
  return json(res);
}
