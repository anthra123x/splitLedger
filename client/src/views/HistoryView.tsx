import React, { useState, useMemo, useEffect } from 'react';
import {
  getExportCsvUrl,
  getExportZipUrl,
  deleteInvoice,
  fetchWorkspaces,
  createWorkspace,
  deleteWorkspace,
  assignInvoicesToWorkspace
} from '../services/api';
import { exportInvoicePdf, exportWorkspacePdf } from '../services/pdfExportService';
import { Invoice, SystemMetrics, Workspace } from '../types/index.js';

interface HistoryViewProps {
  invoices?: Invoice[];
  metrics?: SystemMetrics;
  onSelectInvoice: (invoice: Invoice) => void;
  onInvoiceDeleted?: (id: string) => void;
  onInvoicesUpdated?: () => void;
}

interface DayWorkspace {
  dateKey: string;
  label: string;
  fullDateLabel: string;
  invoices: Invoice[];
  totalVolume: number;
  reconciledCount: number;
}

const WORKSPACE_PALETTE = [
  { color: '#ffffff', label: 'Blanco Puro' },
  { color: '#38bdf8', label: 'Cian Sky' },
  { color: '#34d399', label: 'Verde Esmeralda' },
  { color: '#f59e0b', label: 'Ámbar Cálido' },
  { color: '#f43f5e', label: 'Rosa Carmesí' },
  { color: '#a855f7', label: 'Violeta Eléctrico' },
];

export default function HistoryView({
  invoices = [],
  metrics = {},
  onSelectInvoice,
  onInvoiceDeleted,
  onInvoicesUpdated
}: HistoryViewProps) {
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'Todas' | 'Desglosadas' | 'En Proceso'>('Todas');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  // Custom Workspaces from Database
  const [customWorkspaces, setCustomWorkspaces] = useState<Workspace[]>([]);
  const [unassignedStats, setUnassignedStats] = useState<{ count: number; total_volume: number }>({ count: 0, total_volume: 0 });
  const [activeCategory, setActiveCategory] = useState<'custom' | 'daily'>('custom');
  const [selectedCustomWsId, setSelectedCustomWsId] = useState<string>('all');

  // Modal / Creator State
  const [isCreatingWs, setIsCreatingWs] = useState(false);
  const [newWsName, setNewWsName] = useState('');
  const [newWsDesc, setNewWsDesc] = useState('');
  const [newWsColor, setNewWsColor] = useState('#38bdf8');
  const [isSubmittingWs, setIsSubmittingWs] = useState(false);

  // Bulk Assignment Modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignTargetWsId, setAssignTargetWsId] = useState<string>('');

  // Daily Workspaces state
  const [activeDailyDate, setActiveDailyDate] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'tabs' | 'grouped'>('tabs');
  const [collapsedDays, setCollapsedDays] = useState<Record<string, boolean>>({});

  // Load Custom Workspaces from Backend
  const loadCustomWorkspaces = async () => {
    try {
      const res = await fetchWorkspaces();
      if (res.data) {
        setCustomWorkspaces(res.data.workspaces || []);
        if (res.data.unassigned) {
          setUnassignedStats(res.data.unassigned);
        }
      }
    } catch (err) {
      console.error('Error al cargar workspaces:', err);
    }
  };

  useEffect(() => {
    loadCustomWorkspaces();
  }, []);

  // 1. Group invoices into Day Workspaces based on processing date (created_at)
  const dailyWorkspaces = useMemo<DayWorkspace[]>(() => {
    const map = new Map<string, Invoice[]>();

    invoices.forEach((inv) => {
      const dateKey = inv.created_at
        ? inv.created_at.substring(0, 10)
        : (inv.invoice_date || 'sin-fecha');

      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(inv);
    });

    const sortedDates = Array.from(map.keys()).sort((a, b) => b.localeCompare(a));
    const todayStr = new Date().toISOString().substring(0, 10);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().substring(0, 10);

    return sortedDates.map((dateKey) => {
      const dayInvoices = map.get(dateKey)!;
      let label = dateKey;
      let fullDateLabel = dateKey;

      if (dateKey !== 'sin-fecha') {
        const parts = dateKey.split('-');
        if (parts.length === 3) {
          const dateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          const day = dateObj.getDate();
          const monthShort = dateObj.toLocaleDateString('es-ES', { month: 'short' });
          const monthLong = dateObj.toLocaleDateString('es-ES', { month: 'long' });
          const year = dateObj.getFullYear();

          if (dateKey === todayStr) {
            label = `Hoy, ${day} ${monthShort}`;
          } else if (dateKey === yesterdayStr) {
            label = `Ayer, ${day} ${monthShort}`;
          } else {
            label = `${day} ${monthShort} ${year}`;
          }

          fullDateLabel = `${day} de ${monthLong} de ${year}`;
        }
      } else {
        label = 'Sin fecha';
        fullDateLabel = 'Facturas sin fecha de procesamiento';
      }

      const totalVolume = dayInvoices.reduce((acc, i) => acc + (i.grand_total || 0), 0);
      const reconciledCount = dayInvoices.filter(
        (i) => i.status === 'analyzed' || i.status === 'reconciled'
      ).length;

      return {
        dateKey,
        label,
        fullDateLabel,
        invoices: dayInvoices,
        totalVolume,
        reconciledCount
      };
    });
  }, [invoices]);

  // Active Daily Workspace
  const currentDailyWorkspace = useMemo(() => {
    if (activeDailyDate === 'all') return null;
    return dailyWorkspaces.find((w) => w.dateKey === activeDailyDate) || null;
  }, [dailyWorkspaces, activeDailyDate]);

  // Active Custom Workspace
  const currentCustomWorkspace = useMemo(() => {
    if (selectedCustomWsId === 'all' || selectedCustomWsId === 'unassigned') return null;
    return customWorkspaces.find((w) => w.id === selectedCustomWsId) || null;
  }, [customWorkspaces, selectedCustomWsId]);

  // Filter invoices according to:
  // - Category (custom vs daily)
  // - Search
  // - Status
  const filteredInvoices = useMemo(() => {
    let list = invoices;

    if (activeCategory === 'custom') {
      if (selectedCustomWsId === 'unassigned') {
        list = list.filter((inv) => !inv.workspace_id);
      } else if (selectedCustomWsId !== 'all') {
        list = list.filter((inv) => inv.workspace_id === selectedCustomWsId);
      }
    } else {
      if (activeDailyDate !== 'all') {
        list = list.filter((inv) => {
          const dateKey = inv.created_at
            ? inv.created_at.substring(0, 10)
            : (inv.invoice_date || 'sin-fecha');
          return dateKey === activeDailyDate;
        });
      }
    }

    const term = search.toLowerCase().trim();

    return list.filter((inv) => {
      const matchesSearch =
        !term ||
        inv.supplier_name?.toLowerCase().includes(term) ||
        inv.invoice_number?.toLowerCase().includes(term) ||
        inv.supplier_tax_id?.toLowerCase().includes(term);

      const matchesStatus =
        statusFilter === 'Todas' ||
        (statusFilter === 'Desglosadas' && (inv.status === 'analyzed' || inv.status === 'reconciled')) ||
        (statusFilter === 'En Proceso' && (inv.status === 'processing' || inv.status === 'pending'));

      return matchesSearch && matchesStatus;
    });
  }, [invoices, activeCategory, selectedCustomWsId, activeDailyDate, search, statusFilter]);

  // Selection handlers
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredInvoices.map((i) => i.id));
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
    loadCustomWorkspaces();
  };

  // Create Workspace
  const handleCreateWorkspaceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsName.trim()) return;

    setIsSubmittingWs(true);
    try {
      const res = await createWorkspace({
        name: newWsName.trim(),
        description: newWsDesc.trim() || undefined,
        color: newWsColor,
        icon: 'folder'
      });
      setNewWsName('');
      setNewWsDesc('');
      setIsCreatingWs(false);
      await loadCustomWorkspaces();
      setSelectedCustomWsId(res.data.id);
    } catch (err: any) {
      alert(err.message || 'Error al crear el workspace');
    } finally {
      setIsSubmittingWs(false);
    }
  };

  // Delete Workspace
  const handleDeleteWorkspace = async (wsId: string, wsName: string) => {
    if (!confirm(`¿Eliminar el workspace "${wsName}"? Las facturas no se borrarán; volverán a la bandeja general.`)) return;

    try {
      await deleteWorkspace(wsId);
      if (selectedCustomWsId === wsId) {
        setSelectedCustomWsId('all');
      }
      await loadCustomWorkspaces();
      if (onInvoicesUpdated) onInvoicesUpdated();
    } catch (err: any) {
      alert(err.message || 'Error al eliminar el workspace');
    }
  };

  // Bulk Assign Invoices to Workspace
  const handleAssignInvoicesSubmit = async () => {
    if (selectedIds.length === 0) return;

    try {
      await assignInvoicesToWorkspace(assignTargetWsId || 'unassign', selectedIds);
      setSelectedIds([]);
      setShowAssignModal(false);
      await loadCustomWorkspaces();
      if (onInvoicesUpdated) onInvoicesUpdated();
    } catch (err: any) {
      alert(err.message || 'Error al asignar facturas');
    }
  };

  // PDF Export Trigger
  const handleExportPdf = () => {
    let title = 'Libro Diario General';
    let dateLabel = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

    if (activeCategory === 'custom' && currentCustomWorkspace) {
      title = `Workspace: ${currentCustomWorkspace.name}`;
      dateLabel = `Proyecto Contable (${currentCustomWorkspace.invoices_count || filteredInvoices.length} facturas)`;
    } else if (activeCategory === 'daily' && currentDailyWorkspace) {
      title = `Workspace: ${currentDailyWorkspace.label}`;
      dateLabel = currentDailyWorkspace.fullDateLabel;
    }

    exportWorkspacePdf({
      workspaceTitle: title,
      dateLabel,
      invoices: filteredInvoices
    });
  };

  const handleExportSelectedPdf = () => {
    const selectedInvoices = invoices.filter((i) => selectedIds.includes(i.id));
    exportWorkspacePdf({
      workspaceTitle: `Selección de ${selectedInvoices.length} Facturas Auditadas`,
      dateLabel: new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }),
      invoices: selectedInvoices
    });
  };

  const toggleDayCollapse = (dateKey: string) => {
    setCollapsedDays((prev) => ({
      ...prev,
      [dateKey]: !prev[dateKey]
    }));
  };

  // Helper renderer for table rows
  const renderTableRows = (invoiceList: Invoice[]) => {
    if (invoiceList.length === 0) {
      return (
        <tr>
          <td colSpan={10} className="py-8 text-center text-zinc-500">
            No se encontraron facturas con los filtros seleccionados.
          </td>
        </tr>
      );
    }

    return invoiceList.map((inv) => {
      const isSelected = selectedIds.includes(inv.id);
      const isAnalyzed = inv.status === 'analyzed' || inv.status === 'reconciled';
      const assignedWs = customWorkspaces.find((w) => w.id === inv.workspace_id) || inv.workspace;

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
            className="px-4 py-3.5 font-mono text-white font-medium whitespace-nowrap"
            onClick={() => onSelectInvoice(inv)}
          >
            {inv.invoice_number || 'S/N'}
          </td>
          <td className="px-4 py-3.5" onClick={() => onSelectInvoice(inv)}>
            <div className="flex flex-col min-w-[190px]">
              <span className="font-medium text-white tracking-tight">{inv.supplier_name}</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[11px] text-zinc-400 font-mono">
                  NIF: {inv.supplier_tax_id || 'N/D'}
                </span>
                {assignedWs && (
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-medium border border-white/10"
                    style={{ backgroundColor: `${assignedWs.color || '#ffffff'}15`, color: assignedWs.color || '#ffffff' }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: assignedWs.color || '#ffffff' }}></span>
                    <span>{assignedWs.name}</span>
                  </span>
                )}
              </div>
            </div>
          </td>
          <td className="px-4 py-3.5 whitespace-nowrap text-zinc-400 font-mono text-xs" onClick={() => onSelectInvoice(inv)}>
            {inv.invoice_date || '-'}
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
            {(inv.tax_total || 0).toFixed(2)} €
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
            <div className="flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  exportInvoicePdf(inv);
                }}
                className="p-1.5 rounded-lg bg-[#2a2a2c] hover:bg-[#353437] text-zinc-300 hover:text-white transition-colors cursor-pointer"
                title="Descargar PDF de esta factura"
              >
                <span className="material-symbols-outlined text-[16px] text-red-400">picture_as_pdf</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectInvoice(inv);
                }}
                className="inline-flex items-center gap-1 text-white hover:text-zinc-200 text-xs transition-all cursor-pointer font-medium px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 active:scale-95"
              >
                <span>Desglose</span>
                <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
              </button>
            </div>
          </td>
        </tr>
      );
    });
  };

  return (
    <div className="w-full pt-20 bg-transparent min-h-[calc(100vh-5rem)]">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 flex flex-col gap-6">
        
        {/* Header Section with Multiformat Exports */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Historial & Conciliación</h1>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1">
              Organización de facturas por Workspaces de proyectos, jornadas diarias y exportación multiformato
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportPdf}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold transition-all shadow-md cursor-pointer border border-dashed border-[#444748]/60 hover:border-zinc-300"
              title="Descargar informe oficial en formato PDF"
            >
              <span className="material-symbols-outlined text-[18px] text-red-400">picture_as_pdf</span>
              <span>Exportar PDF</span>
            </button>

            <a
              href={getExportZipUrl({
                search,
                status: statusFilter,
                date: activeCategory === 'daily' && activeDailyDate !== 'all' ? activeDailyDate : undefined,
                workspace_id: activeCategory === 'custom' && selectedCustomWsId !== 'all' ? selectedCustomWsId : undefined
              })}
              download="SplitLedger_Dossier_Contable.zip"
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-semibold transition-all shadow-md cursor-pointer border border-dashed border-[#444748]/60 hover:border-zinc-400"
            >
              <span className="material-symbols-outlined text-[18px] text-amber-400">folder_zip</span>
              <span>Exportar ZIP</span>
            </a>

            <a
              href={getExportCsvUrl()}
              download="SplitLedger_Export_Facturas.csv"
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white text-zinc-950 hover:bg-zinc-200 text-xs font-semibold transition-all shadow-md cursor-pointer border border-dashed border-zinc-300"
            >
              <span className="material-symbols-outlined text-[18px]">download_for_offline</span>
              <span>Exportar CSV</span>
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
              <span className="text-[11px] text-[#c4c7c8]">Facturas registradas</span>
              <span className="text-sm sm:text-base font-semibold text-white">
                {invoices.length} documentos
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[#1c1b1d]/80 border border-dashed border-[#444748]/35 transition-colors hover:bg-[#201f22]">
            <div className="w-8 h-8 rounded flex items-center justify-center bg-[#353437] text-white">
              <span className="material-symbols-outlined text-[18px]">workspaces</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] text-[#c4c7c8]">Workspaces Activos</span>
              <span className="text-sm sm:text-base font-semibold text-white">
                {customWorkspaces.length} proyectos
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[#1c1b1d]/80 border border-dashed border-[#444748]/35 transition-colors hover:bg-[#201f22]">
            <div className="w-8 h-8 rounded flex items-center justify-center bg-[#353437] text-white">
              <span className="material-symbols-outlined text-[18px]">calendar_view_week</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] text-[#c4c7c8]">Jornadas de Trabajo</span>
              <span className="text-sm sm:text-base font-semibold text-white">
                {dailyWorkspaces.length} días registrados
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[#1c1b1d]/80 border border-dashed border-[#444748]/35 transition-colors hover:bg-[#201f22]">
            <div className="w-8 h-8 rounded flex items-center justify-center bg-[#353437] text-white">
              <span className="material-symbols-outlined text-[18px]">payments</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] text-[#c4c7c8]">Volumen total auditado</span>
              <span className="text-sm sm:text-base font-semibold text-white">
                {invoices.reduce((acc, i) => acc + (i.grand_total || 0), 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
              </span>
            </div>
          </div>
        </div>

        {/* WORKSPACES SELECTOR & PARTITION BAR */}
        <div className="flex flex-col gap-3 p-3 sm:p-4 rounded-xl bg-[#1c1b1d]/90 backdrop-blur-md border border-dashed border-[#444748]/60 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-dashed border-[#444748]/40">
            {/* Category Toggle: Custom Projects vs Daily Batches */}
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-white text-[20px]">workspaces</span>
              <div className="flex items-center p-0.5 rounded-lg bg-[#0e0e10] border border-dashed border-[#444748]/40 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveCategory('custom')}
                  className={`px-3 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                    activeCategory === 'custom'
                      ? 'bg-[#353437] text-white font-medium shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">folder_special</span>
                  <span>Workspaces de Proyecto ({customWorkspaces.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveCategory('daily')}
                  className={`px-3 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                    activeCategory === 'daily'
                      ? 'bg-[#353437] text-white font-medium shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">calendar_month</span>
                  <span>Jornadas Diarias ({dailyWorkspaces.length})</span>
                </button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              {activeCategory === 'custom' && (
                <button
                  type="button"
                  onClick={() => setIsCreatingWs(!isCreatingWs)}
                  className="px-2.5 py-1 rounded-lg bg-white text-zinc-950 hover:bg-zinc-200 text-xs font-semibold transition-all shadow-sm cursor-pointer flex items-center gap-1 active:scale-95"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  <span>Nuevo Workspace</span>
                </button>
              )}

              {activeCategory === 'daily' && (
                <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[#0e0e10] border border-dashed border-[#444748]/40 text-xs">
                  <button
                    type="button"
                    onClick={() => setViewMode('tabs')}
                    className={`px-2 py-0.8 rounded-md transition-colors cursor-pointer flex items-center gap-1 ${
                      viewMode === 'tabs' ? 'bg-[#353437] text-white font-medium' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <span>Pestañas</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('grouped')}
                    className={`px-2 py-0.8 rounded-md transition-colors cursor-pointer flex items-center gap-1 ${
                      viewMode === 'grouped' ? 'bg-[#353437] text-white font-medium' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <span>Agrupado</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Inline Workspace Creator Card */}
          {isCreatingWs && activeCategory === 'custom' && (
            <form
              onSubmit={handleCreateWorkspaceSubmit}
              className="p-3.5 rounded-xl bg-[#0e0e10]/95 border border-dashed border-zinc-600/70 flex flex-col gap-3 animate-fade-in"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white">Crear Nuevo Workspace Personalizado</span>
                <button
                  type="button"
                  onClick={() => setIsCreatingWs(false)}
                  className="text-zinc-400 hover:text-white text-xs"
                >
                  Cancelar
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">Nombre del Workspace / Proyecto:</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Auditoría Servidores AWS Q4, Campaña Fiscal 2026..."
                    value={newWsName}
                    onChange={(e) => setNewWsName(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-[#1c1b1d] border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/30"
                  />
                </div>

                <div>
                  <label className="text-[11px] text-zinc-400 block mb-1">Descripción u Objetivo (Opcional):</label>
                  <input
                    type="text"
                    placeholder="Ej. Conciliación y desgloses de hardware y cloud"
                    value={newWsDesc}
                    onChange={(e) => setNewWsDesc(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-[#1c1b1d] border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-white/30"
                  />
                </div>
              </div>

              {/* Color Selector */}
              <div className="flex items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-zinc-400">Color distintivo:</span>
                  <div className="flex items-center gap-1.5">
                    {WORKSPACE_PALETTE.map((p) => (
                      <button
                        key={p.color}
                        type="button"
                        onClick={() => setNewWsColor(p.color)}
                        className={`w-5 h-5 rounded-full border transition-transform ${
                          newWsColor === p.color ? 'scale-125 border-white ring-2 ring-white/30' : 'border-transparent opacity-70 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: p.color }}
                        title={p.label}
                      />
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingWs || !newWsName.trim()}
                  className="px-3 py-1.5 rounded-lg bg-white text-zinc-950 font-semibold text-xs hover:bg-zinc-200 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingWs ? 'Guardando...' : 'Crear Workspace'}
                </button>
              </div>
            </form>
          )}

          {/* CATEGORY 1: CUSTOM WORKSPACES CHIPS */}
          {activeCategory === 'custom' && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 scrollbar-thin">
              {/* All Workspaces Tab */}
              <button
                onClick={() => setSelectedCustomWsId('all')}
                className={`px-3.5 py-2 rounded-xl text-xs whitespace-nowrap transition-all flex items-center gap-2 shrink-0 cursor-pointer border ${
                  selectedCustomWsId === 'all'
                    ? 'bg-white text-zinc-950 font-semibold border-white shadow-md'
                    : 'bg-[#201f22] text-zinc-300 hover:text-white hover:bg-[#2a2a2c] border-dashed border-[#444748]/50'
                }`}
              >
                <span>Todos los Proyectos</span>
                <span className={`px-1.5 py-0.2 rounded-full font-mono text-[10px] ${
                  selectedCustomWsId === 'all' ? 'bg-zinc-200 text-zinc-900' : 'bg-zinc-800 text-zinc-400'
                }`}>
                  {invoices.length}
                </span>
              </button>

              {/* Custom Workspaces List */}
              {customWorkspaces.map((ws) => {
                const isActive = selectedCustomWsId === ws.id;
                const volume = typeof ws.total_volume === 'number'
                  ? ws.total_volume
                  : parseFloat(String(ws.total_volume || 0));

                return (
                  <button
                    key={ws.id}
                    onClick={() => setSelectedCustomWsId(ws.id)}
                    className={`px-3.5 py-2 rounded-xl text-xs whitespace-nowrap transition-all flex items-center gap-2.5 shrink-0 cursor-pointer border ${
                      isActive
                        ? 'bg-white text-zinc-950 font-semibold border-white shadow-md'
                        : 'bg-[#201f22] text-zinc-300 hover:text-white hover:bg-[#2a2a2c] border-dashed border-[#444748]/50'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: ws.color || '#ffffff' }}
                    />
                    <span>{ws.name}</span>
                    <span className={`px-1.5 py-0.2 rounded-full font-mono text-[10px] ${
                      isActive ? 'bg-zinc-200 text-zinc-900' : 'bg-zinc-800 text-zinc-400'
                    }`}>
                      {ws.invoices_count ?? 0}
                    </span>
                    <span className={`text-[11px] font-mono hidden md:inline ${
                      isActive ? 'text-zinc-700 font-medium' : 'text-zinc-400'
                    }`}>
                      {volume.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €
                    </span>
                  </button>
                );
              })}

              {/* Unassigned Bucket Tab */}
              <button
                onClick={() => setSelectedCustomWsId('unassigned')}
                className={`px-3 py-2 rounded-xl text-xs whitespace-nowrap transition-all flex items-center gap-2 shrink-0 cursor-pointer border ${
                  selectedCustomWsId === 'unassigned'
                    ? 'bg-white text-zinc-950 font-semibold border-white shadow-md'
                    : 'bg-[#201f22] text-zinc-400 hover:text-white hover:bg-[#2a2a2c] border-dashed border-[#444748]/40'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]">inbox</span>
                <span>Bandeja General (Sin asignar)</span>
                <span className={`px-1.5 py-0.2 rounded-full font-mono text-[10px] ${
                  selectedCustomWsId === 'unassigned' ? 'bg-zinc-200 text-zinc-900' : 'bg-zinc-800 text-zinc-400'
                }`}>
                  {unassignedStats.count}
                </span>
              </button>
            </div>
          )}

          {/* CATEGORY 2: DAILY WORKSPACES CHIPS */}
          {activeCategory === 'daily' && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 scrollbar-thin">
              <button
                onClick={() => setActiveDailyDate('all')}
                className={`px-3.5 py-2 rounded-xl text-xs whitespace-nowrap transition-all flex items-center gap-2 shrink-0 cursor-pointer border ${
                  activeDailyDate === 'all'
                    ? 'bg-white text-zinc-950 font-semibold border-white shadow-md'
                    : 'bg-[#201f22] text-zinc-300 hover:text-white hover:bg-[#2a2a2c] border-dashed border-[#444748]/50'
                }`}
              >
                <span>Todas las Jornadas</span>
                <span className={`px-1.5 py-0.2 rounded-full font-mono text-[10px] ${
                  activeDailyDate === 'all' ? 'bg-zinc-200 text-zinc-900' : 'bg-zinc-800 text-zinc-400'
                }`}>
                  {invoices.length}
                </span>
              </button>

              {dailyWorkspaces.map((ws) => {
                const isActive = activeDailyDate === ws.dateKey;
                return (
                  <button
                    key={ws.dateKey}
                    onClick={() => setActiveDailyDate(ws.dateKey)}
                    className={`px-3.5 py-2 rounded-xl text-xs whitespace-nowrap transition-all flex items-center gap-2.5 shrink-0 cursor-pointer border ${
                      isActive
                        ? 'bg-white text-zinc-950 font-semibold border-white shadow-md'
                        : 'bg-[#201f22] text-zinc-300 hover:text-white hover:bg-[#2a2a2c] border-dashed border-[#444748]/50'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[15px] opacity-80">calendar_today</span>
                    <span>{ws.label}</span>
                    <span className={`px-1.5 py-0.2 rounded-full font-mono text-[10px] ${
                      isActive ? 'bg-zinc-200 text-zinc-900' : 'bg-zinc-800 text-zinc-400'
                    }`}>
                      {ws.invoices.length}
                    </span>
                    <span className={`text-[11px] font-mono hidden md:inline ${
                      isActive ? 'text-zinc-700 font-medium' : 'text-zinc-400'
                    }`}>
                      {ws.totalVolume.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Active Workspace Focus Banner (Custom Workspace Selected) */}
          {activeCategory === 'custom' && currentCustomWorkspace && (
            <div className="mt-1 p-3 rounded-xl bg-[#0e0e10]/90 border border-dashed border-zinc-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border border-white/20 shadow-sm"
                  style={{ backgroundColor: `${currentCustomWorkspace.color || '#ffffff'}20`, color: currentCustomWorkspace.color || '#ffffff' }}
                >
                  <span className="material-symbols-outlined text-[20px]">folder_special</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-white tracking-tight">
                      Workspace: {currentCustomWorkspace.name}
                    </h3>
                    <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 text-[10px] font-mono">
                      {filteredInvoices.length} facturas vinculadas
                    </span>
                  </div>
                  {currentCustomWorkspace.description && (
                    <p className="text-xs text-zinc-400 font-sans mt-0.5">
                      {currentCustomWorkspace.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Workspace Dedicated Export & Delete Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => exportWorkspacePdf({
                    workspaceTitle: `Workspace: ${currentCustomWorkspace.name}`,
                    dateLabel: `Proyecto Contable (${filteredInvoices.length} docs)`,
                    invoices: filteredInvoices
                  })}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium border border-dashed border-zinc-600 transition-colors cursor-pointer"
                  title="Exportar informe PDF de este workspace"
                >
                  <span className="material-symbols-outlined text-[15px] text-red-400">picture_as_pdf</span>
                  <span>Exportar (PDF)</span>
                </button>

                <a
                  href={getExportZipUrl({ workspace_id: currentCustomWorkspace.id })}
                  download={`SplitLedger_${currentCustomWorkspace.slug}.zip`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium border border-dashed border-zinc-600 transition-colors cursor-pointer"
                  title="Descargar paquete ZIP de este workspace"
                >
                  <span className="material-symbols-outlined text-[15px] text-amber-400">folder_zip</span>
                  <span>Exportar (ZIP)</span>
                </a>

                <button
                  type="button"
                  onClick={() => handleDeleteWorkspace(currentCustomWorkspace.id, currentCustomWorkspace.name)}
                  className="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 border border-dashed border-red-800/40 text-red-300 transition-colors cursor-pointer"
                  title="Eliminar este workspace"
                >
                  <span className="material-symbols-outlined text-[16px]">delete</span>
                </button>
              </div>
            </div>
          )}

          {/* Active Workspace Focus Banner (Daily Workspace Selected in Tabs Mode) */}
          {activeCategory === 'daily' && currentDailyWorkspace && viewMode === 'tabs' && (
            <div className="mt-1 p-3 rounded-xl bg-[#0e0e10]/90 border border-dashed border-zinc-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#2a2a2c] border border-dashed border-[#444748] flex items-center justify-center text-white shrink-0">
                  <span className="material-symbols-outlined text-[20px]">calendar_month</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-white tracking-tight">
                      Jornada: {currentDailyWorkspace.fullDateLabel}
                    </h3>
                    <span className="px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/40 text-emerald-300 text-[10px] font-mono">
                      {currentDailyWorkspace.reconciledCount} / {currentDailyWorkspace.invoices.length} Conciliadas
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 font-mono mt-0.5">
                    Volumen de la jornada: {currentDailyWorkspace.totalVolume.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => exportWorkspacePdf({
                    workspaceTitle: `Jornada: ${currentDailyWorkspace.label}`,
                    dateLabel: currentDailyWorkspace.fullDateLabel,
                    invoices: currentDailyWorkspace.invoices
                  })}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium border border-dashed border-zinc-600 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px] text-red-400">picture_as_pdf</span>
                  <span>Exportar Día (PDF)</span>
                </button>

                <a
                  href={getExportZipUrl({ date: currentDailyWorkspace.dateKey })}
                  download={`SplitLedger_Workspace_${currentDailyWorkspace.dateKey}.zip`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium border border-dashed border-zinc-600 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px] text-amber-400">folder_zip</span>
                  <span>Exportar Día (ZIP)</span>
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Search, Filter & Bulk Assign Controls */}
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
              className="w-full pl-10 pr-12 py-2 bg-[#353437] rounded-lg text-xs sm:text-sm text-white placeholder-[#c4c7c8] focus:outline-none focus:ring-1 focus:ring-white transition-all font-sans"
            />
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#201f22] border border-dashed border-[#444748]/40 text-[#c4c7c8] text-[10px] font-mono">
              <span>⌘F</span>
            </div>
          </div>

          {/* Filters & Selection Actions */}
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
              <div className="flex items-center gap-2 flex-wrap">
                {/* Assign to Workspace Button */}
                <button
                  type="button"
                  onClick={() => setShowAssignModal(true)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-800 border border-dashed border-zinc-600 text-white text-xs hover:bg-zinc-700 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px] text-sky-400">drive_file_move</span>
                  <span>Mover a Workspace ({selectedIds.length})</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportSelectedPdf}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-800 border border-dashed border-zinc-600 text-white text-xs hover:bg-zinc-700 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px] text-red-400">picture_as_pdf</span>
                  <span>Exportar PDF</span>
                </button>

                <a
                  href={getExportZipUrl({ ids: selectedIds })}
                  download={`SplitLedger_Seleccion_${selectedIds.length}_Facturas.zip`}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-800 border border-dashed border-zinc-600 text-zinc-100 text-xs hover:bg-zinc-700 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px] text-amber-400">folder_zip</span>
                  <span>ZIP</span>
                </a>

                <button
                  onClick={handleDeleteSelected}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-950/60 border border-dashed border-red-800/50 text-red-300 text-xs hover:bg-red-900/60 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">delete</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* BULK ASSIGN MODAL */}
        {showAssignModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-md bg-[#1c1b1d] border border-dashed border-[#444748] rounded-2xl p-5 shadow-2xl flex flex-col gap-4">
              <div className="flex items-center justify-between pb-2 border-b border-dashed border-[#444748]/50">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-white text-[20px]">drive_file_move</span>
                  <h3 className="text-sm font-semibold text-white">Mover {selectedIds.length} Facturas a Workspace</h3>
                </div>
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="text-zinc-400 hover:text-white"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                <label className="text-xs text-zinc-400 block mb-1">Selecciona el workspace de destino:</label>

                {/* Option: Unassign */}
                <div
                  onClick={() => setAssignTargetWsId('unassign')}
                  className={`p-2.5 rounded-xl border cursor-pointer flex items-center justify-between transition-colors ${
                    assignTargetWsId === 'unassign' ? 'bg-[#353437] border-white text-white' : 'bg-[#201f22] border-white/5 text-zinc-300 hover:bg-[#2a2a2c]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-zinc-400">inbox</span>
                    <span className="text-xs font-medium">Bandeja General (Desvincular)</span>
                  </div>
                  {assignTargetWsId === 'unassign' && <span className="material-symbols-outlined text-[16px] text-white">check</span>}
                </div>

                {/* Options: Custom Workspaces */}
                {customWorkspaces.map((ws) => (
                  <div
                    key={ws.id}
                    onClick={() => setAssignTargetWsId(ws.id)}
                    className={`p-2.5 rounded-xl border cursor-pointer flex items-center justify-between transition-colors ${
                      assignTargetWsId === ws.id ? 'bg-[#353437] border-white text-white' : 'bg-[#201f22] border-white/5 text-zinc-300 hover:bg-[#2a2a2c]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ws.color || '#ffffff' }} />
                      <span className="text-xs font-medium">{ws.name}</span>
                    </div>
                    {assignTargetWsId === ws.id && <span className="material-symbols-outlined text-[16px] text-white">check</span>}
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-dashed border-[#444748]/50">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleAssignInvoicesSubmit}
                  className="px-4 py-1.5 rounded-lg bg-white text-zinc-950 font-semibold text-xs hover:bg-zinc-200"
                >
                  Confirmar Asignación
                </button>
              </div>
            </div>
          </div>
        )}

        {/* WORKSPACES DISPLAY */}
        {activeCategory === 'daily' && viewMode === 'grouped' ? (
          /* GROUPED WORKSPACES ACCORDION VIEW */
          <div className="flex flex-col gap-5">
            {dailyWorkspaces.map((ws) => {
              const isCollapsed = !!collapsedDays[ws.dateKey];
              const wsInvoices = ws.invoices.filter((inv) => {
                const term = search.toLowerCase().trim();
                const matchesSearch =
                  !term ||
                  inv.supplier_name?.toLowerCase().includes(term) ||
                  inv.invoice_number?.toLowerCase().includes(term) ||
                  inv.supplier_tax_id?.toLowerCase().includes(term);

                const matchesStatus =
                  statusFilter === 'Todas' ||
                  (statusFilter === 'Desglosadas' && (inv.status === 'analyzed' || inv.status === 'reconciled')) ||
                  (statusFilter === 'En Proceso' && (inv.status === 'processing' || inv.status === 'pending'));

                return matchesSearch && matchesStatus;
              });

              if (wsInvoices.length === 0 && (search || statusFilter !== 'Todas')) {
                return null;
              }

              return (
                <div
                  key={ws.dateKey}
                  className="w-full rounded-xl bg-[#0e0e10]/90 backdrop-blur-md border border-dashed border-[#444748]/60 overflow-hidden shadow-lg transition-all"
                >
                  <div
                    onClick={() => toggleDayCollapse(ws.dateKey)}
                    className="p-4 bg-[#1c1b1d]/90 hover:bg-[#201f22] border-b border-dashed border-[#444748]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-[#353437] flex items-center justify-center text-white shrink-0 border border-dashed border-[#444748]/60">
                        <span className="material-symbols-outlined text-[18px]">calendar_today</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-white tracking-tight">
                            Jornada: {ws.fullDateLabel}
                          </h3>
                          <span className="px-2 py-0.5 rounded-full bg-[#2a2a2c] border border-dashed border-[#444748]/50 text-zinc-300 text-[10px] font-mono">
                            {wsInvoices.length} facturas
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 font-mono mt-0.5">
                          Total Jornada: {ws.totalVolume.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => exportWorkspacePdf({
                          workspaceTitle: `Jornada: ${ws.label}`,
                          dateLabel: ws.fullDateLabel,
                          invoices: wsInvoices
                        })}
                        className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium border border-dashed border-zinc-600 transition-colors flex items-center gap-1.5 cursor-pointer"
                        title="Exportar PDF de este workspace diario"
                      >
                        <span className="material-symbols-outlined text-[15px] text-red-400">picture_as_pdf</span>
                        <span className="hidden md:inline">PDF</span>
                      </button>

                      <a
                        href={getExportZipUrl({ date: ws.dateKey })}
                        download={`SplitLedger_Workspace_${ws.dateKey}.zip`}
                        className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-medium border border-dashed border-zinc-600 transition-colors flex items-center gap-1.5 cursor-pointer"
                        title="Exportar ZIP de este workspace diario"
                      >
                        <span className="material-symbols-outlined text-[15px] text-amber-400">folder_zip</span>
                        <span className="hidden md:inline">ZIP</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => toggleDayCollapse(ws.dateKey)}
                        className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                        title={isCollapsed ? 'Desplegar facturas' : 'Plegar facturas'}
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          {isCollapsed ? 'expand_more' : 'expand_less'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {!isCollapsed && (
                    <div className="overflow-x-auto w-full">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-[#18181b] text-zinc-400 text-[10.5px] uppercase tracking-wider select-none border-b border-dashed border-[#444748]/30">
                            <th className="w-10 px-4 py-2.5 text-center" scope="col">
                              <span className="text-[10px]">#</span>
                            </th>
                            <th className="px-4 py-2.5 font-medium">Nº Factura</th>
                            <th className="px-4 py-2.5 font-medium">Proveedor</th>
                            <th className="px-4 py-2.5 font-medium">Fecha Doc</th>
                            <th className="px-4 py-2.5 font-medium text-center">Partidas</th>
                            <th className="px-4 py-2.5 font-medium text-right">Base Imponible</th>
                            <th className="px-4 py-2.5 font-medium text-right">Impuestos</th>
                            <th className="px-4 py-2.5 font-medium text-right">Total Factura</th>
                            <th className="px-4 py-2.5 font-medium text-center">Estado</th>
                            <th className="px-4 py-2.5 font-medium text-right">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-dashed divide-[#2a2a2c]/70 text-xs text-zinc-200">
                          {renderTableRows(wsInvoices)}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* STANDARD TABBED VIEW FOR EITHER CUSTOM OR DAILY */
          <div className="w-full rounded-xl bg-[#0e0e10]/85 backdrop-blur-md border border-dashed border-[#444748]/50 overflow-hidden shadow-xl">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#1c1b1d] text-zinc-400 text-[11px] uppercase tracking-wider select-none border-b border-dashed border-[#444748]/40">
                    <th className="w-10 px-4 py-3 text-center" scope="col">
                      <input
                        type="checkbox"
                        checked={filteredInvoices.length > 0 && selectedIds.length === filteredInvoices.length}
                        onChange={handleSelectAll}
                        className="w-4 h-4 rounded bg-[#353437] accent-white cursor-pointer"
                      />
                    </th>
                    <th className="px-4 py-3 font-medium">Nº Factura</th>
                    <th className="px-4 py-3 font-medium">Proveedor / Emisor</th>
                    <th className="px-4 py-3 font-medium">Fecha Doc</th>
                    <th className="px-4 py-3 font-medium text-center">Partidas</th>
                    <th className="px-4 py-3 font-medium text-right">Base Imponible</th>
                    <th className="px-4 py-3 font-medium text-right">Impuestos</th>
                    <th className="px-4 py-3 font-medium text-right">Total Factura</th>
                    <th className="px-4 py-3 font-medium text-center">Estado</th>
                    <th className="px-4 py-3 font-medium text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dashed divide-[#2a2a2c]/80 text-xs text-zinc-200">
                  {renderTableRows(filteredInvoices)}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
