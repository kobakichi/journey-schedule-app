import { useEffect, useState } from 'react';
import { acceptInvite, getInvite, me, type InviteMeta, type User } from '../api';
import { useNavigate, useParams } from 'react-router-dom';
import AuthButton from '../components/AuthButton';

export default function InviteAcceptPage(){
  const { token } = useParams();
  const [meta, setMeta] = useState<InviteMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const nav = useNavigate();

  useEffect(()=>{ (async()=>{
    setLoading(true); setError(null);
    try{
      const [{ invite }, { user }] = await Promise.all([
        getInvite(String(token)),
        me()
      ]);
      setMeta(invite); setUser(user);
    } catch(e: any){ setError(e?.error || '招待情報の取得に失敗しました'); }
    finally{ setLoading(false); }
  })(); }, [token]);

  async function accept(){
    try{
      const res = await acceptInvite(String(token));
      const date = String(res.date).slice(0,10);
      nav(`/day/${date}?ownerId=${res.ownerId}`);
    } catch(e: any){ alert(e?.error || '招待の受諾に失敗しました'); }
  }

  return (
    <div className="container" style={{ paddingBottom: 80 }}>
      <header className="header" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="brand">旅のしおり</span>
        <div className="header-actions" style={{ display:'flex', gap: 8, alignItems:'center' }}>
          <AuthButton onAuth={(u)=>setUser(u)} />
        </div>
      </header>

      <section className="card">
        <strong>招待の確認</strong>
        <div className="divider" />
        {loading ? (<div className="muted">読み込み中…</div>) : error ? (<div className="muted">{error}</div>) : meta ? (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <div>オーナー: <strong>{meta.owner?.name || meta.owner?.email || `User#${meta.owner?.id}`}</strong></div>
            <div>日付: <strong>{meta.date ? String(meta.date).slice(0,10) : '-'}</strong></div>
            <div>権限: <strong>{meta.canEdit ? '編集可' : '閲覧のみ'}</strong></div>
            {meta.invitedEmail && <div>対象メール: <strong>{meta.invitedEmail}</strong></div>}
            {meta.expiresAt && !meta.expired && (
              <div className="muted">
                有効期限: {new Date(meta.expiresAt).toISOString().slice(0,10)}（残り{Math.max(0, Math.ceil((new Date(meta.expiresAt).getTime() - Date.now())/(24*60*60*1000)))}日）
              </div>
            )}
            {meta.expired && <div className="muted">この招待は期限切れです</div>}
            {meta.redeemedAt && <div className="muted">この招待はすでに使用されています</div>}
            <div className="divider" />
            {!user && <div className="muted">招待を受けるにはログインが必要です（右上のボタンからログイン）</div>}
            <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
              <button className="secondary" onClick={()=>nav(-1)}>戻る</button>
              <button onClick={accept} disabled={!user || !!meta.expired}>招待を受ける</button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
