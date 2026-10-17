import React, { useState, useEffect, useCallback } from 'react';
import {
  loginUser,
  registerUser,
  loginWithMagicLink,
  loginWithSso,
  getStoredAuth,
  logoutUser,
  AuthUser
} from '../services/api';

interface AuthViewProps {
  onBack: () => void;
  onAuthSuccess?: (user: AuthUser) => void;
  initialMode?: 'login' | 'register' | 'magic';
}

export default function AuthView({ onBack, onAuthSuccess, initialMode = 'login' }: AuthViewProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'magic'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  // Dynamic mouse position for subtle ambient spotlight
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });

  useEffect(() => {
    const existing = getStoredAuth();
    if (existing?.user) {
      setCurrentUser(existing.user);
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const { clientX, clientY, currentTarget } = e;
    const { width, height, left, top } = currentTarget.getBoundingClientRect();
    const x = Math.round(((clientX - left) / width) * 100);
    const y = Math.round(((clientY - top) / height) * 100);
    setMousePos({ x, y });
  }, []);

  const clearMessages = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleSwitchMode = (nextMode: 'login' | 'register' | 'magic') => {
    clearMessages();
    setMode(nextMode);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    setLoading(true);

    try {
      if (mode === 'login') {
        if (!email.trim() || !password) {
          throw new Error('Por favor introduce tu correo electrónico y contraseña.');
        }
        const res = await loginUser(email, password);
        if (res.data?.user) {
          setCurrentUser(res.data.user);
          setSuccessMessage('Sesión iniciada con éxito. Redirigiendo...');
          setTimeout(() => {
            onAuthSuccess?.(res.data!.user);
            onBack();
          }, 600);
        }
      } else if (mode === 'register') {
        if (!name.trim()) {
          throw new Error('Por favor introduce tu nombre completo.');
        }
        if (!email.trim() || !password) {
          throw new Error('Por favor introduce tu correo electrónico y una contraseña segura.');
        }
        if (password.length < 8) {
          throw new Error('La contraseña debe tener al menos 8 caracteres.');
        }
        const res = await registerUser(name, email, password);
        if (res.data?.user) {
          setCurrentUser(res.data.user);
          setSuccessMessage('Cuenta creada exitosamente en SplitLedger.');
          setTimeout(() => {
            onAuthSuccess?.(res.data!.user);
            onBack();
          }, 700);
        }
      } else if (mode === 'magic') {
        if (!email.trim()) {
          throw new Error('Por favor introduce tu correo corporativo para recibir el enlace.');
        }
        const res = await loginWithMagicLink(email);
        if (res.data?.user) {
          setCurrentUser(res.data.user);
          setSuccessMessage(res.message || 'Enlace verificado. Acceso autorizado.');
          setTimeout(() => {
            onAuthSuccess?.(res.data!.user);
            onBack();
          }, 800);
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error en la solicitud de autenticación.');
    } finally {
      setLoading(false);
    }
  };

  const handleSsoClick = async () => {
    clearMessages();
    setLoading(true);
    try {
      const res = await loginWithSso('google');
      if (res.data?.user) {
        setCurrentUser(res.data.user);
        setSuccessMessage('Autenticación corporativa SSO verificada.');
        setTimeout(() => {
          onAuthSuccess?.(res.data!.user);
          onBack();
        }, 700);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al iniciar sesión con Single Sign-on.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await logoutUser();
      setCurrentUser(null);
      setSuccessMessage('Has cerrado la sesión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      className="relative min-h-screen w-full bg-[#0d0d0f] text-[#e5e1e4] flex flex-col justify-between overflow-x-hidden select-none transition-colors duration-500"
      style={{
        backgroundImage: `
          radial-gradient(circle at 85% 15%, rgba(255, 255, 255, 0.05) 0%, transparent 45%),
          radial-gradient(circle at 15% 85%, rgba(255, 255, 255, 0.035) 0%, transparent 40%),
          radial-gradient(750px circle at ${mousePos.x}% ${mousePos.y}%, rgba(255, 255, 255, 0.025), transparent 45%)
        `
      }}
    >
      {/* Top Navigation Bar: Back pill button */}
      <div className="w-full max-w-7xl mx-auto px-6 pt-6 sm:pt-8 flex items-center justify-between z-20">
        <button
          type="button"
          onClick={onBack}
          className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] active:bg-white/[0.12] border border-white/10 text-xs font-medium text-zinc-300 hover:text-white transition-all cursor-pointer backdrop-blur-md shadow-sm"
          title="Regresar a la aplicación"
        >
          <span className="material-symbols-outlined text-[15px] transition-transform group-hover:-translate-x-0.5">
            arrow_back
          </span>
          <span>Back</span>
        </button>

        {currentUser && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-zinc-400 font-mono hidden sm:inline">
              Conectado como {currentUser.email}
            </span>
            <button
              onClick={handleLogout}
              className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-dashed border-[#444748]/50 text-[11px] text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              Cerrar sesión
            </button>
          </div>
        )}
      </div>

      {/* Center Auth Container */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 z-10">
        <div className="w-full max-w-[390px] sm:max-w-[410px] mx-auto flex flex-col items-center text-center animate-page-enter">
          
          {/* Brand Icon: Concentric Aperture / Sunburst Squircle Badge */}
          <div className="w-14 h-14 rounded-2xl bg-[#1b1b1e] border border-white/10 flex items-center justify-center shadow-[0_8px_30px_rgba(0,0,0,0.65)] mb-6 ring-1 ring-white/5 transition-transform hover:scale-105 duration-200">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="text-white"
            >
              <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.2" opacity="0.6" />
              {Array.from({ length: 24 }).map((_, i) => {
                const angle = (i * 360) / 24;
                return (
                  <line
                    key={i}
                    x1="12"
                    y1="5.4"
                    x2="12"
                    y2="2"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    transform={`rotate(${angle} 12 12)`}
                    opacity={i % 2 === 0 ? "0.95" : "0.55"}
                  />
                );
              })}
              <circle
                cx="12"
                cy="12"
                r="9.6"
                stroke="currentColor"
                strokeWidth="0.75"
                opacity="0.3"
                strokeDasharray="1.2 2"
              />
            </svg>
          </div>

          {/* Dynamic Greeting Title */}
          <h1 className="text-2xl sm:text-[27px] font-semibold text-white tracking-tight mb-1.5">
            {mode === 'login' && 'Yooo, welcome back!'}
            {mode === 'register' && 'Create your account'}
            {mode === 'magic' && 'Passwordless Sign in'}
          </h1>

          {/* Subtitle with Mode Switcher */}
          <div className="text-xs sm:text-[13px] text-zinc-400 mb-6 flex items-center justify-center gap-1.5 flex-wrap">
            {mode === 'login' && (
              <>
                <span>First time here?</span>
                <button
                  type="button"
                  onClick={() => handleSwitchMode('register')}
                  className="text-white font-medium hover:underline hover:text-zinc-200 cursor-pointer transition-colors"
                >
                  Sign up for free
                </button>
              </>
            )}

            {mode === 'register' && (
              <>
                <span>Already have an account?</span>
                <button
                  type="button"
                  onClick={() => handleSwitchMode('login')}
                  className="text-white font-medium hover:underline hover:text-zinc-200 cursor-pointer transition-colors"
                >
                  Sign in
                </button>
              </>
            )}

            {mode === 'magic' && (
              <>
                <span>Prefer using a password?</span>
                <button
                  type="button"
                  onClick={() => handleSwitchMode('login')}
                  className="text-white font-medium hover:underline hover:text-zinc-200 cursor-pointer transition-colors"
                >
                  Sign in with password
                </button>
              </>
            )}
          </div>

          {/* Notification / Feedback Alerts */}
          {errorMessage && (
            <div className="w-full mb-4 px-3.5 py-2.5 rounded-xl bg-red-950/40 border border-red-500/30 text-red-200 text-xs text-left flex items-start gap-2 animate-in fade-in duration-150">
              <span className="material-symbols-outlined text-[16px] text-red-400 shrink-0 mt-0.5">
                error
              </span>
              <span className="leading-tight">{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="w-full mb-4 px-3.5 py-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 text-xs text-left flex items-start gap-2 animate-in fade-in duration-150">
              <span className="material-symbols-outlined text-[16px] text-emerald-400 shrink-0 mt-0.5">
                check_circle
              </span>
              <span className="leading-tight">{successMessage}</span>
            </div>
          )}

          {/* Authentication Form */}
          <form onSubmit={handleSubmit} className="w-full space-y-3 text-left">
            {mode === 'register' && (
              <div>
                <label className="sr-only" htmlFor="auth-name">
                  Full name
                </label>
                <input
                  id="auth-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full name"
                  className="w-full h-11 px-3.5 rounded-xl bg-[#151518] border border-white/10 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-white/35 focus:ring-1 focus:ring-white/20 transition-all font-sans"
                  autoComplete="name"
                />
              </div>
            )}

            <div>
              <label className="sr-only" htmlFor="auth-email">
                Your email
              </label>
              <input
                id="auth-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email"
                className="w-full h-11 px-3.5 rounded-xl bg-[#151518] border border-white/10 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-white/35 focus:ring-1 focus:ring-white/20 transition-all font-sans"
                autoComplete="email"
              />
            </div>

            {mode !== 'magic' && (
              <div className="relative">
                <label className="sr-only" htmlFor="auth-password">
                  Password
                </label>
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? 'Create password (min. 8 characters)' : '••••••••'}
                  className="w-full h-11 px-3.5 pr-10 rounded-xl bg-[#151518] border border-white/10 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-white/35 focus:ring-1 focus:ring-white/20 transition-all font-sans tracking-wide"
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors p-1"
                  title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                  tabIndex={-1}
                >
                  <span className="material-symbols-outlined text-[17px]">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            )}

            {/* High-Contrast Solid White Action Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-full bg-white hover:bg-zinc-200 active:scale-[0.985] text-zinc-950 font-medium text-sm transition-all flex items-center justify-center shadow-[0_4px_24px_rgba(255,255,255,0.09)] mt-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
              ) : mode === 'login' ? (
                'Sign in'
              ) : mode === 'register' ? (
                'Sign up'
              ) : (
                'Send magic link'
              )}
            </button>
          </form>

          {/* Secondary Action: Magic Link toggle */}
          {mode === 'login' && (
            <button
              type="button"
              onClick={() => handleSwitchMode('magic')}
              className="text-xs text-zinc-400 hover:text-white transition-colors py-2.5 mt-1 cursor-pointer font-normal"
            >
              Sign in using magic link
            </button>
          )}

          {/* Subtle Hairline Divider */}
          <div className="w-full flex items-center gap-3 my-3">
            <div className="h-px flex-1 bg-white/[0.08]" />
            <span className="text-[11px] text-zinc-500 font-mono">or</span>
            <div className="h-px flex-1 bg-white/[0.08]" />
          </div>

          {/* Secondary Outlined Button: Single sign-on (SSO) */}
          <button
            type="button"
            onClick={handleSsoClick}
            disabled={loading}
            className="w-full h-11 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] active:scale-[0.985] border border-white/10 text-sm text-zinc-300 hover:text-white font-normal transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <span>Single sign-on (SSO)</span>
          </button>

          {/* Legal / Terms of Service Disclaimer */}
          <p className="text-[11px] text-zinc-500 leading-relaxed mt-7 max-w-[340px]">
            You acknowledge that you read, and agree, to our{' '}
            <a
              href="#terms"
              onClick={(e) => {
                e.preventDefault();
                alert('Términos de servicio de SplitLedger: Acceso exclusivo para auditoría contable y conciliación mercantil.');
              }}
              className="underline hover:text-zinc-300 transition-colors"
            >
              Terms of Service
            </a>{' '}
            and our{' '}
            <a
              href="#privacy"
              onClick={(e) => {
                e.preventDefault();
                alert('Política de privacidad: Datos encriptados en tránsito (TLS 1.3) y en reposo (AES-256).');
              }}
              className="underline hover:text-zinc-300 transition-colors"
            >
              Privacy Policy
            </a>
            .
          </p>

        </div>
      </main>

      {/* Subtle bottom spacing */}
      <div className="h-4 sm:h-6" />
    </div>
  );
}
