import { Link, useLocation, useParams } from 'react-router-dom';

export default function BottomNav(){
  const { date } = useParams();
  const loc = useLocation();
  const d = date || new Date().toISOString().slice(0,10);
  const isCal = loc.pathname.startsWith('/calendar');
  const search = loc.search || '';
  return (
    <nav className="bottomnav">
      <Link className={`tab ${!isCal ? 'active' : ''}`} to={`/day/${d}${search}`}>一覧</Link>
      <Link className={`tab ${isCal ? 'active' : ''}`} to={`/calendar/${d}${search}`}>カレンダー</Link>
    </nav>
  );
}
