import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DaySchedule, fetchDay, updateItem, toDateInput, createItem } from '../api';
import DayCalendar from '../DayCalendar';
import BottomNav from '../components/BottomNav';
import { getTheme, setTheme, type Theme } from '../theme';
import AuthButton from '../components/AuthButton';
import { addDays } from '../date';

export default function DayCalendarPage(){
  const { date: paramDate } = useParams();
  const date = paramDate || new Date().toISOString().slice(0,10);
  const [schedule, setSchedule] = useState<DaySchedule | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nav = useNavigate();
  const [creating, setCreating] = useState<{ open: boolean; start: string; end: string; departurePlace: string; arrivalPlace: string; notes: string; }>()

  useEffect(()=>{ (async()=>{ setLoading(true); setError(null); try{ const res = await fetchDay(date); setSchedule(res.schedule); } catch(e:any){ setError(e?.error||'読み込みに失敗しました'); } finally{ setLoading(false);} })(); }, [date]);

  async function handleChangeTime(id: number, startHHmm: string, endHHmm?: string){
    try{ await updateItem(id, { date, startTime: startHHmm, endTime: endHHmm }); const res = await fetchDay(date); setSchedule(res.schedule); }catch(e:any){ alert(e?.error || '時間の更新に失敗しました'); }
  }

  function handleRequestCreate(startHHmm: string){
    // デフォルトで+30分
    const [h, m] = startHHmm.split(':').map(Number);
    const mins = h*60 + m;
    const endMins = Math.min(23*60+59, mins + 30);
    const eh = String(Math.floor(endMins/60)).padStart(2,'0');
    const em = String(endMins%60).padStart(2,'0');
    setCreating({ open: true, start: startHHmm, end: `${eh}:${em}`, departurePlace: '', arrivalPlace: '', notes: '' });
  }

  async function createFromSheet(){
    if(!creating?.open) return;
    const isMove = !!(creating.departurePlace || creating.arrivalPlace);
    const title = isMove
      ? (creating.departurePlace && creating.arrivalPlace ? `${creating.departurePlace} → ${creating.arrivalPlace}` : '移動')
      : '予定';
    try {
      await createItem({ date, title, startTime: creating.start, endTime: creating.end || undefined, kind: isMove ? 'move' : 'general', departurePlace: isMove ? (creating.departurePlace || undefined) : undefined, arrivalPlace: isMove ? (creating.arrivalPlace || undefined) : undefined, notes: creating.notes || undefined });
      const res = await fetchDay(date); setSchedule(res.schedule);
      setCreating(undefined);
    } catch(e:any){ alert(e?.error || '追加に失敗しました'); }
  }

  const [theme, setThemeState] = useState<Theme>(getTheme());
  const isDark = theme === 'dark';
  function toggleTheme(){ const t: Theme = isDark ? 'light' : 'dark'; setThemeState(t); setTheme(t); }

  return (
    <div className="container" style={{ paddingBottom: 80 }}>
      <header className="header" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="brand">旅のしおり</span>
        <div className="header-actions" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label className="theme-switch" title={`テーマ: ${isDark ? 'ダーク' : 'ライト'}`}>
            <input type="checkbox" checked={isDark} onChange={toggleTheme} aria-label="テーマ切り替え" />
            <span className="slider" />
          </label>
          <AuthButton onAuth={() => { /* stay */ }} />
        </div>
      </header>
      <section className="card" style={{ marginBottom: 12 }}>
        <div className="date-nav">
          <button className="ghost" onClick={() => nav(`/calendar/${addDays(date, -1)}`)}>前日</button>
          <input type="date" value={date} onChange={(e)=> e.target.value && nav(`/calendar/${e.target.value}`)} />
          <button className="ghost" onClick={() => nav(`/calendar/${toDateInput(new Date())}`)}>今日</button>
          <button className="ghost" onClick={() => nav(`/calendar/${addDays(date, 1)}`)}>翌日</button>
        </div>
      </section>
      <section className="card" style={{ minHeight: 'var(--daycal-card-min, 420px)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>タイムライン（カレンダー）</strong>
          {loading ? <span className="muted">読み込み中…</span> : error ? <span className="muted">{error}</span> : <span className="muted">{date}</span>}
        </div>
        <div className="divider" />
        <DayCalendar items={schedule?.items || []} date={date} onChangeTime={handleChangeTime} onRequestCreate={handleRequestCreate} />
      </section>
      <BottomNav />

      {creating?.open && (
        <>
          <div className="sheet-backdrop" onClick={()=>setCreating(undefined)} />
          <div className="sheet">
            <div className="grabber" />
            <strong>項目を追加</strong>
            <div className="divider" />
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              <input placeholder="出発地（移動の場合）" value={creating.departurePlace} onChange={(e)=>setCreating({ ...creating, departurePlace: e.target.value })} />
              <input placeholder="到着地（移動の場合）" value={creating.arrivalPlace} onChange={(e)=>setCreating({ ...creating, arrivalPlace: e.target.value })} />
              <input type="time" value={creating.start} onChange={(e)=>setCreating({ ...creating, start: e.target.value })} />
              <input type="time" value={creating.end} onChange={(e)=>setCreating({ ...creating, end: e.target.value })} />
              <input placeholder="メモ" value={creating.notes} onChange={(e)=>setCreating({ ...creating, notes: e.target.value })} />
            </div>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:12 }}>
              <button className="secondary" onClick={()=>setCreating(undefined)}>キャンセル</button>
              <button onClick={createFromSheet}>追加</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
