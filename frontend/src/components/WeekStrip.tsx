import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { isToday, range7, startOfWeek } from '../date';

export default function WeekStrip({ date, basePath }: { date: string; basePath: '/day'|'/calendar' }){
  const start = useMemo(() => startOfWeek(date, 1), [date]);
  const days = useMemo(() => range7(start), [start]);
  const loc = useLocation();
  return (
    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6 }}>
      {days.map(d => {
        const active = d === date;
        const today = isToday(d);
        return (
          <Link key={d} to={`${basePath}/${d}`} state={{ from: loc.pathname }}
            style={{
              textDecoration: 'none',
              color: active ? 'white' : 'var(--text)',
              background: active ? 'var(--accent)' : '#fff',
              border: '1px solid #e5e7eb', borderRadius: 12, padding: '8px 10px',
              minWidth: 70, textAlign: 'center', boxShadow: '0 6px 14px rgba(0,0,0,0.06)'
            }}
          >
            <div style={{ fontWeight: 800 }}>{d.slice(5)}</div>
            {today && <div className="badge" style={{ background: 'var(--accent-3)' }}>今日</div>}
          </Link>
        );
      })}
    </div>
  );
}

