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
import InteractiveDotGrid from '../components/InteractiveDotGrid';

interface AuthViewProps {
  onBack?: () => void;
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
          setSuccessMessage('Sesión iniciada con éxito. Accediendo al sistema...');
          setTimeout(() => {
            onAuthSuccess?.(res.data!.user);
            onBack?.();
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
            onBack?.();
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
            onBack?.();
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
          onBack?.();
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
          radial-gradient(circle at 85% 15%, rgba(255, 255, 255, 0.04) 0%, transparent 45%),
          radial-gradient(circle at 15% 85%, rgba(255, 255, 255, 0.03) 0%, transparent 40%),
          radial-gradient(750px circle at ${mousePos.x}% ${mousePos.y}%, rgba(255, 255, 255, 0.02), transparent 45%)
        `
      }}
    >
      {/* Dynamic Autonomous Blueprint Dot Grid with Cursor Reactivity */}
      <InteractiveDotGrid autonomous={true} />

      {/* Top Header: Session info (when authenticated) with zero back arrow */}
      <header className="w-full max-w-7xl mx-auto px-6 pt-6 sm:pt-8 flex items-center justify-end z-20">
        {currentUser && (
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-[#131315]/80 backdrop-blur-md border border-dashed border-[#444748]/50 shadow-sm animate-in fade-in">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span className="text-[11px] text-zinc-300 font-mono hidden sm:inline">
              Conectado como {currentUser.email}
            </span>
            <button
              onClick={handleLogout}
              className="px-2 py-0.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-dashed border-[#444748]/70 text-[10px] text-zinc-300 hover:text-white transition-colors cursor-pointer"
            >
              Cerrar sesión
            </button>
          </div>
        )}
      </header>

      {/* Center Auth Container */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 z-10">
        <div className="w-full max-w-[390px] sm:max-w-[420px] mx-auto flex flex-col items-center text-center animate-page-enter bg-[#131315]/85 backdrop-blur-2xl border border-dashed border-[#444748]/60 rounded-3xl p-7 sm:p-9 shadow-[0_24px_60px_rgba(0,0,0,0.85)]">
          
          {/* Official SplitLedger Brand Identity */}
          <div className="flex flex-col items-center gap-2.5 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-[#201f22] border border-dashed border-[#444748]/80 text-white flex items-center justify-center shadow-[0_8px_30px_rgba(0,0,0,0.65)] ring-1 ring-white/5 transition-transform hover:scale-105 duration-200">
              <span className="material-symbols-outlined text-[28px] text-white">splitscreen</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-2xl tracking-tight text-white">
                SplitLedger
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-[#201f22] border border-dashed border-[#444748]/60 text-[#c4c7c8] font-mono">
                v2.4
              </span>
            </div>
          </div>

          {/* Dynamic Greeting Title with smooth subtle cross-fade */}
          <div key={`header-${mode}`} className="animate-in fade-in-50 slide-in-from-bottom-1 duration-200 ease-out text-center">
            <h1 className="text-xl sm:text-[22px] font-semibold text-white tracking-tight mb-1">
              {mode === 'login' && 'Acceso al Sistema'}
              {mode === 'register' && 'Crear Cuenta'}
              {mode === 'magic' && 'Acceso sin Contraseña'}
            </h1>

            {/* Subtitle with Mode Switcher */}
            <div className="text-xs sm:text-[13px] text-zinc-400 mb-6 flex items-center justify-center gap-1.5 flex-wrap">
              {mode === 'login' && (
                <>
                  <span>¿Primera vez aquí?</span>
                  <button
                    type="button"
                    onClick={() => handleSwitchMode('register')}
                    className="text-white font-medium hover:underline hover:text-zinc-200 active:scale-95 cursor-pointer transition-all"
                  >
                    Regístrate gratis
                  </button>
                </>
              )}

              {mode === 'register' && (
                <>
                  <span>¿Ya tienes una cuenta?</span>
                  <button
                    type="button"
                    onClick={() => handleSwitchMode('login')}
                    className="text-white font-medium hover:underline hover:text-zinc-200 active:scale-95 cursor-pointer transition-all"
                  >
                    Iniciar sesión
                  </button>
                </>
              )}

              {mode === 'magic' && (
                <>
                  <span>¿Prefieres contraseña?</span>
                  <button
                    type="button"
                    onClick={() => handleSwitchMode('login')}
                    className="text-white font-medium hover:underline hover:text-zinc-200 active:scale-95 cursor-pointer transition-all"
                  >
                    Iniciar sesión con contraseña
                  </button>
                </>
              )}
            </div>
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

          {/* Authentication Form with Smooth Accordion Transitions */}
          <form onSubmit={handleSubmit} className="w-full text-left">
            {/* Smooth Collapsible Full Name Field (Registration Mode) */}
            <div
              className={`overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                mode === 'register'
                  ? 'max-h-16 opacity-100 scale-100 mb-3'
                  : 'max-h-0 opacity-0 scale-98 mb-0 pointer-events-none'
              }`}
            >
              <label className="sr-only" htmlFor="auth-name">
                Nombre completo
              </label>
              <input
                id="auth-name"
                type="text"
                required={mode === 'register'}
                tabIndex={mode === 'register' ? 0 : -1}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre completo"
                className="w-full h-11 px-3.5 rounded-xl bg-[#151518] border border-white/10 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-white/35 focus:ring-1 focus:ring-white/20 transition-all font-sans"
                autoComplete="name"
              />
            </div>

            {/* Email Field */}
            <div className="mb-3">
              <label className="sr-only" htmlFor="auth-email">
                Correo electrónico
              </label>
              <input
                id="auth-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Correo electrónico"
                className="w-full h-11 px-3.5 rounded-xl bg-[#151518] border border-white/10 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-white/35 focus:ring-1 focus:ring-white/20 transition-all font-sans"
                autoComplete="email"
              />
            </div>

            {/* Smooth Collapsible Password Field (Hidden in Magic Link mode) */}
            <div
              className={`relative overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                mode !== 'magic'
                  ? 'max-h-16 opacity-100 scale-100 mb-3'
                  : 'max-h-0 opacity-0 scale-98 mb-0 pointer-events-none'
              }`}
            >
              <label className="sr-only" htmlFor="auth-password">
                Contraseña
              </label>
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                required={mode !== 'magic'}
                tabIndex={mode !== 'magic' ? 0 : -1}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'register' ? 'Contraseña segura (mín. 8 caracteres)' : '••••••••'}
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

            {/* High-Contrast Solid White Action Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-full bg-white hover:bg-zinc-200 active:scale-[0.985] text-zinc-950 font-medium text-sm transition-all flex items-center justify-center shadow-[0_4px_24px_rgba(255,255,255,0.09)] mt-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <span key={mode} className="inline-block animate-in fade-in duration-200">
                  {mode === 'login' ? 'Iniciar sesión' : mode === 'register' ? 'Crear cuenta' : 'Enviar enlace mágico'}
                </span>
              )}
            </button>
          </form>

          {/* Secondary Action: Magic Link toggle */}
          {mode === 'login' && (
            <button
              type="button"
              onClick={() => handleSwitchMode('magic')}
              className="text-xs text-zinc-400 hover:text-white transition-colors py-2 mt-1 cursor-pointer font-normal"
            >
              Iniciar sesión con Magic Link
            </button>
          )}

          {/* Subtle Hairline Divider */}
          <div className="w-full flex items-center gap-3 my-3">
            <div className="h-px flex-1 bg-white/[0.08]" />
            <span className="text-[11px] text-zinc-500 font-mono">o</span>
            <div className="h-px flex-1 bg-white/[0.08]" />
          </div>

          {/* Secondary Outlined Button: Single sign-on (SSO) with Google */}
          <button
            type="button"
            onClick={handleSsoClick}
            disabled={loading}
            className="w-full h-11 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] active:scale-[0.985] border border-white/10 text-sm text-zinc-300 hover:text-white font-normal transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>Acceso Corporativo con Google (SSO)</span>
          </button>

          {/* Legal / Terms of Service Disclaimer */}
          <p className="text-[11px] text-zinc-500 leading-relaxed mt-6 max-w-[340px]">
            Al ingresar aceptas los{' '}
            <a
              href="#terms"
              onClick={(e) => {
                e.preventDefault();
                alert('Términos de servicio de SplitLedger: Acceso exclusivo para auditoría contable y conciliación mercantil.');
              }}
              className="underline hover:text-zinc-300 transition-colors"
            >
              Términos de Servicio
            </a>{' '}
            y la{' '}
            <a
              href="#privacy"
              onClick={(e) => {
                e.preventDefault();
                alert('Política de privacidad: Datos encriptados en tránsito (TLS 1.3) y en reposo (AES-256).');
              }}
              className="underline hover:text-zinc-300 transition-colors"
            >
              Política de Privacidad
            </a>
            .
          </p>

        </div>
      </main>

      {/* Subtle bottom spacing */}
      <footer className="h-6" />
    </div>
  );
}
