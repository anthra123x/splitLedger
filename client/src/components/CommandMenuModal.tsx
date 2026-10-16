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
