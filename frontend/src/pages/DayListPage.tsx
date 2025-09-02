import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { createItem, DaySchedule, deleteItem, fetchDay, toDateInput, toTimeInput, updateItem, type ScheduleItem as ApiItem, upsertDay } from '../api';
import { durationMinutes, formatDuration } from '../time';
import BottomNav from '../components/BottomNav';
import { getTheme, setTheme, type Theme } from '../theme';
import AuthButton from '../components/AuthButton';
import { addDays } from '../date';

type NewItemState = { startTime: string; endTime: string; departurePlace: string; arrivalPlace: string; notes: string; };

export default function DayListPage(){
  const { date: paramDate } = useParams();
  const date = paramDate || toDateInput(new Date());
  const [schedule, setSchedule] = useState<DaySchedule | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [newItem, setNewItem] = useState<NewItemState>({ startTime: toTimeInput(new Date()), endTime: '', departurePlace: '', arrivalPlace: '', notes: '' });
  const nav = useNavigate();

  useEffect(() => { (async () => {
    setLoading(true); setError(null);
    try { const res = await fetchDay(date); setSchedule(res.schedule); setTitle(res.schedule?.title || ''); } catch(e:any){ setError(e?.error || '読み込みに失敗しました'); } finally { setLoading(false); }
  })(); }, [date]);

  async function saveDay(){ try{ const res = await upsertDay({ date, title }); setSchedule(res.schedule);} catch(e:any){ alert(e?.error || '保存に失敗しました'); } }

  const items = useMemo(() => schedule?.items || [], [schedule]);

  async function addItem(){
    const isMove = !!(newItem.departurePlace || newItem.arrivalPlace);
    const computedKind = isMove ? 'move' : 'general';
    const computedTitle = isMove ? (newItem.departurePlace && newItem.arrivalPlace ? `${newItem.departurePlace} → ${newItem.arrivalPlace}` : '移動') : '予定';
    try {
      await createItem({ date, title: computedTitle, startTime: newItem.startTime, endTime: newItem.endTime || undefined, kind: computedKind, departurePlace: isMove ? (newItem.departurePlace || undefined) : undefined, arrivalPlace: isMove ? (newItem.arrivalPlace || undefined) : undefined, notes: newItem.notes || undefined });
      const refreshed = await fetchDay(date); setSchedule(refreshed.schedule);
      setNewItem({ startTime: newItem.startTime, endTime: '', departurePlace: '', arrivalPlace: '', notes: '' });
    } catch(e:any){ alert(e?.error || '追加に失敗しました'); }
  }

  async function removeItem(id: number){ if(!confirm('この項目を削除しますか？'))return; try{ await deleteItem(id); const refreshed = await fetchDay(date); setSchedule(refreshed.schedule);} catch(e:any){ alert(e?.error || '削除に失敗しました'); } }

  const [theme, setThemeState] = useState<Theme>(getTheme());
  function nextTheme(t: Theme): Theme { return t === 'auto' ? 'light' : t === 'light' ? 'dark' : 'auto'; }
  function onToggleTheme(){ const t = nextTheme(theme); setThemeState(t); setTheme(t); }
  const themeLabel = theme === 'auto' ? '自動' : theme === 'light' ? 'ライト' : 'ダーク';

  return (
    <div className="container" style={{ paddingBottom: 80 }}>
      <header className="header" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="brand">旅のしおり</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="ghost" onClick={onToggleTheme} aria-label={`テーマ: ${themeLabel}`} title={`テーマ: ${themeLabel}`}>
            {theme === 'auto' ? '自動' : theme === 'light' ? 'ライト' : 'ダーク'}
          </button>
          <AuthButton onAuth={() => { /* stay */ }} />
        </div>
      </header>
      <section className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button className="ghost" onClick={() => nav(`/day/${addDays(date, -1)}`)}>前日</button>
          <input type="date" value={date} onChange={(e)=> e.target.value && nav(`/day/${e.target.value}`)} />
          <button className="ghost" onClick={() => nav(`/day/${toDateInput(new Date())}`)}>今日</button>
          <button className="ghost" onClick={() => nav(`/day/${addDays(date, 1)}`)}>翌日</button>
        </div>
        <div className="divider" />
        <label className="muted" style={{ fontWeight: 700, display: 'block', marginBottom: 8 }}>1日のテーマ</label>
        <input placeholder="例: 休日のんびりDAY" value={title} onChange={(e)=>setTitle(e.target.value)} onBlur={saveDay} />
      </section>

      <section className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>項目を追加</strong>
        </div>
        <div className="divider" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <input placeholder="出発地（移動の場合）" value={newItem.departurePlace} onChange={(e)=>setNewItem({ ...newItem, departurePlace: e.target.value })} />
          <input placeholder="到着地（移動の場合）" value={newItem.arrivalPlace} onChange={(e)=>setNewItem({ ...newItem, arrivalPlace: e.target.value })} />
          <input aria-label="出発時刻" placeholder="出発時刻" type="time" value={newItem.startTime} onChange={(e)=>setNewItem({ ...newItem, startTime: e.target.value })} />
          <input aria-label="到着時刻" placeholder="到着時刻" type="time" value={newItem.endTime} onChange={(e)=>setNewItem({ ...newItem, endTime: e.target.value })} />
          <input placeholder="メモ" value={newItem.notes} onChange={(e)=>setNewItem({ ...newItem, notes: e.target.value })} />
        </div>
        <div className="muted" style={{ marginTop: 6 }}>{newItem.endTime && (()=>{ const s=new Date(`${date}T${newItem.startTime||'00:00'}:00`); const e=new Date(`${date}T${newItem.endTime}:00`); const m=durationMinutes(s,e); return m>0?`所要時間: ${formatDuration(m)}`:''; })()}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <button onClick={addItem}>追加</button>
        </div>
      </section>

      <section className="card" style={{ minHeight: 420, marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>タイムライン（リスト）</strong>
          {loading ? <span className="muted">読み込み中…</span> : error ? <span className="muted">{error}</span> : <span className="muted">{date}</span>}
        </div>
        <div className="divider" />
        <div className="timeline">
          {items.length===0 && <div className="muted">この日にまだ予定はありません</div>}
          {items.map(it=>{
            const start=new Date(it.startTime); const end=it.endTime?new Date(it.endTime):null; const span=end?`${toTimeInput(start)} - ${toTimeInput(end)}`:`${toTimeInput(start)}`;
            const dur=end?formatDuration(durationMinutes(start,end)):'';
            return (
              <div key={it.id} style={{ display:'contents' }}>
                <div className="timecell">{span}</div>
                <div className="item" style={{ borderLeft:`6px solid ${it.color||'#FFD1DC'}` }}>
                  <ListItemContent item={it} date={date} durationLabel={dur} onSaved={async()=>{ const r=await fetchDay(date); setSchedule(r.schedule); }} onDelete={()=>removeItem(it.id)} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <BottomNav />
    </div>
  );
}

import { type ScheduleItem as Item } from '../api';
function ListItemContent({ item, date, durationLabel, onSaved, onDelete }: { item: Item; date: string; durationLabel: string; onSaved: ()=>void|Promise<void>; onDelete: ()=>void; }){
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    startTime: toTimeInput(new Date(item.startTime)), endTime: item.endTime?toTimeInput(new Date(item.endTime)):'',
    departurePlace: item.departurePlace || '', arrivalPlace: item.arrivalPlace || '', notes: item.notes || '',
  });
  async function save(){
    try{
      const isMove = !!(form.departurePlace || form.arrivalPlace);
      const title = isMove ? (form.departurePlace && form.arrivalPlace ? `${form.departurePlace} → ${form.arrivalPlace}` : '移動') : '予定';
      await updateItem(item.id, { date, title, startTime: form.startTime, endTime: form.endTime||undefined, kind: isMove ? 'move' : 'general', departurePlace: isMove ? (form.departurePlace||'') : undefined, arrivalPlace: isMove ? (form.arrivalPlace||'') : undefined, notes: form.notes||'' } as any);
      await onSaved(); setEditing(false);
    } catch(e:any){ alert(e?.error || '更新に失敗しました'); }
  }
  if(!editing){ const isMove=(item.kind||'general')==='move'; const routeLabel=`${item.departurePlace||'出発地未設定'} → ${item.arrivalPlace||'到着地未設定'}`; const titleHasRoute=(item.title||'').includes('→')||(item.title||'')===routeLabel; if(isMove){ const displayTitle=titleHasRoute?'':(item.title||'移動'); return (
      <div style={{ display:'grid', gridTemplateColumns:'1fr auto auto', rowGap:6, columnGap:10, alignItems:'center', width:'100%' }}>
        <div className="muted" style={{ fontSize:13, gridColumn:'1 / -1' }}>{routeLabel}</div>
        <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>{displayTitle&&<span className="item-title">{displayTitle}</span>}</div>
        {durationLabel && <div className="badge">所要 {durationLabel}</div>}
        <div style={{ display:'flex', gap:8 }}><button className="ghost" onClick={()=>setEditing(true)}>編集</button><button className="ghost" onClick={onDelete}>削除</button></div>
      </div>
  ); }
  return (<>
    <div style={{ flex:1, display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
      <span className="item-title">{item.title}</span>
      {item.location && <span className="muted" style={{ fontSize:13 }}>{item.location}</span>}
    </div>
    {durationLabel && <div className="badge">所要 {durationLabel}</div>}
    <button className="ghost" onClick={()=>setEditing(true)}>編集</button>
    <button className="ghost" onClick={onDelete}>削除</button>
  </>); }
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, width:'100%' }}>
      <input placeholder="出発地（移動の場合）" value={form.departurePlace} onChange={(e)=>setForm({ ...form, departurePlace: e.target.value })} />
      <input placeholder="到着地（移動の場合）" value={form.arrivalPlace} onChange={(e)=>setForm({ ...form, arrivalPlace: e.target.value })} />
      <input aria-label="出発時刻" placeholder="出発時刻" type="time" value={form.startTime} onChange={(e)=>setForm({ ...form, startTime: e.target.value })} />
      <input aria-label="到着時刻" placeholder="到着時刻" type="time" value={form.endTime} onChange={(e)=>setForm({ ...form, endTime: e.target.value })} />
      <input placeholder="メモ" value={form.notes} onChange={(e)=>setForm({ ...form, notes: e.target.value })} style={{ gridColumn:'1 / -1' }} />
      <div style={{ gridColumn:'1 / -1', display:'flex', justifyContent:'flex-end', gap:8 }}>
        <button className="secondary" onClick={()=>setEditing(false)}>キャンセル</button>
        <button onClick={save}>保存</button>
      </div>
    </div>
  );
}
