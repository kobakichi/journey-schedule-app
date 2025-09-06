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

const LONG_PRESS_DRAG_MS = 250;
const LONG_PRESS_RESIZE_MS = 250;
const LONG_PRESS_CREATE_MS = 1000; // 新規作成は約1秒の長押しで開始
const CANCEL_MOVE_PX = 4; // 移動し始めたらすぐ長押しをキャンセル（スクロール優先）
const SCROLL_COOLDOWN_MS = 200; // スクロール直後の誤発火抑止

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
  const gridScrollStartRef = useRef<number | null>(null);
  const scrollingRecentlyRef = useRef<boolean>(false);
  const scrollingTimerRef = useRef<number | null>(null);
  const lastGridPointerTypeRef = useRef<string | null>(null);
  const suppressNextGridClickRef = useRef<boolean>(false);

  useEffect(()=>{ const onUp = () => {
    setDrag(null); setResize(null);
    if (longPressTimerRef.current) { window.clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
    if (longPressResizeTimerRef.current) { window.clearTimeout(longPressResizeTimerRef.current); longPressResizeTimerRef.current = null; }
    if (longPressCreateTimerRef.current) { window.clearTimeout(longPressCreateTimerRef.current); longPressCreateTimerRef.current = null; }
    pendingDragRef.current = null;
    pendingResizeRef.current = null;
    gridTouchStartRef.current = null;
    gridScrollStartRef.current = null;
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
      }, LONG_PRESS_DRAG_MS);
      // タイマー発火前はスクロールをブロックしないため pointer capture は行わない
    } else {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      setDrag({ id: it.id, startTop: top, startY: e.clientY, duration });
    }
  }
  function onPointerMove(e: React.PointerEvent){
    // ドラッグ/リサイズ中はスクロール抑止（特にタッチ）
    if ((drag || resize) && (e as any).pointerType === 'touch') {
      e.preventDefault();
    }
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
      if (dy > CANCEL_MOVE_PX) {
        if (longPressTimerRef.current) { window.clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
        pendingDragRef.current = null;
      }
      return;
    }
    if (pendingResizeRef.current) {
      const dy = Math.abs(e.clientY - pendingResizeRef.current.startY);
      if (dy > CANCEL_MOVE_PX) {
        if (longPressResizeTimerRef.current) { window.clearTimeout(longPressResizeTimerRef.current); longPressResizeTimerRef.current = null; }
        pendingResizeRef.current = null;
      }
      return;
    }
    if (gridTouchStartRef.current) {
      const dy = Math.abs(e.clientY - gridTouchStartRef.current.y);
      // スクロールが始まった or 指が動いたら即キャンセル
      if (dy > CANCEL_MOVE_PX || (cont && gridScrollStartRef.current !== null && cont.scrollTop !== gridScrollStartRef.current)) {
        if (longPressCreateTimerRef.current) { window.clearTimeout(longPressCreateTimerRef.current); longPressCreateTimerRef.current = null; }
        gridTouchStartRef.current = null;
        gridScrollStartRef.current = null;
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
  const fmt = (m: number) => `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;

  function onGridClick(e: React.MouseEvent){
    if(!onRequestCreate) return;
    // スマホ（直前のポインタがタッチ）の単純タップでは作成しない
    if (lastGridPointerTypeRef.current === 'touch') {
      // 次の操作のためにリセット
      lastGridPointerTypeRef.current = null;
      return;
    }
    // スクロール直後はクリック作成も抑止
    if (scrollingRecentlyRef.current) return;
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
    lastGridPointerTypeRef.current = (e as any).pointerType || null;
    if ((e as any).pointerType !== 'touch') return;
    if(!onRequestCreate) return;
    if (scrollingRecentlyRef.current) return; // スクロール直後は長押し開始しない
    const target = e.target as HTMLElement;
    if (target.closest('.daycal-event') || target.closest('.daycal-resize')) return;
    const cont = containerRef.current; const grid = gridRef.current; if(!cont||!grid) return;
    const rect = grid.getBoundingClientRect();
    gridTouchStartRef.current = { y: e.clientY };
    gridScrollStartRef.current = cont.scrollTop;
    if (longPressCreateTimerRef.current) window.clearTimeout(longPressCreateTimerRef.current);
    longPressCreateTimerRef.current = window.setTimeout(() => {
      if (!gridTouchStartRef.current) return;
      // スクロールが発生していたら作成しない
      if (
        scrollingRecentlyRef.current ||
        (cont && gridScrollStartRef.current !== null && cont.scrollTop !== gridScrollStartRef.current)
      ) {
        gridTouchStartRef.current = null;
        gridScrollStartRef.current = null;
        return;
      }
      const y = gridTouchStartRef.current.y - rect.top + cont.scrollTop;
      let mins = Math.round(y / SNAP_MIN) * SNAP_MIN;
      mins = Math.max(0, Math.min(1439, mins));
      const hh = String(Math.floor(mins/60)).padStart(2,'0');
      const mm = String(mins%60).padStart(2,'0');
      suppressNextGridClickRef.current = true;
      onRequestCreate(`${hh}:${mm}`);
      gridTouchStartRef.current = null;
      gridScrollStartRef.current = null;
    }, LONG_PRESS_CREATE_MS);
  }

  function cancelGridLongPress() {
    if (longPressCreateTimerRef.current) { window.clearTimeout(longPressCreateTimerRef.current); longPressCreateTimerRef.current = null; }
    gridTouchStartRef.current = null;
    gridScrollStartRef.current = null;
  }

  return (
    <div
      className="daycal"
      ref={containerRef}
      onPointerMove={onPointerMove}
      onScroll={() => {
        // スクロール中/直後は新規追加の長押し・クリックを抑止
        if (scrollingTimerRef.current) window.clearTimeout(scrollingTimerRef.current);
        scrollingRecentlyRef.current = true;
        scrollingTimerRef.current = window.setTimeout(() => {
          scrollingRecentlyRef.current = false;
          scrollingTimerRef.current = null;
        }, SCROLL_COOLDOWN_MS);
      }}
      style={{ touchAction: (drag || resize) ? ('none' as any) : undefined }}
      onPointerLeave={cancelGridLongPress}
      onPointerCancel={cancelGridLongPress}
    >
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
          const isDragging = !!drag && drag.id === it.id;
          const isResizing = !!resize && resize.id === it.id;
          const startMin = Math.round(top);
          const endMin = Math.round(startMin + (isResizing ? height : computedHeight));
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
              {(isDragging || isResizing) && (
                <div className="daycal-timehint" aria-live="polite" aria-atomic>
                  {fmt(startMin)}{it.endTime ? ` – ${fmt(endMin)}` : ''}
                </div>
              )}
              {/* Drag grabber (immediate drag start on touch) */}
              <div
                className="daycal-grabber"
                onPointerDown={(e)=>{
                  e.stopPropagation();
                  const s = toLocalWallClock(it.startTime);
                  const eEnd = it.endTime ? toLocalWallClock(it.endTime) : new Date(s.getTime()+30*60000);
                  const topNow = minsFromMidnight(s) * pxPerMin;
                  const dur = Math.max(30, Math.round((eEnd.getTime()-s.getTime())/60000));
                  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                  // cancel any pending long-press states
                  if (longPressTimerRef.current) { window.clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
                  pendingDragRef.current = null;
                  setDrag({ id: it.id, startTop: topNow, startY: e.clientY, duration: dur });
                }}
              />
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
                    }, LONG_PRESS_RESIZE_MS);
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
