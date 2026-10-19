import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  fetchGoogleIntegrationStatus,
  connectGoogleIntegration,
  disconnectGoogleIntegration,
  syncGoogleDrive,
  syncGoogleSheets,
  fetchGmailInvoices
} from '../services/api';
import { GoogleIntegrationStatus } from '../types/index.js';

interface GoogleIntegrationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccessMessage?: (msg: string) => void;
}

export default function GoogleIntegrationsModal({
  isOpen,
  onClose,
  onSuccessMessage
}: GoogleIntegrationsModalProps) {
  const [statusData, setStatusData] = useState<GoogleIntegrationStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'drive' | 'sheets' | 'gmail'>('all');

  const loadStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetchGoogleIntegrationStatus();
      if (res.data) {
        setStatusData(res.data);
      }
    } catch (err: any) {
      console.error('Error al cargar estado de Google:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load status on open
  useEffect(() => {
    if (isOpen) {
      loadStatus();
    }
  }, [isOpen, loadStatus]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleConnectToggle = async () => {
    try {
      setActiveAction('auth');
      if (statusData?.is_connected) {
        const res = await disconnectGoogleIntegration();
        setStatusData(res.data);
        showFeedback('Cuenta de Google desvinculada');
      } else {
        const res = await connectGoogleIntegration({
          email: 'finanzas@splitledger.io',
          name: 'SplitLedger Finance & Audit'
        });
        setStatusData(res.data);
        showFeedback('Cuenta de Google Workspace vinculada');
      }
    } catch (err: any) {
      showFeedback(`Error: ${err.message}`);
    } finally {
      setActiveAction(null);
    }
  };

  const handleSyncDrive = async () => {
    try {
      setActiveAction('drive');
      const res = await syncGoogleDrive();
      showFeedback(res.message || 'Sincronizado con Google Drive');
      await loadStatus();
    } catch (err: any) {
      showFeedback(`Error en Drive: ${err.message}`);
    } finally {
      setActiveAction(null);
    }
  };

  const handleSyncSheets = async () => {
    try {
      setActiveAction('sheets');
      const res = await syncGoogleSheets();
      showFeedback(res.message || 'Libro Diario volcado en Google Sheets');
      await loadStatus();
    } catch (err: any) {
      showFeedback(`Error en Sheets: ${err.message}`);
    } finally {
      setActiveAction(null);
    }
  };

  const handleFetchGmail = async () => {
    try {
      setActiveAction('gmail');
      const res = await fetchGmailInvoices();
      showFeedback(res.message || 'Escaneo de Gmail completado');
      await loadStatus();
    } catch (err: any) {
      showFeedback(`Error en Gmail: ${err.message}`);
    } finally {
      setActiveAction(null);
    }
  };

  const showFeedback = (msg: string) => {
    setActionFeedback(msg);
    if (onSuccessMessage) onSuccessMessage(msg);
    setTimeout(() => {
      setActionFeedback(null);
    }, 4000);
  };

  if (!isOpen) return null;

  const isConnected = statusData?.is_connected ?? true;
  const driveInfo = statusData?.services.drive;
  const sheetsInfo = statusData?.services.sheets;
  const gmailInfo = statusData?.services.gmail;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] bg-[#141416] border border-dashed border-[#444748]/70 rounded-3xl p-5 sm:p-7 shadow-[0_25px_60px_rgba(0,0,0,0.9)] flex flex-col gap-5 overflow-hidden animate-pop-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between pb-4 border-b border-dashed border-[#444748]/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-zinc-900 border border-dashed border-[#444748]/70 flex items-center justify-center shadow-inner shrink-0">
              {/* Google G multi-color icon */}
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-semibold text-white tracking-tight">
                  Integraciones Google Workspace & Cloud
                </h2>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-dashed border-[#444748]/50">
                  OAuth 2.0
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Conexión directa con Google Drive, Google Sheets, Gmail y autenticación federada.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800/60 transition-colors cursor-pointer"
            title="Cerrar modal"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Action Feedback Banner */}
        {actionFeedback && (
          <div className="p-3 rounded-xl bg-zinc-900 border border-dashed border-emerald-500/40 text-emerald-300 text-xs flex items-center justify-between animate-fade-in shrink-0">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-emerald-400">check_circle</span>
              <span>{actionFeedback}</span>
            </div>
            <button
              onClick={() => setActionFeedback(null)}
              className="text-zinc-400 hover:text-white"
            >
              <span className="material-symbols-outlined text-[14px]">close</span>
            </button>
          </div>
        )}

        {/* Account Status Card */}
        <div className="p-4 rounded-2xl bg-[#1c1b1d] border border-dashed border-[#444748]/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-zinc-800 border border-dashed border-zinc-600 flex items-center justify-center font-bold text-sm text-white shrink-0">
              {statusData?.account_name ? statusData.account_name.charAt(0) : 'G'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white truncate">
                  {statusData?.account_name || 'Cuenta Google Workspace'}
                </span>
                {isConnected ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-800/40 text-[10px] font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>Conectado</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-300 border border-amber-800/40 text-[10px] font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                    <span>Desconectado</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 font-mono mt-0.5 truncate">
                {statusData?.account_email || 'Sin cuenta asociada'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {isConnected ? (
              <button
                type="button"
                onClick={handleConnectToggle}
                disabled={activeAction === 'auth'}
                className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-medium border border-dashed border-zinc-600 transition-colors cursor-pointer disabled:opacity-50"
              >
                {activeAction === 'auth' ? 'Procesando...' : 'Desconectar'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConnectToggle}
                disabled={activeAction === 'auth'}
                className="px-4 py-1.5 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 text-xs font-semibold shadow-sm transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <span>Conectar Google Workspace</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Navigation Tabs */}
        <div className="flex items-center justify-between pb-1 shrink-0">
          <div className="inline-flex items-center p-1 rounded-full bg-zinc-900 border border-dashed border-[#444748]/50 text-xs">
            {[
              { id: 'all', label: 'Todas las Herramientas' },
              { id: 'drive', label: 'Google Drive' },
              { id: 'sheets', label: 'Google Sheets' },
              { id: 'gmail', label: 'Gmail' }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1 rounded-full transition-colors cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-zinc-800 text-white font-medium shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={loadStatus}
            disabled={isLoading}
            className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
            title="Refrescar estado de conexión"
          >
            <span className={`material-symbols-outlined text-[16px] ${isLoading ? 'animate-spin' : ''}`}>sync</span>
            <span className="hidden sm:inline">Refrescar</span>
          </button>
        </div>

        {/* Tool Cards Scrollable Grid */}
        <div className="overflow-y-auto space-y-3.5 pr-1 flex-1">

          {/* 1. GOOGLE DRIVE */}
          {(activeTab === 'all' || activeTab === 'drive') && (
            <div className="p-4 sm:p-5 rounded-2xl bg-[#1c1b1d] border border-dashed border-[#444748]/50 hover:border-zinc-500 transition-colors flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-dashed border-zinc-700 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[20px] text-amber-400">add_to_drive</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">Google Drive</h3>
                    <p className="text-xs text-zinc-400">
                      Almacenamiento de facturas escaneadas, carpetas por Workspace y exportaciones automáticas.
                    </p>
                  </div>
                </div>

                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-zinc-800 text-zinc-300 border border-dashed border-zinc-600 shrink-0">
                  {driveInfo?.synced_files_count ?? 0} archivos sincronizados
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-zinc-400 pt-1 border-t border-dashed border-[#444748]/40">
                <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-900/60">
                  <span>Carpeta vinculada:</span>
                  <span className="font-medium text-white truncate max-w-[160px]">
                    {driveInfo?.folder_name || 'SplitLedger Facturas'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-900/60">
                  <span>Última sincronización:</span>
                  <span className="font-mono text-zinc-300">
                    {driveInfo?.last_sync ? new Date(driveInfo.last_sync).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : 'Nunca'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <a
                  href={driveInfo?.folder_url || 'https://drive.google.com'}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-sky-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>Abrir carpeta en Drive</span>
                  <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                </a>

                <button
                  type="button"
                  onClick={handleSyncDrive}
                  disabled={activeAction === 'drive'}
                  className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium border border-dashed border-zinc-600 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <span className={`material-symbols-outlined text-[15px] ${activeAction === 'drive' ? 'animate-spin' : ''}`}>sync</span>
                  <span>{activeAction === 'drive' ? 'Sincronizando...' : 'Sincronizar ahora'}</span>
                </button>
              </div>
            </div>
          )}

          {/* 2. GOOGLE SHEETS */}
          {(activeTab === 'all' || activeTab === 'sheets') && (
            <div className="p-4 sm:p-5 rounded-2xl bg-[#1c1b1d] border border-dashed border-[#444748]/50 hover:border-zinc-500 transition-colors flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-dashed border-zinc-700 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[20px] text-emerald-400">table_chart</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">Google Sheets</h3>
                    <p className="text-xs text-zinc-400">
                      Volcado en tiempo real de partidas desglosadas, cuentas del PGC y balance de partida doble.
                    </p>
                  </div>
                </div>

                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-zinc-800 text-zinc-300 border border-dashed border-zinc-600 shrink-0">
                  {sheetsInfo?.synced_rows_count ?? 0} filas contables
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-zinc-400 pt-1 border-t border-dashed border-[#444748]/40">
                <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-900/60">
                  <span>Hoja vinculada:</span>
                  <span className="font-medium text-white truncate max-w-[160px]">
                    {sheetsInfo?.sheet_name || 'Libro Diario PGC'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-900/60">
                  <span>Última actualización:</span>
                  <span className="font-mono text-zinc-300">
                    {sheetsInfo?.last_sync ? new Date(sheetsInfo.last_sync).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : 'Nunca'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <a
                  href={sheetsInfo?.sheet_url || 'https://docs.google.com/spreadsheets'}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>Abrir hoja de cálculo</span>
                  <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                </a>

                <button
                  type="button"
                  onClick={handleSyncSheets}
                  disabled={activeAction === 'sheets'}
                  className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium border border-dashed border-zinc-600 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <span className={`material-symbols-outlined text-[15px] ${activeAction === 'sheets' ? 'animate-spin' : ''}`}>sync</span>
                  <span>{activeAction === 'sheets' ? 'Actualizando...' : 'Actualizar Asientos'}</span>
                </button>
              </div>
            </div>
          )}

          {/* 3. GMAIL & WORKSPACE INBOX */}
          {(activeTab === 'all' || activeTab === 'gmail') && (
            <div className="p-4 sm:p-5 rounded-2xl bg-[#1c1b1d] border border-dashed border-[#444748]/50 hover:border-zinc-500 transition-colors flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-dashed border-zinc-700 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[20px] text-red-400">mail</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">Gmail / Bandeja de Proveedores</h3>
                    <p className="text-xs text-zinc-400">
                      Escaneo de facturas y tickets adjuntos (PDF, XML, Excel) recibidos por correo electrónico.
                    </p>
                  </div>
                </div>

                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-zinc-800 text-zinc-300 border border-dashed border-zinc-600 shrink-0">
                  {gmailInfo?.detected_invoices_count ?? 0} facturas procesadas
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-zinc-400 pt-1 border-t border-dashed border-[#444748]/40">
                <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-900/60">
                  <span>Filtro de búsqueda:</span>
                  <span className="font-mono text-zinc-300 text-[11px] truncate max-w-[160px]" title={gmailInfo?.query}>
                    has:attachment (pdf|xml)
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-900/60">
                  <span>Último escaneo:</span>
                  <span className="font-mono text-zinc-300">
                    {gmailInfo?.last_scan ? new Date(gmailInfo.last_scan).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : 'Nunca'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-zinc-500">
                  Frecuencia de escaneo: Cada {gmailInfo?.polling_interval_minutes || 15} minutos
                </span>

                <button
                  type="button"
                  onClick={handleFetchGmail}
                  disabled={activeAction === 'gmail'}
                  className="px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium border border-dashed border-zinc-600 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <span className={`material-symbols-outlined text-[15px] ${activeAction === 'gmail' ? 'animate-spin' : ''}`}>forward_to_inbox</span>
                  <span>{activeAction === 'gmail' ? 'Escaneando...' : 'Comprobar bandeja'}</span>
                </button>
              </div>
            </div>
          )}

          {/* 4. GOOGLE SIGN-IN / OAUTH INFO */}
          {activeTab === 'all' && (
            <div className="p-3.5 rounded-2xl bg-zinc-900/60 border border-dashed border-zinc-800 flex items-center justify-between text-xs text-zinc-400">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-zinc-500 text-[18px]">verified_user</span>
                <span>Permisos delegados mediante protocolo OAuth 2.0 con cifrado TLS 1.3 de extremo a extremo.</span>
              </div>
              <span className="text-zinc-500 font-mono text-[11px]">Google Identity API</span>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="pt-3 border-t border-dashed border-[#444748]/50 flex items-center justify-between shrink-0">
          <span className="text-xs text-zinc-500">
            SplitLedger Cloud Connector v2.4
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium border border-dashed border-zinc-600 transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
