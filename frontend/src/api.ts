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

const json = (r: Response) => r.ok ? r.json() : r.json().then(e => Promise.reject(e));

export async function fetchDay(dateStr: string): Promise<{ schedule: DaySchedule | null }>{
  const res = await fetch(`/api/day?date=${encodeURIComponent(dateStr)}`);
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
  date: string; title: string; emoji?: string; color?: string; startTime: string; endTime?: string; location?: string; notes?: string; kind?: 'general'|'move'; departurePlace?: string; arrivalPlace?: string;
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
