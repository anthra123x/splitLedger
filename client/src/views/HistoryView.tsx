import React, { useState } from 'react';
import { getExportCsvUrl, getExportZipUrl, deleteInvoice } from '../services/api';
import { Invoice, SystemMetrics } from '../types';

interface HistoryViewProps {
  invoices?: Invoice[];
  metrics?: SystemMetrics;
  onSelectInvoice: (invoice: Invoice) => void;
  onInvoiceDeleted?: (id: string) => void;
}

export default function HistoryView({
  invoices = [],
  metrics = {},
  onSelectInvoice,
  onInvoiceDeleted
}: HistoryViewProps) {
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'Todas' | 'Desglosadas' | 'En Proceso'>('Todas');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Filter invoices
  const filtered = invoices.filter((inv) => {
    const term = search.toLowerCase();
    const matchesSearch =
      !search.trim() ||
      inv.supplier_name?.toLowerCase().includes(term) ||
      inv.invoice_number?.toLowerCase().includes(term) ||
      inv.supplier_tax_id?.toLowerCase().includes(term);

    const matchesStatus =
      statusFilter === 'Todas' ||
      (statusFilter === 'Desglosadas' && (inv.status === 'analyzed' || inv.status === 'reconciled')) ||
      (statusFilter === 'En Proceso' && (inv.status === 'processing' || inv.status === 'pending'));

    return matchesSearch && matchesStatus;
  });

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filtered.map((i) => i.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((i) => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`¿Deseas eliminar las ${selectedIds.length} facturas seleccionadas?`)) return;

    for (const id of selectedIds) {
      try {
        await deleteInvoice(id);
        if (onInvoiceDeleted) onInvoiceDeleted(id);
      } catch (err) {
        console.error(err);
      }
    }
    setSelectedIds([]);
  };

  return (
    <div className="w-full pt-20 bg-transparent min-h-[calc(100vh-5rem)]">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
        
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Historial & Conciliación</h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              Registro forense y libro mayor de partidas desglosadas con motor de IA y OCR
            </p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={getExportZipUrl({ search, status: statusFilter })}
              download="SplitLedger_Dossier_Contable.zip"
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-semibold transition-all shadow-md cursor-pointer border border-dashed border-[#444748]/60 hover:border-zinc-400"
            >
              <span className="material-symbols-outlined text-[18px]">folder_zip</span>
              <span>Exportar Dossier (ZIP)</span>
            </a>
            <a
              href={getExportCsvUrl()}
              download="SplitLedger_Export_Facturas.csv"
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white text-zinc-950 hover:bg-zinc-200 text-xs font-semibold transition-all shadow-md cursor-pointer border border-dashed border-zinc-300"
            >
              <span className="material-symbols-outlined text-[18px]">download_for_offline</span>
              <span>Exportar Libro (CSV)</span>
            </a>
          </div>
        </div>

        {/* Global Metrics Pill Bar */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 p-1.5 rounded-xl bg-[#0e0e10]/80 backdrop-blur-md shadow-inner border border-dashed border-[#444748]/50">
          
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[#1c1b1d]/80 border border-dashed border-[#444748]/35 transition-colors hover:bg-[#201f22]">
            <div className="w-8 h-8 rounded flex items-center justify-center bg-[#353437] text-white">
              <span className="material-symbols-outlined text-[18px]">receipt_long</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] text-[#c4c7c8]">Facturas analizadas</span>
              <span className="text-sm sm:text-base font-semibold text-white">
                {metrics.total_invoices ?? invoices.length} registradas
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[#1c1b1d]/80 border border-dashed border-[#444748]/35 transition-colors hover:bg-[#201f22]">
            <div className="w-8 h-8 rounded flex items-center justify-center bg-[#353437] text-white">
              <span className="material-symbols-outlined text-[18px]">document_scanner</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] text-[#c4c7c8]">Tasa de reconocimiento</span>
              <span className="text-sm sm:text-base font-semibold text-white">
                {metrics.avg_confidence || '99.8'}% Precisión OCR
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[#1c1b1d]/80 border border-dashed border-[#444748]/35 transition-colors hover:bg-[#201f22]">
            <div className="w-8 h-8 rounded flex items-center justify-center bg-[#353437] text-white">
              <span className="material-symbols-outlined text-[18px]">account_tree</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] text-[#c4c7c8]">Desglose analítico</span>
              <span className="text-sm sm:text-base font-semibold text-white">
                {metrics.total_items || invoices.reduce((acc, i) => acc + (i.items_count || 1), 0)} Partidas
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[#1c1b1d]/80 border border-dashed border-[#444748]/35 transition-colors hover:bg-[#201f22]">
            <div className="w-8 h-8 rounded flex items-center justify-center bg-[#353437] text-white">
              <span className="material-symbols-outlined text-[18px]">payments</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] text-[#c4c7c8]">Volumen conciliado</span>
              <span className="text-sm sm:text-base font-semibold text-white">
                {(metrics.reconciled_volume || invoices.reduce((acc, i) => acc + (i.grand_total || 0), 0)).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
              </span>
            </div>
          </div>

        </div>

        {/* Search & Filter Controls */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 p-3 rounded-xl bg-[#1c1b1d]/85 backdrop-blur-md border border-dashed border-[#444748]/50 shadow-sm">
          
          {/* Search Input */}
          <div className="relative flex-1 min-w-[280px]">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px] text-[#c4c7c8] pointer-events-none">
              search
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por proveedor, NIF, ID factura o concepto..."
              className="w-full pl-10 pr-12 py-2 bg-[#353437] rounded-lg text-xs sm:text-sm text-white placeholder-[#c4c7c8] focus:outline-none focus:ring-1 focus:ring-white transition-all"
            />
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#201f22] border border-dashed border-[#444748]/40 text-[#c4c7c8] text-[10px] font-mono">
              <span>⌘F</span>
            </div>
          </div>

          {/* Filters Group */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center p-1 rounded-lg bg-[#2a2a2c] border border-dashed border-[#444748]/40 text-xs">
              {(['Todas', 'Desglosadas', 'En Proceso'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                    statusFilter === status
                      ? 'bg-[#353437] text-white font-medium shadow-sm'
                      : 'text-[#c4c7c8] hover:text-white'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>

            {selectedIds.length > 0 && (
              <div className="flex items-center gap-2">
                <a
                  href={getExportZipUrl({ ids: selectedIds })}
                  download={`SplitLedger_Seleccion_${selectedIds.length}_Facturas.zip`}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-800 border border-dashed border-zinc-600 text-zinc-100 text-xs hover:bg-zinc-700 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">folder_zip</span>
                  <span>Exportar ZIP ({selectedIds.length})</span>
                </a>
                <button
                  onClick={handleDeleteSelected}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-950/60 border border-dashed border-red-800/50 text-red-300 text-xs hover:bg-red-900/60 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">delete</span>
                  <span>Eliminar ({selectedIds.length})</span>
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Master Invoices Table */}
        <div className="w-full rounded-xl bg-[#0e0e10]/85 backdrop-blur-md border border-dashed border-[#444748]/50 overflow-hidden shadow-xl">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#1c1b1d] text-zinc-400 text-[11px] uppercase tracking-wider select-none border-b border-dashed border-[#444748]/40">
                  <th className="w-10 px-4 py-3 text-center" scope="col">
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && selectedIds.length === filtered.length}
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded bg-[#353437] accent-white cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-3 font-medium">ID Factura</th>
                  <th className="px-4 py-3 font-medium">Proveedor / Emisor</th>
                  <th className="px-4 py-3 font-medium">Fecha</th>
                  <th className="px-4 py-3 font-medium text-center">Partidas</th>
                  <th className="px-4 py-3 font-medium text-right">Base Imponible</th>
                  <th className="px-4 py-3 font-medium text-right">Impuestos</th>
                  <th className="px-4 py-3 font-medium text-right">Total Factura</th>
                  <th className="px-4 py-3 font-medium text-center">Estado</th>
                  <th className="px-4 py-3 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dashed divide-[#2a2a2c]/80 text-xs text-zinc-200">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-zinc-500">
                      No se encontraron facturas con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  filtered.map((inv) => {
                    const isSelected = selectedIds.includes(inv.id);
                    const isAnalyzed = inv.status === 'analyzed' || inv.status === 'reconciled';
                    return (
                      <tr
                        key={inv.id}
                        className={`hover:bg-[#1c1b1d]/70 transition-colors group cursor-pointer ${
                          isSelected ? 'bg-[#201f22]' : ''
                        }`}
                      >
                        <td className="px-4 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelect(inv.id)}
                            className="w-4 h-4 rounded bg-[#353437] accent-white cursor-pointer"
                          />
                        </td>
                        <td
                          className="px-4 py-3.5 font-mono text-white font-medium"
                          onClick={() => onSelectInvoice(inv)}
                        >
                          {inv.invoice_number}
                        </td>
                        <td className="px-4 py-3.5" onClick={() => onSelectInvoice(inv)}>
                          <div className="flex flex-col min-w-[200px]">
                            <span className="font-medium text-white tracking-tight">{inv.supplier_name}</span>
                            <span className="text-[11px] text-zinc-400 font-mono">
                              NIF: {inv.supplier_tax_id || 'N/D'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap text-zinc-400" onClick={() => onSelectInvoice(inv)}>
                          {inv.invoice_date}
                        </td>
                        <td className="px-4 py-3.5 text-center whitespace-nowrap" onClick={() => onSelectInvoice(inv)}>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#2a2a2c] text-white text-[11px] font-mono">
                            <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                            {inv.items_count || 1} partidas
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono text-zinc-300" onClick={() => onSelectInvoice(inv)}>
                          {(inv.subtotal || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono text-zinc-400 text-[11px]" onClick={() => onSelectInvoice(inv)}>
                          {(inv.tax_total || 0).toFixed(2)} € <span className="opacity-75">(21%)</span>
                        </td>
                        <td className="px-4 py-3.5 text-right font-mono font-semibold text-white" onClick={() => onSelectInvoice(inv)}>
                          {(inv.grand_total || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                        </td>
                        <td className="px-4 py-3.5 text-center whitespace-nowrap" onClick={() => onSelectInvoice(inv)}>
                          {isAnalyzed ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-950/40 text-emerald-300 border border-emerald-800/40 text-[11px] font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                              Desglosada
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#2a2a2c] text-zinc-300 border border-[#444748]/40 text-[11px] font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                              En proceso
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectInvoice(inv);
                            }}
                            className="inline-flex items-center gap-1.5 text-white hover:text-zinc-200 text-xs transition-all cursor-pointer font-medium active:scale-95 group/btn"
                          >
                            <span>Ver desglose</span>
                            <span className="material-symbols-outlined text-[16px] group-hover/btn:translate-x-1 transition-transform">arrow_forward</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
