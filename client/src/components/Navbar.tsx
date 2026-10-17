import React, { useState, useEffect, useRef } from 'react';
import { fetchUserProfile, UserProfileData } from '../services/api';

export interface NotificationItem {
  title: string;
  detail: string;
}

interface NavbarProps {
  currentView: 'upload' | 'detail' | 'history' | 'auth';
  setCurrentView: (view: 'upload' | 'detail' | 'history' | 'auth') => void;
  onOpenCommandMenu: () => void;
  onOpenAuth?: () => void;
  notifications?: NotificationItem[];
}

export default function Navbar({
  currentView,
  setCurrentView,
  onOpenCommandMenu,
  onOpenAuth,
  notifications = []
}: NavbarProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [profileData, setProfileData] = useState<UserProfileData | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setShowProfile(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggleProfile = async () => {
    const nextState = !showProfile;
    setShowProfile(nextState);
    if (nextState) {
      setShowNotifications(false);
      if (!profileData) {
        try {
          setIsLoadingProfile(true);
          const res = await fetchUserProfile();
          setProfileData(res.data);
        } catch (err) {
          console.error('Error al cargar perfil:', err);
        } finally {
          setIsLoadingProfile(false);
        }
      }
    }
  };

  const handleToggleNotifications = () => {
    setShowNotifications(!showNotifications);
    if (!showNotifications) {
      setShowProfile(false);
    }
  };


  return (
    <header className="fixed top-0 left-0 right-0 z-50 pointer-events-none">
      <div className="pt-3 sm:pt-4 px-4 sm:px-6 pb-2 w-full max-w-7xl mx-auto flex items-center justify-center">
        <div className="pointer-events-auto flex items-center justify-between gap-4 w-full h-14 bg-[#131315]/90 backdrop-blur-xl border border-dashed border-[#444748]/60 rounded-full px-4 sm:px-6 shadow-[0_8px_30px_rgba(0,0,0,0.7)]">
          
          {/* Logo & Version */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setCurrentView('upload')}
              className="flex items-center gap-2 group text-left cursor-pointer"
            >
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#353437] border border-dashed border-[#444748]/70 text-white group-hover:border-white/50 transition-colors">
                <span className="material-symbols-outlined text-[16px]">splitscreen</span>
              </div>
              <span className="font-semibold text-[15px] tracking-tight text-white group-hover:text-zinc-200 transition-colors">
                SplitLedger
              </span>
            </button>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#201f22] border border-dashed border-[#444748]/50 text-[#c4c7c8] font-mono">
              v2.4
            </span>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden sm:flex items-center gap-1 bg-[#0e0e10]/80 border border-dashed border-[#444748]/40 rounded-full p-1">
            <button
              onClick={() => setCurrentView('upload')}
              className={`px-4 py-1.5 rounded-full text-xs transition-all cursor-pointer ${
                currentView === 'upload'
                  ? 'bg-[#353437] text-white font-medium shadow-sm'
                  : 'text-[#c4c7c8] hover:text-white hover:bg-[#201f22]'
              }`}
            >
              Inicio & Carga
            </button>
            <button
              onClick={() => setCurrentView('history')}
              className={`px-4 py-1.5 rounded-full text-xs transition-all cursor-pointer ${
                currentView === 'history'
                  ? 'bg-[#353437] text-white font-medium shadow-sm'
                  : 'text-[#c4c7c8] hover:text-white hover:bg-[#201f22]'
              }`}
            >
              Historial & Facturas
            </button>
          </nav>


          {/* Status, Shortcut & Profile */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onOpenCommandMenu}
              aria-label="Buscar o abrir comandos"
              className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#2a2a2c] border border-dashed border-[#444748]/50 text-[#c4c7c8] hover:text-white font-mono text-xs transition-colors cursor-pointer"
              title="Abrir menú rápido (⌘K)"
            >
              <span className="text-[11px]">⌘K</span>
            </button>

            {/* Notifications toggle */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={handleToggleNotifications}
                aria-label="Notificaciones"
                className="flex items-center justify-center w-7 h-7 rounded-full bg-[#2a2a2c] border border-dashed border-[#444748]/50 text-[#c4c7c8] hover:text-white transition-colors relative cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">notifications</span>
                {notifications.length > 0 && (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-3 w-80 bg-[#1c1b1d] border border-dashed border-[#444748]/60 rounded-xl p-3 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="flex items-center justify-between pb-2 border-b border-dashed border-[#444748]/40 mb-2">
                    <span className="text-xs font-semibold text-white">Eventos del Motor</span>
                    <span className="text-[10px] text-[#c4c7c8]">{notifications.length} registros</span>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="text-xs text-zinc-500 py-3 text-center">Sin notificaciones pendientes</p>
                    ) : (
                      notifications.map((notif, idx) => (
                        <div key={idx} className="p-2 rounded bg-[#201f22] border border-dashed border-[#444748]/40 text-xs">
                          <p className="text-white font-medium">{notif.title}</p>
                          <p className="text-zinc-400 text-[11px] mt-0.5">{notif.detail}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Trigger & Dropdown */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={handleToggleProfile}
                aria-label="Perfil de Usuario y Auditoría"
                className={`w-7 h-7 rounded-full flex items-center justify-center shadow-sm cursor-pointer transition-all ${
                  showProfile
                    ? 'bg-white text-zinc-950 ring-2 ring-white/20 scale-105'
                    : 'bg-white text-zinc-950 hover:bg-zinc-200 hover:scale-105 active:scale-95'
                }`}
                title="Ver perfil de auditor y configuración"
              >
                <span className="material-symbols-outlined text-[16px]">person</span>
              </button>

              {showProfile && (
                <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-[#1c1b1d]/95 backdrop-blur-2xl border border-dashed border-[#444748]/60 rounded-2xl p-4 shadow-[0_16px_40px_rgba(0,0,0,0.85)] z-50 text-left animate-in fade-in slide-in-from-top-2 duration-150">
                  {/* Header with avatar, name, and status */}
                  <div className="flex items-start justify-between pb-3 border-b border-dashed border-[#444748]/40">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#353437] border border-dashed border-[#444748]/70 text-[#e5e1e4] flex items-center justify-center font-semibold text-xs shadow-inner">
                        {profileData?.user.name ? profileData.user.name.charAt(0).toUpperCase() : 'A'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-semibold text-[#e5e1e4] tracking-tight">
                            {profileData?.user.name || (isLoadingProfile ? 'Cargando perfil...' : 'Auditor Principal')}
                          </h4>
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#201f22] border border-dashed border-[#444748]/50 text-[#c4c7c8] text-[10px] font-mono">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            <span>Verificado</span>
                          </span>
                        </div>
                        <p className="text-[11px] text-[#c4c7c8] font-mono mt-0.5">
                          {profileData?.user.email || 'admin@splitledger.io'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowProfile(false)}
                      className="text-[#c4c7c8] hover:text-white p-1 rounded-lg hover:bg-[#2a2a2c] transition-colors cursor-pointer"
                      title="Cerrar perfil"
                    >
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  </div>

                  {/* Role & Organization */}
                  <div className="py-2.5 space-y-1.5 border-b border-dashed border-[#444748]/40">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#c4c7c8] text-[11px]">Rol Profesional:</span>
                      <span className="text-[#e5e1e4] font-medium text-[11px] text-right">
                        {profileData?.user.role || 'Auditor Senior PGC & Conciliador Forense'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#c4c7c8] text-[11px]">Organización / CIF:</span>
                      <span className="text-[#e5e1e4] font-mono text-[11px] text-right">
                        {profileData?.user.organization || 'SplitLedger Enterprise S.L.'} ({profileData?.user.tax_id || 'ES-B87654321'})
                      </span>
                    </div>
                  </div>

                  {/* Audit Telemetry Grid */}
                  <div className="grid grid-cols-2 gap-2 my-2.5 p-1.5 rounded-xl bg-[#0e0e10]/80 border border-dashed border-[#444748]/50">
                    <div className="p-2.5 rounded-lg bg-[#1c1b1d]/90 border border-dashed border-[#444748]/35 transition-colors hover:bg-[#201f22]">
                      <span className="text-[10px] text-[#c4c7c8] uppercase tracking-wider block font-medium">Facturas Auditadas</span>
                      <span className="text-sm font-semibold text-[#e5e1e4] font-mono">
                        {profileData?.stats.invoices_audited ?? (isLoadingProfile ? '...' : 0)}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#1c1b1d]/90 border border-dashed border-[#444748]/35 transition-colors hover:bg-[#201f22]">
                      <span className="text-[10px] text-[#c4c7c8] uppercase tracking-wider block font-medium">Partidas PGC</span>
                      <span className="text-sm font-semibold text-[#e5e1e4] font-mono">
                        {profileData?.stats.accounting_items ?? (isLoadingProfile ? '...' : 0)}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#1c1b1d]/90 border border-dashed border-[#444748]/35 transition-colors hover:bg-[#201f22]">
                      <span className="text-[10px] text-[#c4c7c8] uppercase tracking-wider block font-medium">Volumen Registrado</span>
                      <span className="text-xs font-semibold text-[#e5e1e4] font-mono">
                        {profileData?.stats.total_volume_eur
                          ? `${Number(profileData.stats.total_volume_eur).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`
                          : '0,00 €'}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#1c1b1d]/90 border border-dashed border-[#444748]/35 transition-colors hover:bg-[#201f22]">
                      <span className="text-[10px] text-[#c4c7c8] uppercase tracking-wider block font-medium">Paridad Partida Doble</span>
                      <span className="text-xs font-semibold text-[#e5e1e4] font-mono flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                        <span>{profileData?.stats.parity_balance_rate ? `${profileData.stats.parity_balance_rate}% Cuadre` : '100%'}</span>
                      </span>
                    </div>
                  </div>

                  {/* System Environment & Accounting Config */}
                  <div className="pt-2 space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between text-[#c4c7c8]">
                      <span>Base de Datos:</span>
                      <span className="text-[#e5e1e4] font-mono text-[10px]">Neon PostgreSQL Serverless</span>
                    </div>
                    <div className="flex items-center justify-between text-[#c4c7c8]">
                      <span>Motor Cognitivo:</span>
                      <span className="text-[#e5e1e4] font-mono text-[10px]">SplitLLM 2.4 - Reasoning Core</span>
                    </div>
                    <div className="flex items-center justify-between text-[#c4c7c8]">
                      <span>Tolerancia de Cuadre:</span>
                      <span className="text-[#e5e1e4] font-mono text-[10px]">
                        {profileData?.preferences.double_entry_tolerance || '±0.05 €'}
                      </span>
                    </div>
                  </div>

                  {/* Active Connection & Quick Action */}
                  <div className="mt-3 pt-2.5 border-t border-dashed border-[#444748]/40 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[10px] text-[#c4c7c8] font-mono">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      <span>Sesión Cifrada SSL</span>
                    </div>
                    {onOpenAuth && (
                      <button
                        onClick={() => {
                          setShowProfile(false);
                          onOpenAuth();
                        }}
                        className="text-[11px] text-white hover:text-zinc-200 font-medium px-2 py-1 rounded bg-[#353437] hover:bg-[#444748] transition-colors cursor-pointer"
                      >
                        Iniciar sesión / Registro
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </header>
  );
}
