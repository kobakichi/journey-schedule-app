export function durationMinutes(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  if (ms <= 0) return 0;
  return Math.floor(ms / 60000);
}

export function formatDuration(mins: number): string {
  if (mins <= 0) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}時間${m}分`;
  if (h) return `${h}時間`;
  return `${m}分`;
}

// サーバーからのISO文字列（Z付き: UTC）を「壁時計の時刻」を保ったローカルDateに変換
// 例: '2025-09-05T09:00:00.000Z' -> ローカルタイムの 09:00 を表すDate
export function toLocalWallClock(dateIsoFromServer: string): Date {
  const d = new Date(dateIsoFromServer);
  return new Date(
    d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(),
    d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds()
  );
}
