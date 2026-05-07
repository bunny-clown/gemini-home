import { useState } from 'react';
import { useApp } from '../../contexts/AppContext';
import { auth, googleProvider, isFirebaseConfigured } from '../../utils/firebase';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';

const isCapacitor = typeof window !== 'undefined' && !!(window.Capacitor?.isNativePlatform?.());

export default function AuthModal() {
  const { setShowAuth, setUser, setUserName } = useApp();
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleDemo = () => {
    const demoName = name.trim() || 'Friend';
    setUser({ uid: 'demo', email: 'demo@example.com', displayName: demoName, isDemo: true });
    setUserName(demoName);
    setShowAuth(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isFirebaseConfigured) { handleDemo(); return; }
    setError('');
    try {
      const { signInWithEmailAndPassword, createUserWithEmailAndPassword } = await import('firebase/auth');
      let result;
      if (mode === 'signin') {
        result = await signInWithEmailAndPassword(auth, email, password);
        const firstName = result.user.displayName?.split(' ')[0] || '';
        if (firstName) setUserName(firstName);
      } else {
        result = await createUserWithEmailAndPassword(auth, email, password);
        const firstName = name.trim().split(' ')[0] || 'Friend';
        setUserName(firstName);
        const { updateProfile } = await import('firebase/auth');
        await updateProfile(result.user, { displayName: name.trim() });
      }
      setUser(result.user);
      setShowAuth(false);
    } catch (err) {
      setError(err.message || 'Auth failed');
    }
  };

  const handleGoogle = async () => {
    console.log('handleGoogle called. isCapacitor:', isCapacitor);
    if (!isFirebaseConfigured) { handleDemo(); return; }

    if (isCapacitor) {
      try {
        console.log('Native signInWithGoogle...');
        const nativeResult = await FirebaseAuthentication.signInWithGoogle();
        console.log('Native result uid:', nativeResult.user?.uid);
        setShowAuth(false);

        // Wait for plugin auto-sync to web SDK
        console.log('Waiting for web SDK auth state...');
        const { getAuth } = await import('firebase/auth');
        const webAuth = getAuth();
        for (let i = 0; i < 20; i++) {
          await new Promise(r => setTimeout(r, 500));
          console.log(`Poll ${i + 1}: webAuth.currentUser =`, webAuth.currentUser?.uid || 'null');
          if (webAuth.currentUser) {
            console.log('Web SDK auto-synced! uid:', webAuth.currentUser.uid);
            return;
          }
        }
        console.warn('Web SDK did not auto-sync after 10 seconds');

        // Fallback: get fresh ID token from plugin and sign in web SDK
        console.log('Fallback: getting fresh ID token from plugin...');
        const tokenResult = await FirebaseAuthentication.getIdToken({ forceRefresh: true });
        console.log('Raw getIdToken result keys:', Object.keys(tokenResult));
        console.log('Raw getIdToken result:', JSON.stringify({ tokenPrefix: tokenResult.token?.slice(0, 20), idTokenPrefix: tokenResult.idToken?.slice(0, 20) }));
        const freshToken = tokenResult.token || tokenResult.idToken;
        console.log('Fresh token extracted:', freshToken ? freshToken.slice(0, 30) + '...' : 'null');

        if (freshToken) {
          console.log('Trying signInWithCredential with fresh token...');
          const { GoogleAuthProvider, signInWithCredential } = await import('firebase/auth');
          const credential = GoogleAuthProvider.credential(freshToken);
          try {
            const webResult = await signInWithCredential(auth, credential);
            console.log('Manual sign-in success:', webResult.user.uid);
          } catch (credErr) {
            console.error('Manual sign-in failed:', credErr.code, credErr.message);
            console.error('Full error:', credErr);
          }
        } else {
          console.error('No fresh token available');
        }
      } catch (err) {
        console.error('Native sign-in error:', err.code, err.message);
        console.error('Full error:', err);
        setError(err.message || 'Google sign-in failed');
      }
      return;
    }

    // Web: use Firebase popup
    try {
      const { signInWithPopup } = await import('firebase/auth');
      const result = await signInWithPopup(auth, googleProvider);
      const firstName = result.user.displayName?.split(' ')[0] || '';
      if (firstName) setUserName(firstName);
      setUser(result.user);
      setShowAuth(false);
    } catch (err) {
      setError(err.message || 'Google sign-in failed');
    }
  };

  return (
    <div className="ar-modal-bg" onClick={() => setShowAuth(false)}>
      <div className="ar-modal" style={{ maxWidth: 400, width: '100%' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2 className="ar-display" style={{ fontSize: 26, margin: 0, fontWeight: 400 }}>
                {mode === 'signin' ? 'Welcome back' : 'Create account'}
              </h2>
              <p style={{ fontSize: 13, color: 'var(--ar-muted)', marginTop: 4 }}>
                Sync your scenarios to the cloud
              </p>
            </div>
            <button className="ar-btn ar-btn-ghost ar-btn-sm" onClick={() => setShowAuth(false)}>✕</button>
          </div>

          {!isFirebaseConfigured && (
            <div style={{
              padding: '10px 14px', borderRadius: 10,
              background: 'rgba(245,181,59,0.12)', border: '1px solid rgba(245,181,59,0.3)',
              fontSize: 12, color: '#a07a10',
            }}>
              Firebase not configured — sign in as Demo User for local-only storage.
            </div>
          )}

          {/* Google */}
          <button
            onClick={handleGoogle}
            disabled={!isFirebaseConfigured}
            className="ar-btn ar-btn-ghost"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              opacity: !isFirebaseConfigured ? 0.5 : 1,
              cursor: !isFirebaseConfigured ? 'not-allowed' : 'pointer',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--ar-border)' }} />
            <span style={{ fontSize: 12, color: 'var(--ar-muted)' }}>or</span>
            <div style={{ flex: 1, height: 1, background: 'var(--ar-border)' }} />
          </div>

          {/* Email form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {mode === 'signup' && (
              <div>
                <div className="ar-label" style={{ marginBottom: 6 }}>First name</div>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="ar-input"
                  style={{ width: '100%' }}
                  placeholder="Your first name"
                  autoFocus
                />
              </div>
            )}
            <div>
              <div className="ar-label" style={{ marginBottom: 6 }}>Email</div>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="ar-input"
                style={{ width: '100%' }}
                placeholder="you@example.com"
              />
            </div>
            <div>
              <div className="ar-label" style={{ marginBottom: 6 }}>Password</div>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="ar-input"
                style={{ width: '100%' }}
                placeholder="••••••••"
              />
            </div>
            {error && <p style={{ fontSize: 12, color: 'var(--ar-warn)' }}>{error}</p>}
            <button type="submit" className="ar-btn ar-btn-accent" style={{ width: '100%', marginTop: 4 }}>
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <div style={{ textAlign: 'center' }}>
            <button
              className="ar-btn ar-btn-ghost ar-btn-sm"
              onClick={() => setMode(m => m === 'signin' ? 'signup' : 'signin')}
            >
              {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </button>
          </div>

          {!isFirebaseConfigured && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <div className="ar-label" style={{ marginBottom: 6 }}>Your name</div>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="ar-input"
                  style={{ width: '100%' }}
                  placeholder="First name"
                  onKeyDown={e => e.key === 'Enter' && handleDemo()}
                />
              </div>
              <button onClick={handleDemo} className="ar-btn ar-btn-ghost" style={{ width: '100%' }}>
                Continue (local only)
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
