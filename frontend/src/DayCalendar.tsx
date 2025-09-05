import { useEffect, useMemo, useRef, useState } from 'react';
import { type ScheduleItem } from './api';
import { toLocalWallClock } from './time';

type Props = {
  items: ScheduleItem[];
  date: string; // YYYY-MM-DD
  onChangeTime?: (id: number, startHHmm: string, endHHmm?: string) => void;
  onRequestCreate?: (startHHmm: string) => void;
};

const pxPerMin = 1; // 1分=1px → 24h=1440px
const SNAP_MIN = 5; // 5分刻み
const MIN_DURATION_MIN = 15; // 最小15分

function minsFromMidnight(d: Date) {
  return d.getHours() * 60 + d.getMinutes();
}

// ピンク系の既存データ色を中立色に置換
const neutralizeColor = (c?: string | null): string | undefined => {
  if (!c) return undefined;
  const s = String(c).toLowerCase().trim();
  const sNoSpace = s.replace(/\s+/g, '');
  if (s === '#ffd1dc' || sNoSpace === 'rgb(255,209,220)') return '#E5E7EB';
  return c || undefined;
};

export default function DayCalendar({ items, date, onChangeTime, onRequestCreate }: Props) {
  const hours = useMemo(()=>Array.from({ length: 25 }, (_, i) => i), []);
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ id: number; startTop: number; startY: number; duration: number; }|null>(null);
  const [resize, setResize] = useState<{ id: number; startHeight: number; startY: number; top: number; }|null>(null);
  const [overrides, setOverrides] = useState<Record<number, number>>({}); // id -> top px
  const [overrideHeights, setOverrideHeights] = useState<Record<number, number>>({}); // id -> height px
  const longPressTimerRef = useRef<number | null>(null); // for drag start
  const longPressResizeTimerRef = useRef<number | null>(null);
  const longPressCreateTimerRef = useRef<number | null>(null);
  const pendingDragRef = useRef<{ id: number; startTop: number; startY: number; duration: number } | null>(null);
  const pendingResizeRef = useRef<{ id: number; startHeight: number; startY: number; top: number } | null>(null);
  const gridTouchStartRef = useRef<{ y: number } | null>(null);
  const suppressNextGridClickRef = useRef<boolean>(false);

  useEffect(()=>{ const onUp = () => {
    setDrag(null); setResize(null);
    if (longPressTimerRef.current) { window.clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
    if (longPressResizeTimerRef.current) { window.clearTimeout(longPressResizeTimerRef.current); longPressResizeTimerRef.current = null; }
    if (longPressCreateTimerRef.current) { window.clearTimeout(longPressCreateTimerRef.current); longPressCreateTimerRef.current = null; }
    pendingDragRef.current = null;
    pendingResizeRef.current = null;
    gridTouchStartRef.current = null;
  }; window.addEventListener('pointerup', onUp); return () => window.removeEventListener('pointerup', onUp); },[]);

  function onPointerDown(e: React.PointerEvent, it: ScheduleItem){
    const start = toLocalWallClock(it.startTime);
    const end = it.endTime ? toLocalWallClock(it.endTime) : new Date(start.getTime()+30*60000);
    const top = minsFromMidnight(start) * pxPerMin;
    const duration = Math.max(30, Math.round((end.getTime()-start.getTime())/60000));
    if ((e as any).pointerType === 'touch') {
      // モバイルは長押しでドラッグ開始（誤操作防止）
      pendingDragRef.current = { id: it.id, startTop: top, startY: e.clientY, duration };
      if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = window.setTimeout(() => {
        if (pendingDragRef.current) {
          setDrag({ ...pendingDragRef.current });
        }
      }, 350);
      // タイマー発火前はスクロールをブロックしないため pointer capture は行わない
    } else {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      setDrag({ id: it.id, startTop: top, startY: e.clientY, duration });
    }
  }
  function onPointerMove(e: React.PointerEvent){
    const cont = containerRef.current; const grid = gridRef.current; if(!cont||!grid) return;
    const rect = grid.getBoundingClientRect();
    const scrollTop = cont.scrollTop;
    const y = e.clientY - rect.top + scrollTop;
    if(drag){
      const delta = y - (drag.startY - rect.top + scrollTop);
      let nextTop = Math.round((drag.startTop + delta) / SNAP_MIN) * SNAP_MIN;
      nextTop = Math.max(0, Math.min(1440 - drag.duration, nextTop));
      setOverrides(prev => ({ ...prev, [drag.id]: nextTop }));
      return;
    }
    if (pendingDragRef.current) {
      // 長押し前に大きく動いたら（スクロール意図）ドラッグをキャンセル
      const dy = Math.abs(e.clientY - pendingDragRef.current.startY);
      if (dy > 8) {
        if (longPressTimerRef.current) { window.clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
        pendingDragRef.current = null;
      }
      return;
    }
    if (pendingResizeRef.current) {
      const dy = Math.abs(e.clientY - pendingResizeRef.current.startY);
      if (dy > 8) {
        if (longPressResizeTimerRef.current) { window.clearTimeout(longPressResizeTimerRef.current); longPressResizeTimerRef.current = null; }
        pendingResizeRef.current = null;
      }
      return;
    }
    if (gridTouchStartRef.current) {
      const dy = Math.abs(e.clientY - gridTouchStartRef.current.y);
      if (dy > 8) {
        if (longPressCreateTimerRef.current) { window.clearTimeout(longPressCreateTimerRef.current); longPressCreateTimerRef.current = null; }
        gridTouchStartRef.current = null;
      }
      return;
    }
    if(resize){
      const delta = y - (resize.startY - rect.top + scrollTop);
      let nextHeight = Math.round((resize.startHeight + delta) / SNAP_MIN) * SNAP_MIN;
      nextHeight = Math.max(MIN_DURATION_MIN, Math.min(1440 - resize.top, nextHeight));
      setOverrideHeights(prev => ({ ...prev, [resize.id]: nextHeight }));
      return;
    }
  }
  function onPointerUp(_e: React.PointerEvent, it: ScheduleItem){
    // 長押し待ちを解除
    if (longPressTimerRef.current) { window.clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
    if (longPressResizeTimerRef.current) { window.clearTimeout(longPressResizeTimerRef.current); longPressResizeTimerRef.current = null; }
    if (longPressCreateTimerRef.current) { window.clearTimeout(longPressCreateTimerRef.current); longPressCreateTimerRef.current = null; }
    pendingDragRef.current = null;
    pendingResizeRef.current = null;
    gridTouchStartRef.current = null;
    if(drag){
      const top = overrides[it.id] ?? drag.startTop;
      const startMin = Math.round(top);
      const hh = String(Math.floor(startMin/60)).padStart(2,'0');
      const mm = String(startMin%60).padStart(2,'0');
      const endMin = startMin + (drag.duration||30);
      const eh = String(Math.floor(endMin/60)).padStart(2,'0');
      const em = String(endMin%60).padStart(2,'0');
      setDrag(null);
      onChangeTime && onChangeTime(it.id, `${hh}:${mm}`, it.endTime ? `${eh}:${em}` : undefined);
      return;
    }
    if(resize){
      const top = overrides[it.id] ?? resize.top;
      const startMin = Math.round(top);
      const height = overrideHeights[it.id] ?? resize.startHeight;
      const endMin = startMin + Math.round(height);
      const hh = String(Math.floor(startMin/60)).padStart(2,'0');
      const mm = String(startMin%60).padStart(2,'0');
      const eh = String(Math.floor(endMin/60)).padStart(2,'0');
      const em = String(endMin%60).padStart(2,'0');
      setResize(null);
      onChangeTime && onChangeTime(it.id, `${hh}:${mm}`, `${eh}:${em}`);
      return;
    }
  }

  const now = new Date();
  const showNow = new Date(date).toDateString() === now.toDateString();
  const nowTop = minsFromMidnight(now) * pxPerMin;

  function onGridClick(e: React.MouseEvent){
    if(!onRequestCreate) return;
    if (suppressNextGridClickRef.current) { suppressNextGridClickRef.current = false; return; }
    const target = e.target as HTMLElement;
    if (target.closest('.daycal-event') || target.closest('.daycal-resize')) return;
    const cont = containerRef.current; const grid = gridRef.current; if(!cont||!grid) return;
    const rect = grid.getBoundingClientRect();
    const y = e.clientY - rect.top + cont.scrollTop;
    let mins = Math.round(y / SNAP_MIN) * SNAP_MIN;
    mins = Math.max(0, Math.min(1439, mins));
    const hh = String(Math.floor(mins/60)).padStart(2,'0');
    const mm = String(mins%60).padStart(2,'0');
    onRequestCreate(`${hh}:${mm}`);
  }

  function onGridPointerDown(e: React.PointerEvent){
    if ((e as any).pointerType !== 'touch') return;
    if(!onRequestCreate) return;
    const target = e.target as HTMLElement;
    if (target.closest('.daycal-event') || target.closest('.daycal-resize')) return;
    const cont = containerRef.current; const grid = gridRef.current; if(!cont||!grid) return;
    const rect = grid.getBoundingClientRect();
    gridTouchStartRef.current = { y: e.clientY };
    if (longPressCreateTimerRef.current) window.clearTimeout(longPressCreateTimerRef.current);
    longPressCreateTimerRef.current = window.setTimeout(() => {
      if (!gridTouchStartRef.current) return;
      const y = gridTouchStartRef.current.y - rect.top + cont.scrollTop;
      let mins = Math.round(y / SNAP_MIN) * SNAP_MIN;
      mins = Math.max(0, Math.min(1439, mins));
      const hh = String(Math.floor(mins/60)).padStart(2,'0');
      const mm = String(mins%60).padStart(2,'0');
      suppressNextGridClickRef.current = true;
      onRequestCreate(`${hh}:${mm}`);
      gridTouchStartRef.current = null;
    }, 450);
  }

  return (
    <div className="daycal" ref={containerRef} onPointerMove={onPointerMove}>
      <div className="daycal-hours">
        {hours.map((h) => (
          <div key={h} className="daycal-hour" style={{ height: 60 * pxPerMin }}>
            {h < 24 && <span className="daycal-hourlabel">{String(h).padStart(2, '0')}:00</span>}
          </div>
        ))}
      </div>
      <div className="daycal-grid" ref={gridRef} onClick={onGridClick} onPointerDown={onGridPointerDown}>
        {hours.map((h) => (
          <div key={h} className="daycal-gridline" style={{ height: 60 * pxPerMin }} />
        ))}
        {showNow && <div style={{ position:'absolute', left:0, right:0, top: nowTop, height: 2, background: '#ef4444', opacity: 0.8 }} />}
        {items.map((it) => {
          const start = toLocalWallClock(it.startTime);
          const end = it.endTime ? toLocalWallClock(it.endTime) : new Date(start.getTime() + 30 * 60000);
          const originalTop = minsFromMidnight(start) * pxPerMin;
          const top = overrides[it.id] ?? originalTop;
          const computedHeight = Math.max(MIN_DURATION_MIN, (Math.max(0, (end.getTime() - start.getTime())) / 60000) * pxPerMin);
          const height = overrideHeights[it.id] ?? computedHeight;
          const isMove = (it.kind || 'general') === 'move';
          const routeLabel = `${it.departurePlace || '出発地未設定'} → ${it.arrivalPlace || '到着地未設定'}`;
          const titleHasRoute = (it.title || '').includes('→') || (it.title || '') === routeLabel;
          return (
            <div
              key={it.id}
              className="daycal-event"
              style={{ top, height, borderLeftColor: neutralizeColor(it.color) || '#E5E7EB', touchAction: 'manipulation' }}
              onPointerDown={(e)=>onPointerDown(e, it)}
              onPointerUp={(e)=>onPointerUp(e, it)}
            >
              <div className="daycal-event-title">{it.title}</div>
              {isMove && !titleHasRoute ? (
                <div className="daycal-event-sub">{routeLabel}</div>
              ) : null}
              <div className="daycal-resize"
                onPointerDown={(e)=>{
                  e.stopPropagation();
                  const start = toLocalWallClock(it.startTime);
                  const end = it.endTime ? toLocalWallClock(it.endTime) : new Date(start.getTime()+30*60000);
                  const h = Math.max(MIN_DURATION_MIN, (Math.max(0, (end.getTime() - start.getTime())) / 60000) * pxPerMin);
                  if ((e as any).pointerType === 'touch') {
                    pendingResizeRef.current = { id: it.id, startHeight: h, startY: e.clientY, top };
                    if (longPressResizeTimerRef.current) window.clearTimeout(longPressResizeTimerRef.current);
                    longPressResizeTimerRef.current = window.setTimeout(() => {
                      if (pendingResizeRef.current) {
                        setResize({ ...pendingResizeRef.current });
                      }
                    }, 350);
                  } else {
                    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                    setResize({ id: it.id, startHeight: h, startY: e.clientY, top });
                  }
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
