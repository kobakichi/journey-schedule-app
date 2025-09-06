import { useEffect, useMemo, useState } from 'react';
import { addDayShare, listDayShares, removeDayShare, type ShareEntry, me, type User, createInvite, listInvites, deleteInvite } from '../api';

export default function ShareManager({ date, ownerId, ownerSlug }: { date: string; ownerId?: number; ownerSlug?: string }){
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shares, setShares] = useState<ShareEntry[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [form, setForm] = useState<{ email: string; canEdit: boolean }>({ email: '', canEdit: true });
  const [invForm, setInvForm] = useState<{ email: string; canEdit: boolean; ttlDays: number }>({ email: '', canEdit: true, ttlDays: 14 });
  const [invites, setInvites] = useState<Array<{ id: number; token: string; invitedEmail?: string | null; canEdit: boolean; expiresAt?: string | null; redeemedAt?: string | null }>>([]);
  const [invLoading, setInvLoading] = useState(false);

  const isOwnerView = !(ownerId || ownerSlug); // どちらかあれば他人の日を閲覧中

  useEffect(() => { (async () => {
    try { const { user } = await me(); setUser(user); } catch {}
  })(); }, []);

  async function openSheet(){
    setOpen(true);
    await Promise.all([refresh(), refreshInvites()]);
  }

  async function refresh(){
    setLoading(true); setError(null);
    try{
      const res = await listDayShares(date);
      setShares(res.shares || []);
    } catch(e: any){ setError(e?.error || '共有情報の取得に失敗しました'); }
    finally { setLoading(false); }
  }

  async function add(){
    if (!form.email) return;
    try{
      await addDayShare({ date, email: form.email.trim(), canEdit: form.canEdit });
      setForm({ email: '', canEdit: true });
      await refresh();
    } catch(e: any){ alert(e?.error || '共有の追加に失敗しました'); }
  }

  async function remove(userId: number){
    if (!confirm('このユーザーの共有を解除しますか？')) return;
    try{ await removeDayShare(date, userId); await refresh(); } catch(e:any){ alert(e?.error || '共有の解除に失敗しました'); }
  }

  async function toggleEdit(s: ShareEntry){
    const email = s.sharedWith?.email;
    if (!email) { alert('このユーザーはメール未登録のため編集権限を変更できません'); return; }
    try{ await addDayShare({ date, email, canEdit: !s.canEdit }); await refresh(); } catch(e:any){ alert(e?.error || '権限の更新に失敗しました'); }
  }

  async function refreshInvites(){
    setInvLoading(true);
    try{
      const res = await listInvites(date);
      setInvites(res.invites || []);
    } catch(e:any){ /* ignore on purpose */ }
    finally{ setInvLoading(false); }
  }

  async function createInviteLink(){
    try{
      const res = await createInvite({ date, canEdit: invForm.canEdit, email: invForm.email || undefined, ttlHours: invForm.ttlDays * 24 });
      await refreshInvites();
      const url = `${window.location.origin}/invite/${res.invite.token}`;
      try { await navigator.clipboard.writeText(url); alert('招待リンクをコピーしました'); } catch { /* ignore */ }
    } catch(e:any){ alert(e?.error || '招待リンクの作成に失敗しました'); }
  }

  async function revokeInvite(id: number){
    if(!confirm('この招待リンクを無効化しますか？')) return;
    try{ await deleteInvite(id); await refreshInvites(); } catch(e:any){ alert(e?.error || '無効化に失敗しました'); }
  }

  // 統一共有リンク（カレンダー表示をデフォルトにし、下部タブで一覧へ切り替え可能）
  const shareLink = useMemo(() => {
    if (!user) return '';
    const owner = user.publicSlug || user.id;
    const param = typeof owner === 'number' ? `ownerId=${owner}` : `owner=${owner}`;
    return `${window.location.origin}/calendar/${date}?${param}`;
  }, [user, date]);

  async function copy(text: string){
    try { await navigator.clipboard.writeText(text); alert('コピーしました'); } catch { /* ignore */ }
  }

  if (!isOwnerView) return null; // 他人の日を見ているときは共有管理UIを出さない
  if (!user) {
    // 未ログイン時: ボタンは出すが押したら案内
    return (
      <button className="ghost" onClick={()=>alert('共有機能を使うにはログインが必要です')}>共有</button>
    );
  }

  return (
    <>
      <button className="ghost" onClick={openSheet}>共有</button>
      {open && (
        <>
          <div className="sheet-backdrop" onClick={()=>setOpen(false)} />
          <div className="sheet sheet-compact" role="dialog" aria-modal>
            <div className="grabber" />
            <strong>共有設定</strong>
            <div className="divider" />

            <div className="share-form-grid">
              <input
                placeholder="メールアドレスを入力"
                value={form.email}
                onChange={(e)=>setForm({ ...form, email: e.target.value })}
                inputMode="email"
              />
              <label className="muted form-check">
                <input type="checkbox" checked={form.canEdit} onChange={(e)=>setForm({ ...form, canEdit: e.target.checked })} />
                <span>編集可</span>
              </label>
              <button onClick={add}>追加</button>
            </div>

            <div className="divider" />
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <strong>共有中のユーザー</strong>
              {loading ? <span className="muted">読み込み中…</span> : error ? <span className="muted">{error}</span> : null}
            </div>
            <div className="share-list">
              {shares.length === 0 && <span className="muted">まだ共有先がありません</span>}
              {shares.map(s => (
                <div key={s.id} className="share-user-row">
                  <div className="share-user-info">
                    <div style={{ fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.sharedWith?.name || s.sharedWith?.email || `User#${s.sharedWithUserId}`}</div>
                    <div className="muted" style={{ fontSize:12 }}>{s.sharedWith?.email || ''}</div>
                  </div>
                  <div className="share-user-actions">
                    <label className="muted form-check" title="編集権限">
                      <input type="checkbox" checked={s.canEdit} onChange={()=>toggleEdit(s)} />
                      <span>編集可</span>
                    </label>
                    <button className="danger" onClick={()=>remove(s.sharedWithUserId)}>解除</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="divider" />
            <strong>招待リンク（未ログイン相手向け）</strong>
            <div className="invite-form-grid">
              <input placeholder="（任意）招待相手のメール" value={invForm.email} onChange={(e)=>setInvForm({ ...invForm, email: e.target.value })} inputMode="email" />
              <label className="muted form-check">
                <input type="checkbox" checked={invForm.canEdit} onChange={(e)=>setInvForm({ ...invForm, canEdit: e.target.checked })} />
                <span>編集可</span>
              </label>
              <label className="muted form-check">
                <span>期限(日)</span>
                <input type="number" min={1} max={90} value={invForm.ttlDays} onChange={(e)=>setInvForm({ ...invForm, ttlDays: Math.max(1, Math.min(90, Number(e.target.value) || 14)) })} style={{ width: 100 }} />
              </label>
              <button onClick={createInviteLink}>招待リンクを作成</button>
            </div>

            <div className="divider" />
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <strong>招待リンク一覧</strong>
              {invLoading ? <span className="muted">読み込み中…</span> : null}
            </div>
            <div className="invite-list">
              {invites.length === 0 && <span className="muted">アクティブな招待はありません</span>}
              {invites.map(inv => {
                const url = `${window.location.origin}/invite/${inv.token}`;
                const expired = inv.expiresAt ? new Date(inv.expiresAt) < new Date() : false;
                const status = expired ? '期限切れ' : inv.redeemedAt ? '使用済み' : '未使用';
                const daysLeft = (!expired && inv.expiresAt) ? Math.max(0, Math.ceil((new Date(inv.expiresAt).getTime() - Date.now()) / (24*60*60*1000))) : null;
                const expDate = inv.expiresAt ? new Date(inv.expiresAt).toISOString().slice(0,10) : null;
                return (
                  <div key={inv.id} className="invite-item-row">
                    <div className="invite-info">
                      <div style={{ fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{inv.invitedEmail || '（メール未指定）'}</div>
                      <div className="muted" style={{ fontSize:12 }}>権限: {inv.canEdit ? '編集可' : '閲覧のみ'} / 状態: {status}</div>
                      {expDate && (
                        <div className="muted" style={{ fontSize:12 }}>有効期限: {expDate}{(daysLeft !== null && !expired && !inv.redeemedAt) ? `（残り${daysLeft}日）` : ''}</div>
                      )}
                      <div className="muted" style={{ fontSize:12, overflow:'hidden', textOverflow:'ellipsis' }}>{url}</div>
                    </div>
                    <div className="invite-actions">
                      <button className="secondary" onClick={async()=>{ try{ await navigator.clipboard.writeText(url); alert('コピーしました'); } catch{} }}>コピー</button>
                      <button className="danger" onClick={()=>revokeInvite(inv.id)}>無効化</button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="divider" />
            <strong>共有リンク（1つで一覧/カレンダー切替可）</strong>
            <div className="copy-grid">
              <input readOnly value={shareLink} onFocus={(e)=>e.currentTarget.select()} />
              <button className="secondary" onClick={()=>copy(shareLink)}>コピー</button>
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              リンク先で画面下部のタブから「一覧/カレンダー」を切り替えできます。
            </div>

            <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:12 }}>
              <button className="secondary" onClick={()=>setOpen(false)}>閉じる</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
