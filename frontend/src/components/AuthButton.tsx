import { useEffect, useRef, useState } from 'react';
import { loginWithGoogleIdToken, me, logout, type User } from '../api';

const GSI_SRC = 'https://accounts.google.com/gsi/client';

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src; s.async = true; s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('failed to load gsi'));
    document.head.appendChild(s);
  });
}

export default function AuthButton({ onAuth }: { onAuth?: (u: User | null) => void }){
  const [user, setUser] = useState<User | null>(null);
  const [avatarError, setAvatarError] = useState(false);
  const [gsiReady, setGsiReady] = useState(false);
  const [showFallback, setShowFallback] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  const [isMobile, setIsMobile] = useState<boolean>(typeof window !== 'undefined' ? window.innerWidth <= 640 : false);

  useEffect(() => {
    function onResize(){ setIsMobile(window.innerWidth <= 640); }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => { (async () => {
    try { const { user } = await me(); setUser(user); setAvatarError(false); onAuth?.(user); } catch {}
  })(); }, []);

  async function initGsi() {
    if (!clientId) return alert('Google Client ID が設定されていません (VITE_GOOGLE_CLIENT_ID)');
    setShowFallback(false);
    await loadScript(GSI_SRC);
    // @ts-ignore
    const google = window.google;
    if (!google?.accounts?.id) return;
    google.accounts.id.initialize({
      client_id: clientId,
      callback: async (response: any) => {
        try {
          const { user } = await loginWithGoogleIdToken(response.credential);
          setUser(user); setAvatarError(false); onAuth?.(user);
        } catch (e: any) {
          alert(e?.error || 'ログインに失敗しました');
        }
      },
      ux_mode: 'popup'
    });
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
      const width = isMobile ? 160 : 220;
      const size = isMobile ? 'medium' : 'large';
      const text = isMobile ? 'signin' : 'signin_with';
      google.accounts.id.renderButton(containerRef.current, { theme: 'outline', size, shape: 'pill', width, text });
      setGsiReady(true);
    }
  }

  async function doLogout(){
    try{
      await logout();
      setUser(null);
      setAvatarError(false);
      setGsiReady(false); // 再度フォールバックボタンを表示して、次のログインをしやすく
      if (containerRef.current) containerRef.current.innerHTML = '';
      onAuth?.(null);
    } catch{}
  }

  // 未ログイン時は自動で公式ボタンを描画（クリック不要）
  useEffect(() => {
    if (!user && !gsiReady && clientId) {
      // すぐにGSIを初期化し、一定時間でフォールバックを表示（通信遅延時のチラつき防止）
      let cancelled = false;
      const timer = window.setTimeout(() => { if (!cancelled) setShowFallback(true); }, 800);
      initGsi().catch(() => setShowFallback(true));
      return () => { cancelled = true; window.clearTimeout(timer); };
    } else {
      setShowFallback(false);
    }
  }, [user, gsiReady, clientId]);

  function Avatar(){
    const size = isMobile ? 24 : 28;
    const url = (!avatarError && user?.avatarUrl) ? String(user?.avatarUrl) : '';
    if (url) {
      return (
        <span className="avatar" style={{ width: size, height: size }}>
          <img
            src={url}
            alt={user?.name || user?.email || 'user'}
            referrerPolicy="no-referrer"
            decoding="async"
            loading="lazy"
            onError={() => setAvatarError(true)}
          />
        </span>
      );
    }
    const letter = (user?.name || user?.email || '?').slice(0,1).toUpperCase();
    return (
      <span className="avatar avatar-fallback" aria-hidden style={{ width: size, height: size, borderRadius: '50%', fontSize: size-12 }}>
        {letter}
      </span>
    );
  }

  if (user) {
    return (
      <div className="authwrap" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Avatar />
        {!isMobile && <span className="muted" style={{ fontSize: 13 }}>{user.name || user.email || 'ログイン中'}</span>}
        <button className="ghost" onClick={doLogout}>ログアウト</button>
      </div>
    );
  }
  return (
    <div className="authwrap" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div
        style={{ position: 'relative', width: isMobile ? 160 : 220, height: 40, display: 'inline-block' }}
      >
        <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
        {showFallback && !gsiReady && (
          <button
            className="ghost authbtn"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
            onClick={initGsi}
          >
            {isMobile ? 'ログイン' : 'Googleでログイン'}
          </button>
        )}
      </div>
    </div>
  );
}
