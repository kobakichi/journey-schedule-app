export function pad(n: number) { return String(n).padStart(2, '0'); }
export function toYMD(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
export function fromYMD(s: string) { const [y,m,dd] = s.split('-').map(Number); return new Date(y, (m||1)-1, dd||1); }
export function addDays(s: string, delta: number) { const d = fromYMD(s); d.setDate(d.getDate()+delta); return toYMD(d); }
export function isToday(s: string) { const t = toYMD(new Date()); return t === s; }
export function startOfWeek(s: string, weekStartsOn: 0|1 = 1) {
  const d = fromYMD(s);
  const dow = d.getDay();
  const diff = (dow - weekStartsOn + 7) % 7;
  d.setDate(d.getDate() - diff);
  return toYMD(d);
}
export function range7(start: string) { const arr: string[] = []; let d = fromYMD(start); for (let i=0;i<7;i++){ arr.push(toYMD(d)); d = new Date(d.getFullYear(), d.getMonth(), d.getDate()+1);} return arr; }

