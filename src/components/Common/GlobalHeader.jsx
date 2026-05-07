import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../../contexts/AppContext';

const NAV = [
  { label: 'Home', path: '/' },
  { label: 'Plan', path: '/calculator' },
  { label: 'Scenarios', path: '/scenarios' },
  { label: 'Compare', path: '/compare' },
  { label: 'Track', path: '/progress' },
];

export default function GlobalHeader() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, setShowAuth, signOut, navGuard } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);

  function guardedNavigate(path) {
    setMenuOpen(false);
    if (navGuard && path !== pathname) {
      navGuard(() => navigate(path));
    } else {
      navigate(path);
    }
  }

  const active = (path) => {
    if (path === '/') return pathname === '/';
    return pathname.startsWith(path);
  };

  return (
    <>
      <header className="ar-topbar">
        {/* Logo + wordmark — clickable to home */}
        <button
          onClick={() => guardedNavigate('/')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexShrink: 0,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            fontFamily: 'inherit',
            color: 'inherit',
          }}
        >
          <div className="ar-topbar-logo">G</div>
          <span style={{ fontWeight: 600, fontSize: 15 }}>Gemini Home</span>
        </button>

        {/* Desktop nav links */}
        <nav className="ar-navlinks ar-nav-desktop">
          {NAV.map(({ label, path }) => (
            <button
              key={path}
              className={`ar-navlink ${active(path) ? 'active' : ''}`}
              onClick={() => guardedNavigate(path)}
            >
              {label}
            </button>
          ))}
        </nav>

        {/* Right side: auth + mobile hamburger */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div className="ar-pulse-dot" />
          {user ? (
            <>
              <span className="ar-nav-desktop" style={{ fontSize: 12, color: 'var(--ar-muted)' }}>
                {user.email || user.displayName}
              </span>
              <button className="ar-btn ar-btn-ghost ar-btn-sm" onClick={signOut}>
                Sign out
              </button>
            </>
          ) : (
            <button className="ar-btn ar-btn-ghost ar-btn-sm ar-nav-desktop" onClick={() => setShowAuth(true)}>
              Sign in
            </button>
          )}

          {/* Hamburger — mobile only */}
          <button
            className="ar-hamburger"
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Menu"
          >
            <span className={`ar-hamburger-icon ${menuOpen ? 'open' : ''}`} />
          </button>
        </div>
      </header>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="ar-mobile-menu" onClick={() => setMenuOpen(false)}>
          <div className="ar-mobile-menu-inner" onClick={e => e.stopPropagation()}>
            {NAV.map(({ label, path }) => (
              <button
                key={path}
                className={`ar-mobile-nav-item ${active(path) ? 'active' : ''}`}
                onClick={() => guardedNavigate(path)}
              >
                {label}
              </button>
            ))}
            <div style={{ height: 1, background: 'var(--ar-border)', margin: '8px 0' }} />
            {user ? (
              <button
                className="ar-mobile-nav-item"
                onClick={() => { signOut(); setMenuOpen(false); }}
              >
                Sign out
              </button>
            ) : (
              <button
                className="ar-mobile-nav-item"
                onClick={() => { setShowAuth(true); setMenuOpen(false); }}
              >
                Sign in
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
