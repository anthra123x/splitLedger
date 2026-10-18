import React, { useState, useEffect } from 'react';
import { Invoice } from '../types/index.js';

interface CommandMenuModalProps {
  isOpen: boolean;
  onClose: (open: boolean) => void;
  onSelectAction: (action: string) => void;
  invoices?: Invoice[];
}

export default function CommandMenuModal({ isOpen, onClose, onSelectAction, invoices = [] }: CommandMenuModalProps) {
  const [search, setSearch] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onClose(!isOpen);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        onSelectAction('open:google-integrations');
        onClose(false);
      }
      if (e.key === 'Escape' && isOpen) {
        onClose(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredInvoices = invoices.filter(inv =>
    inv.supplier_name?.toLowerCase().includes(search.toLowerCase()) ||
    inv.invoice_number?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-xl bg-[#1c1b1d]/95 backdrop-blur-2xl border border-dashed border-[#444748]/60 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search header */}
        <div className="flex items-center px-4 py-3 border-b border-dashed border-[#444748]/40 gap-3">
          <span className="material-symbols-outlined text-zinc-400 text-[20px]">search</span>
          <input
            type="text"
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar comandos, proveedores o facturas..."
            className="flex-1 bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none"
          />
          <kbd className="px-2 py-0.5 rounded bg-[#2a2a2c] text-[11px] text-zinc-400 font-mono border border-dashed border-[#444748]/40">ESC</kbd>
        </div>

        {/* Action list */}
        <div className="p-2 space-y-1 max-h-80 overflow-y-auto">
          <div className="px-3 py-1 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
            Navegación Rápida
          </div>

          <button
            onClick={() => { onSelectAction('open:chat'); onClose(false); }}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-[#201f22]/60 hover:bg-[#2a2a2c] text-left text-xs text-zinc-200 transition-colors cursor-pointer group border border-dashed border-[#444748]/50"
          >
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[18px] text-zinc-200 group-hover:scale-110 transition-transform">splitscreen</span>
              <span className="font-medium text-white">Consultar a SplitLedger AI</span>
            </div>
            <span className="text-[10px] text-zinc-400 font-mono">⌘J</span>
          </button>

          <button
            onClick={() => { onSelectAction('view:upload'); onClose(false); }}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[#2a2a2c] text-left text-xs text-zinc-200 transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[18px] text-zinc-400 group-hover:text-white">upload_file</span>
              <span>Subir y Descomponer Facturas</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">1</span>
          </button>

          <button
            onClick={() => { onSelectAction('view:detail'); onClose(false); }}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[#2a2a2c] text-left text-xs text-zinc-200 transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[18px] text-zinc-400 group-hover:text-white">splitscreen</span>
              <span>Mesa de Desglose Forense (Split View)</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">2</span>
          </button>

          <button
            onClick={() => { onSelectAction('view:history'); onClose(false); }}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[#2a2a2c] text-left text-xs text-zinc-200 transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[18px] text-zinc-400 group-hover:text-white">table_chart</span>
              <span>Historial & Conciliación General</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">3</span>
          </button>

          <button
            onClick={() => { onSelectAction('export:csv'); onClose(false); }}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[#2a2a2c] text-left text-xs text-zinc-200 transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[18px] text-emerald-400">download</span>
              <span className="text-emerald-300">Descargar Libro Contable (CSV PGC)</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">⌘E</span>
          </button>

          <button
            onClick={() => { onSelectAction('open:google-integrations'); onClose(false); }}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[#2a2a2c] text-left text-xs text-zinc-200 transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-2.5">
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>Integraciones Google (Drive, Sheets, Gmail)</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">⌘G</span>
          </button>

          <button
            onClick={() => { onSelectAction('view:auth'); onClose(false); }}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[#2a2a2c] text-left text-xs text-zinc-200 transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[18px] text-zinc-400 group-hover:text-white">passkey</span>
              <span>Iniciar Sesión / Registro de Auditor</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">⌘L</span>
          </button>

          {/* Facturas coincidentes */}
          {filteredInvoices.length > 0 && (
            <>
              <div className="px-3 pt-3 pb-1 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase">
                Facturas Encontradas
              </div>
              {filteredInvoices.slice(0, 5).map(inv => (
                <button
                  key={inv.id}
                  onClick={() => { onSelectAction(`invoice:${inv.id}`); onClose(false); }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[#2a2a2c] text-left text-xs text-zinc-200 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-[18px] text-zinc-400">receipt_long</span>
                    <div>
                      <p className="font-medium text-white">{inv.supplier_name}</p>
                      <p className="text-[11px] text-zinc-400 font-mono">{inv.invoice_number} • {(inv.grand_total || 0).toFixed(2)} €</p>
                    </div>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">Abrir</span>
                </button>
              ))}
            </>
          )}
        </div>

        <div className="px-4 py-2 bg-[#131315] border-t border-[#444748]/30 flex items-center justify-between text-[11px] text-zinc-500">
          <span>Usa <strong className="text-zinc-400">↑↓</strong> para moverte y <strong className="text-zinc-400">Enter</strong> para ejecutar</span>
          <span>SplitLedger Core v2.4</span>
        </div>
      </div>
    </div>
  );
}
