import { useState } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithCredential,
} from 'firebase/auth';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { useApp } from '../../contexts/AppContext';
import { auth, googleProvider, isFirebaseConfigured, isNativePlatform } from '../../utils/firebase';

export default function AuthModal() {
  const { setShowAuth, signInDemo, setUserName } = useApp();
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleDemo = () => {
    signInDemo(name.trim() || 'Friend');
    setShowAuth(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isFirebaseConfigured) { handleDemo(); return; }
    setError('');
    try {
      if (mode === 'signin') {
        await signInWithEmailAndPassword(auth, email, password);
        // onAuthStateChanged loads cloud data and sets userName
      } else {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        const firstName = name.trim().split(' ')[0] || 'Friend';
        // Set userName immediately; onAuthStateChanged fires before updateProfile sets displayName
        setUserName(firstName);
        await updateProfile(result.user, { displayName: name.trim() });
      }
      setShowAuth(false);
    } catch (err) {
      setError(err.message || 'Auth failed');
    }
  };

  const handleGoogle = async () => {
    if (!isFirebaseConfigured) { handleDemo(); return; }
    setError('');
    try {
      if (isNativePlatform) {
        const result = await FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true });
        const credential = GoogleAuthProvider.credential(result.credential?.idToken);
        const webResult = await signInWithCredential(auth, credential);
        console.log('[Google] success uid:', webResult.user?.uid);
      } else {
        await signInWithPopup(auth, googleProvider);
      }
      // onAuthStateChanged loads cloud data and sets user + userName
      setShowAuth(false);
    } catch (err) {
      console.log('[Google] error code:', err.code);
      console.log('[Google] error message:', err.message);
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
            className="ar-btn ar-btn-ghost"
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
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
