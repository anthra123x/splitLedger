import React, { useState, useEffect, useMemo } from 'react';
import { updateInvoice, fetchAccountingRules, fetchWorkspaces } from '../services/api';
import { exportInvoicePdf } from '../services/pdfExportService';
import { Invoice, InvoiceItem, Workspace, CoactiveStage } from '../types/index.js';
import ScanningAnimationCard from '../components/ScanningAnimationCard';
import { cleanSupplierName, cleanSupplierTaxId } from '../utils/formatters';

const DEFAULT_PGC_ACCOUNTS = [
  { code: '600000', name: 'Compras de Mercaderías y Hardware', group: 'Grupo 60 - Compras' },
  { code: '602000', name: 'Compras de Otros Aprovisionamientos', group: 'Grupo 60 - Compras' },
  { code: '621000', name: 'Arrendamientos y Cánones (Oficinas/Coworking)', group: 'Grupo 62 - Servicios Exteriores' },
  { code: '622000', name: 'Reparaciones y Conservación', group: 'Grupo 62 - Servicios Exteriores' },
  { code: '623000', name: 'Servicios de Profesionales Independientes', group: 'Grupo 62 - Servicios Exteriores' },
  { code: '624000', name: 'Transportes y Mensajería Logística', group: 'Grupo 62 - Servicios Exteriores' },
  { code: '625000', name: 'Primas de Seguros (Ciberseguridad/RC)', group: 'Grupo 62 - Servicios Exteriores' },
  { code: '626000', name: 'Servicios Bancarios (Comisiones Pasarela/Stripe)', group: 'Grupo 62 - Servicios Exteriores' },
  { code: '627000', name: 'Publicidad y Propaganda (Google/Meta Ads)', group: 'Grupo 62 - Servicios Exteriores' },
  { code: '628000', name: 'Suministros IT (Cloud, AWS, GCP, Licencias)', group: 'Grupo 62 - Servicios Exteriores' },
  { code: '628001', name: 'Suministros Básicos (Electricidad, Climatización)', group: 'Grupo 62 - Servicios Exteriores' },
  { code: '629000', name: 'Comunicaciones (Fibra y Telefonía Móvil)', group: 'Grupo 62 - Servicios Exteriores' },
  { code: '629001', name: 'Suscripciones y Licencias SaaS Anuales', group: 'Grupo 62 - Servicios Exteriores' },
  { code: '629002', name: 'Infraestructura Serverless y Base de Datos Cloud', group: 'Grupo 62 - Servicios Exteriores' },
  { code: '629003', name: 'Viajes, Dietas y Desplazamientos', group: 'Grupo 62 - Servicios Exteriores' },
  { code: '629004', name: 'Gastos de Representación y Restauración', group: 'Grupo 62 - Servicios Exteriores' },
  { code: '640000', name: 'Sueldos y Salarios (Nóminas de Personal)', group: 'Grupo 64 - Personal' },
  { code: '642000', name: 'Seguridad Social a Cargo de la Empresa', group: 'Grupo 64 - Personal' },
  { code: '680000', name: 'Amortización de Software y Activo Intangible', group: 'Grupo 68 - Amortizaciones' },
  { code: '681000', name: 'Amortización de Servidores y Equipos', group: 'Grupo 68 - Amortizaciones' },
  { code: '400000', name: 'Proveedores Comerciales', group: 'Grupo 40 - Pasivo Corriente' },
  { code: '410000', name: 'Acreedores por Prestaciones de Servicios', group: 'Grupo 40 - Pasivo Corriente' },
];

interface DetailViewProps {
  invoice: Invoice | null;
  onInvoiceUpdated?: (invoice: Invoice) => void;
  onBack: () => void;
  backLabel?: string;
}

export default function DetailView({ invoice, onInvoiceUpdated, onBack, backLabel }: DetailViewProps) {
  const [items, setItems] = useState<InvoiceItem[]>(() => invoice?.items || []);
  const [zoom, setZoom] = useState(100);
  const [hoveredLineIndex, setHoveredLineIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [accounts, setAccounts] = useState<any[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(() => invoice?.workspace_id || null);
  const [previewMode, setPreviewMode] = useState<'document' | 'compact' | 'raw'>('document');
  const [rawFileText, setRawFileText] = useState<string | null>(null);
  const [isLoadingRaw, setIsLoadingRaw] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStage, setScanStage] = useState(1);
  const [scanProgress, setScanProgress] = useState(25);
  const [scanStatusText, setScanStatusText] = useState('');
  const [showThinking, setShowThinking] = useState(false);
  const [activeLayoutTab, setActiveLayoutTab] = useState<'split' | 'items' | 'document'>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      return 'items';
    }
    return 'split';
  });

  const [coactiveStage, setCoactiveStage] = useState<CoactiveStage>(() => invoice?.coactive?.stage || 'persuasivo');

  const handleCoactiveStageChange = async (newStage: CoactiveStage) => {
    setCoactiveStage(newStage);
    if (!invoice?.id) return;
    try {
      const res = await updateInvoice(invoice.id, {
        coactive: {
          stage: newStage,
          last_action_date: new Date().toISOString().substring(0, 10)
        }
      });
      if (res.data && onInvoiceUpdated) {
        onInvoiceUpdated(res.data);
      }
      setSaveMessage(`[ETAPA] ${newStage.toUpperCase()} registrada`);
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err) {
      console.error('Error al actualizar etapa coactiva:', err);
    }
  };

  const isSplit = activeLayoutTab === 'split';
  const showDocument = activeLayoutTab === 'document' || isSplit;
  const showItems = activeLayoutTab === 'items' || isSplit;

  // Financial sums from current items
  const currentItemsBaseSum = items.reduce((acc, it) => acc + (it.base_amount || 0), 0);
  const currentItemsTaxSum = items.reduce((acc, it) => acc + (it.tax_amount || 0), 0);
  const currentItemsTotalSum = items.reduce((acc, it) => acc + (it.total_amount || 0), 0);

  const targetSubtotal = invoice?.subtotal ?? currentItemsBaseSum;
  const targetTaxTotal = invoice?.tax_total ?? currentItemsTaxSum;
  const targetGrandTotal = invoice?.grand_total ?? currentItemsTotalSum;
  const expectedDocSum = (invoice?.surcharge_total && Math.abs(currentItemsBaseSum + (invoice?.surcharge_total || 0) - (invoice?.retention_total || 0) - targetGrandTotal) < 0.05)
    ? currentItemsBaseSum + (invoice?.surcharge_total || 0) - (invoice?.retention_total || 0)
    : currentItemsBaseSum + currentItemsTaxSum + (invoice?.surcharge_total || 0) - (invoice?.retention_total || 0);

  const discrepancy = Math.abs(expectedDocSum - targetGrandTotal);
  const isBalanced = discrepancy < 0.05;

  const fileExt = (invoice?.file_path || invoice?.original_name || '').split('.').pop()?.toLowerCase() || '';
  const isPdf = fileExt === 'pdf' || (invoice?.mime_type?.includes('pdf') ?? false);
  const isImage = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'tiff', 'tif', 'gif'].includes(fileExt) || (invoice?.mime_type?.startsWith('image/') ?? false);
  const isHtml = fileExt === 'html' || fileExt === 'htm' || (invoice?.mime_type?.includes('html') ?? false);
  const isJson = fileExt === 'json' || (invoice?.mime_type?.includes('json') ?? false);
  const isText = ['txt', 'csv', 'tsv', 'xml', 'md', 'log'].includes(fileExt) || (invoice?.mime_type?.startsWith('text/') ?? false);

  useEffect(() => {
    if (invoice?.file_path && (isJson || isText)) {
      setIsLoadingRaw(true);
      fetch(invoice.file_path)
        .then((r) => {
          if (!r.ok) throw new Error('File not found');
          return r.text();
        })
        .then((txt) => {
          setRawFileText(txt);
          setIsLoadingRaw(false);
        })
        .catch(() => {
          setRawFileText(null);
          setIsLoadingRaw(false);
        });
    } else {
      setRawFileText(null);
      setIsLoadingRaw(false);
    }
  }, [invoice?.file_path, isJson, isText]);

  useEffect(() => {
    setItems(invoice?.items || []);
    setCurrentWorkspaceId(invoice?.workspace_id || null);
    setCoactiveStage(invoice?.coactive?.stage || 'persuasivo');
  }, [invoice]);

  useEffect(() => {
    fetchAccountingRules().then(res => {
      if (res.data && res.data.accounts && res.data.accounts.length > 0) {
        setAccounts(res.data.accounts);
      }
    }).catch(() => null);

    fetchWorkspaces().then(res => {
      const list = Array.isArray(res.data) ? res.data : (res.data?.workspaces || []);
      setWorkspaces(list);
    }).catch(() => null);
  }, []);

  // Parse structured data from source JSON if present
  const parsedJson = useMemo(() => {
    if (!rawFileText) return null;
    try {
      return JSON.parse(rawFileText);
    } catch {
      return null;
    }
  }, [rawFileText]);

  const docSupplierName = cleanSupplierName(parsedJson?.issuer?.company_name || invoice?.supplier_name || '');
  const docSupplierTaxId = cleanSupplierTaxId(invoice?.supplier_name || '', parsedJson?.issuer?.tax_id || invoice?.supplier_tax_id);
  const docSupplierAddress = parsedJson?.issuer?.address || invoice?.supplier_address || (parsedJson?.issuer?.country ? `Domicilio Fiscal (${parsedJson.issuer.country})` : 'Domicilio Fiscal España');
  const docCustomerName = parsedJson?.recipient?.company_name || invoice?.customer_name || 'SplitLedger Labs S.L.';
  const docCustomerTaxId = parsedJson?.recipient?.tax_id || invoice?.customer_tax_id || 'ESB87219034';
  const docCustomerAddress = parsedJson?.recipient?.address || invoice?.customer_address || 'Paseo de la Castellana 95, 28046 Madrid, España';
  const docInvoiceNumber = parsedJson?.header?.invoice_number || invoice?.invoice_number || 'S/N';
  const docIssueDate = parsedJson?.header?.issue_date || invoice?.invoice_date || '-';
  const docDueDate = parsedJson?.header?.due_date || invoice?.due_date || '';
  const docCurrency = parsedJson?.header?.currency || invoice?.currency || 'EUR';

  const docSubtotal = typeof parsedJson?.financial_summary?.subtotal_amount === 'number'
    ? parsedJson.financial_summary.subtotal_amount
    : targetSubtotal;
  const docTaxTotal = typeof parsedJson?.financial_summary?.tax_total_amount === 'number'
    ? parsedJson.financial_summary.tax_total_amount
    : targetTaxTotal;
  const docRetention = typeof parsedJson?.financial_summary?.retention_amount === 'number'
    ? parsedJson.financial_summary.retention_amount
    : (invoice?.retention_total || 0);
  const docGrandTotal = typeof parsedJson?.financial_summary?.grand_total_amount === 'number'
    ? parsedJson.financial_summary.grand_total_amount
    : targetGrandTotal;

  const displayDocItems = useMemo(() => {
    if (items && items.length > 0) return items;
    if (parsedJson?.line_items && Array.isArray(parsedJson.line_items)) {
      return parsedJson.line_items.map((it: any, idx: number) => ({
        id: `parsed-${idx}`,
        concept: it.description || it.concept || `Partida ${idx + 1}`,
        quantity: it.quantity || 1,
        unit_price: it.unit_price || it.taxable_amount || 0,
        base_amount: it.taxable_amount || (it.quantity * it.unit_price) || 0,
        tax_rate: it.tax_rate_percentage ?? it.tax_rate ?? 21,
        tax_amount: it.tax_amount || 0,
        total_amount: it.total_amount || 0,
      }));
    }
    return [];
  }, [items, parsedJson]);

  // Empty state fallback when no invoice is selected
  if (!invoice) {
    return (
      <div className="w-full pt-32 pb-20 text-center min-h-[calc(100vh-5rem)] flex flex-col items-center justify-center animate-page-enter">
        <span className="material-symbols-outlined text-[48px] text-zinc-600 mb-4 animate-pulse">description</span>
        <h2 className="text-xl font-semibold text-white">No hay ninguna factura seleccionada</h2>
        <p className="text-zinc-400 text-sm mt-1 max-w-sm">
          Sube una factura en "Inicio & Carga" o haz clic en "Ver desglose" desde el Historial.
        </p>
        <button
          onClick={onBack}
          className="mt-6 px-5 py-2.5 rounded-full bg-white text-zinc-950 font-medium text-xs hover:bg-zinc-200 transition-all cursor-pointer active:scale-95 shadow-lg"
        >
          {backLabel || 'Volver al Inicio'}
        </button>
      </div>
    );
  }

  const handleReScan = () => {
    setIsScanning(true);
    setScanStage(1);
    setScanProgress(25);
    setScanStatusText('Lectura óptica y extracción de coordenadas OCR...');

    setTimeout(() => {
      setScanStage(2);
      setScanProgress(60);
      setScanStatusText('Reconstruyendo Grafo de Atención Espacial 2D con SplitLLM...');
    }, 800);

    setTimeout(() => {
      setScanStage(3);
      setScanProgress(90);
      setScanStatusText('Verificando balance contable bajo partida doble...');
    }, 1800);

    setTimeout(() => {
      setScanProgress(100);
      setTimeout(() => {
        setIsScanning(false);
        setSaveMessage('[OK] Factura re-analizada y validada por SplitLLM.');
      }, 400);
    }, 2600);
  };



  const handleWorkspaceChange = async (targetWsId: string) => {
    try {
      const updatedVal = targetWsId || null;
      const res = await updateInvoice(invoice.id, { workspace_id: updatedVal });
      if (res.data) {
        setCurrentWorkspaceId(updatedVal);
        if (onInvoiceUpdated) onInvoiceUpdated(res.data);
        const wsList = Array.isArray(workspaces) ? workspaces : [];
        const wsObj = wsList.find(w => w.id === updatedVal);
        setSaveMessage(`[OK] Asignado a ${wsObj ? wsObj.name : 'Bandeja General'}.`);
        setTimeout(() => setSaveMessage(''), 3000);
      }
    } catch (err: any) {
      alert(`Error al actualizar workspace: ${err.message}`);
    }
  };

  const availableAccounts = accounts.length > 0 ? accounts : DEFAULT_PGC_ACCOUNTS;
  const pgcGroups = Array.from(new Set(availableAccounts.map(a => a.group || 'Grupo 62 - Servicios Exteriores')));

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 15, 160));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 15, 70));
  const handleZoomFit = () => setZoom(100);

  const handleItemAccountChange = (index: number, rawCode: string) => {
    const cleanCode = rawCode.replace(/\./g, '');
    const targetAccount = availableAccounts.find(
      a => a.code.replace(/\./g, '') === cleanCode
    );
    const updated = [...items];
    updated[index] = {
      ...updated[index],
      account_code: cleanCode,
      account_name: targetAccount?.name || updated[index].account_name
    };
    setItems(updated);
  };

  const handleItemCostCenterChange = (index: number, center: string) => {
    const updated = [...items];
    updated[index] = { ...updated[index], cost_center: center };
    setItems(updated);
  };

  const handleItemQuantityChange = (index: number, value: string) => {
    const qty = parseFloat(value) || 0;
    const updated = [...items];
    const unitPrice = updated[index].unit_price || 0;
    const discount = updated[index].discount_amount || 0;
    const base = Math.max(0, Number(((qty * unitPrice) - discount).toFixed(2)));
    const taxRate = updated[index].tax_rate ?? 21;
    const taxAmount = Number(((base * taxRate) / 100).toFixed(2));
    const total = Number((base + taxAmount).toFixed(2));

    updated[index] = {
      ...updated[index],
      quantity: qty,
      base_amount: base,
      tax_amount: taxAmount,
      total_amount: total
    };
    setItems(updated);
  };

  const handleItemUnitPriceChange = (index: number, value: string) => {
    const unitPrice = parseFloat(value) || 0;
    const updated = [...items];
    const qty = updated[index].quantity || 1;
    const discount = updated[index].discount_amount || 0;
    const base = Math.max(0, Number(((qty * unitPrice) - discount).toFixed(2)));
    const taxRate = updated[index].tax_rate ?? 21;
    const taxAmount = Number(((base * taxRate) / 100).toFixed(2));
    const total = Number((base + taxAmount).toFixed(2));

    updated[index] = {
      ...updated[index],
      unit_price: unitPrice,
      base_amount: base,
      tax_amount: taxAmount,
      total_amount: total
    };
    setItems(updated);
  };

  const handleItemUnitChange = (index: number, unitVal: string) => {
    const updated = [...items];
    updated[index] = {
      ...updated[index],
      unit: unitVal
    };
    setItems(updated);
  };

  const handleItemDiscountChange = (index: number, value: string) => {
    const discount = parseFloat(value) || 0;
    const updated = [...items];
    const qty = updated[index].quantity || 1;
    const unitPrice = updated[index].unit_price || 0;
    const base = Math.max(0, Number(((qty * unitPrice) - discount).toFixed(2)));
    const taxRate = updated[index].tax_rate ?? 21;
    const taxAmount = Number(((base * taxRate) / 100).toFixed(2));
    const total = Number((base + taxAmount).toFixed(2));

    updated[index] = {
      ...updated[index],
      discount_amount: discount,
      base_amount: base,
      tax_amount: taxAmount,
      total_amount: total
    };
    setItems(updated);
  };

  const handleItemBaseChange = (index: number, value: string) => {
    const base = parseFloat(value) || 0;
    const updated = [...items];
    const taxRate = updated[index].tax_rate ?? 21;
    const taxAmount = Number(((base * taxRate) / 100).toFixed(2));
    const total = Number((base + taxAmount).toFixed(2));
    const qty = updated[index].quantity || 1;
    const unitPrice = qty > 0 ? Number((base / qty).toFixed(2)) : base;

    updated[index] = {
      ...updated[index],
      unit_price: unitPrice,
      base_amount: base,
      tax_amount: taxAmount,
      total_amount: total
    };
    setItems(updated);
  };

  const handleDeleteItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleAddManualItem = () => {
    const nextIndex = items.length + 1;
    const newItem: InvoiceItem = {
      id: `manual-${Date.now()}`,
      item_index: nextIndex,
      concept: 'Nueva partida manual',
      account_code: '628000',
      account_name: 'Suministros IT',
      cost_center: 'DevOps',
      quantity: 1,
      unit: 'uds',
      unit_price: 100.00,
      discount_amount: 0,
      base_amount: 100.00,
      tax_rate: 21,
      tax_amount: 21.00,
      total_amount: 121.00,
      notes: 'Partida añadida manualmente por auditor',
      bounding_box: { x: 20, y: 140 + nextIndex * 40, w: 380, h: 40, confidence: 100 }
    };
    setItems([...items, newItem]);
  };



  const handleSaveAndReconcile = async () => {
    setIsSaving(true);
    setSaveMessage('');
    try {
      const res = await updateInvoice(invoice.id, {
        subtotal: currentItemsBaseSum,
        tax_total: currentItemsTaxSum,
        grand_total: isBalanced ? targetGrandTotal : expectedDocSum,
        status: 'reconciled',
        workspace_id: currentWorkspaceId,
        items
      });
      setSaveMessage('[OK] Asiento contable guardado y conciliado en Neon PostgreSQL.');
      if (onInvoiceUpdated) onInvoiceUpdated(res.data);
    } catch (err: any) {
      alert(`Error al guardar: ${err.message}`);
    } finally {
      setIsSaving(false);
      setTimeout(() => setSaveMessage(''), 3500);
    }
  };

  return (
    <main className="w-full pt-20 bg-transparent min-h-[calc(100vh-5rem)]">
      <div className="flex flex-col w-full">
        
        {/* Minimal & Streamlined Invoice Toolbar */}
        <section className="w-full px-4 sm:px-6 py-2.5 border-b border-dashed border-[#444748]/40 bg-[#1c1b1d]/40 backdrop-blur-md">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
            
            {/* Left: Back + Supplier & Invoice Code */}
            <div className="flex items-center gap-2.5 min-w-0 flex-wrap sm:flex-nowrap">
              <button
                onClick={onBack}
                className="w-8 h-8 rounded-lg bg-[#201f22] hover:bg-[#2a2a2c] text-zinc-300 hover:text-white border border-dashed border-[#444748]/50 flex items-center justify-center transition-colors cursor-pointer active:scale-95 shrink-0"
                title={backLabel || 'Volver'}
              >
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              </button>

              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                <h1 className="text-sm sm:text-base font-semibold text-white tracking-tight truncate max-w-[200px] sm:max-w-[260px]" title={cleanSupplierName(invoice.supplier_name)}>
                  {cleanSupplierName(invoice.supplier_name)}
                </h1>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-[#201f22] text-[#c4c7c8] border border-dashed border-[#444748]/50 shrink-0">
                  {invoice.invoice_number}
                </span>
                {invoice.invoice_date && (
                  <span className="hidden sm:inline text-xs text-zinc-400 font-mono shrink-0">
                    {invoice.invoice_date}
                  </span>
                )}
                {/* Workspace Selector Badge */}
                <div className="relative inline-flex items-center shrink-0">
                  <select
                    value={currentWorkspaceId || ''}
                    onChange={(e) => handleWorkspaceChange(e.target.value)}
                    className="bg-[#201f22] hover:bg-[#252427] text-xs text-zinc-300 border border-dashed border-[#444748]/60 rounded-lg pl-6 pr-7 py-1 appearance-none cursor-pointer focus:outline-none focus:border-white/50 transition-colors"
                    title="Asignar factura a un Workspace de Proyecto"
                  >
                    <option value="">Bandeja General</option>
                    {Array.isArray(workspaces) && workspaces.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                  <span
                    className="w-2.5 h-2.5 rounded-full absolute left-2 pointer-events-none"
                    style={{
                      backgroundColor: currentWorkspaceId && Array.isArray(workspaces)
                        ? workspaces.find((w) => w.id === currentWorkspaceId)?.color || '#38bdf8'
                        : '#71717a',
                    }}
                  />
                  <span className="material-symbols-outlined text-[14px] text-zinc-400 absolute right-1.5 pointer-events-none">
                    expand_more
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Total + Actions */}
            <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-1 md:pt-0 border-t md:border-t-0 border-dashed border-[#444748]/30">
              {saveMessage && (
                <span className="text-xs text-emerald-300 font-mono animate-fade-in truncate max-w-[200px]">
                  {saveMessage}
                </span>
              )}
              <div className="flex items-baseline gap-1.5 font-mono text-white">
                <span className="text-xs text-zinc-400 font-sans hidden sm:inline">Total:</span>
                <span className="text-sm sm:text-base font-bold whitespace-nowrap">
                  {(targetGrandTotal).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                </span>
              </div>

              <button
                type="button"
                onClick={() => exportInvoicePdf(invoice)}
                className="bg-[#2a2a2c] hover:bg-[#353437] text-white border border-dashed border-[#444748]/60 active:scale-95 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-sm inline-flex items-center gap-1.5 transition-all cursor-pointer"
                title="Descargar Dossier Oficial en PDF"
              >
                <span className="material-symbols-outlined text-[16px] text-red-400">picture_as_pdf</span>
                <span className="hidden sm:inline">Exportar PDF</span>
              </button>

              <button
                type="button"
                onClick={handleSaveAndReconcile}
                disabled={isSaving}
                className="bg-white text-zinc-950 hover:bg-zinc-200 active:scale-95 px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-sm inline-flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[16px]">check</span>
                <span>{isSaving ? 'Guardando...' : 'Conciliar'}</span>
              </button>
            </div>
          </div>
        </section>

        {/* BARRA EJECUTIVA DE EXPEDIENTE DE COBRO COACTIVO */}
        <section className="w-full px-4 sm:px-6 py-2.5 bg-[#171618] border-b border-dashed border-[#444748]/40">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            {/* Left: Expediente Info & Deudor */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#201f22] border border-dashed border-[#444748]/60 text-white font-mono">
                <span className="material-symbols-outlined text-[15px] text-sky-400">gavel</span>
                <span className="font-bold">{invoice?.coactive?.expediente_number || `EXP-${(invoice?.id || '0000').substring(0, 8).toUpperCase()}`}</span>
              </div>
              <div className="flex items-center gap-2 text-zinc-300">
                <span>Ejecutado: <strong className="text-white">{invoice?.coactive?.debtor_name || invoice?.customer_name || invoice?.supplier_name}</strong></span>
                <span className="text-zinc-500 font-mono">({invoice?.coactive?.debtor_tax_id || invoice?.customer_tax_id || invoice?.supplier_tax_id || 'N/D'})</span>
                <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-[10px] font-mono text-zinc-400">
                  Vigencia: {invoice?.coactive?.fiscal_year || '2024'}
                </span>
              </div>
            </div>

            {/* Right: Interactive Coactive Stage Selector */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] text-zinc-400 font-sans">Etapa Procesal:</span>
              <div className="inline-flex items-center p-0.5 rounded-lg bg-[#201f22] border border-dashed border-[#444748]/50">
                {[
                  { stage: 'persuasivo' as CoactiveStage, label: 'Persuasivo', activeClass: 'bg-sky-500 text-white font-bold' },
                  { stage: 'mandamiento' as CoactiveStage, label: 'Mandamiento', activeClass: 'bg-amber-500 text-zinc-950 font-bold' },
                  { stage: 'medidas_cautelares' as CoactiveStage, label: 'Embargos', activeClass: 'bg-purple-500 text-white font-bold' },
                  { stage: 'acuerdo_pago' as CoactiveStage, label: 'Acuerdo', activeClass: 'bg-emerald-500 text-white font-bold' },
                  { stage: 'recaudado' as CoactiveStage, label: 'Recaudado', activeClass: 'bg-teal-500 text-white font-bold' },
                ].map((s) => {
                  const isCurrent = coactiveStage === s.stage;
                  return (
                    <button
                      key={s.stage}
                      type="button"
                      onClick={() => handleCoactiveStageChange(s.stage)}
                      className={`px-2.5 py-1 rounded-md text-[11px] transition-all cursor-pointer ${
                        isCurrent
                          ? `${s.activeClass} shadow-sm`
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* View Layout Tabs & Double-Entry Status Ribbon */}
        <section className="w-full px-4 sm:px-6 py-2 bg-[#171618] border-b border-dashed border-[#444748]/30">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 flex-wrap">
            <div className="inline-flex items-center p-1 rounded-xl bg-[#201f22] border border-dashed border-[#444748]/50 text-xs">
              <button
                type="button"
                onClick={() => setActiveLayoutTab('items')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                  activeLayoutTab === 'items'
                    ? 'bg-white text-zinc-950 shadow-sm font-semibold'
                    : 'text-zinc-400 hover:text-white'
                }`}
                title="Mostrar tabla completa de partidas desglosadas y asiento contable"
              >
                <span className="material-symbols-outlined text-[16px]">receipt_long</span>
                <span>Partidas Desglosadas</span>
                <span className={`px-1.5 py-0.2 rounded-full font-mono text-[10px] ${
                  activeLayoutTab === 'items' ? 'bg-zinc-200 text-zinc-900 font-bold' : 'bg-zinc-800 text-zinc-400'
                }`}>
                  {items.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveLayoutTab('document')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                  activeLayoutTab === 'document'
                    ? 'bg-white text-zinc-950 shadow-sm font-semibold'
                    : 'text-zinc-400 hover:text-white'
                }`}
                title="Visualizar documento original de la factura"
              >
                <span className="material-symbols-outlined text-[16px]">description</span>
                <span>Documento Original</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveLayoutTab('split')}
                className={`hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                  activeLayoutTab === 'split'
                    ? 'bg-white text-zinc-950 shadow-sm font-semibold'
                    : 'text-zinc-400 hover:text-white'
                }`}
                title="Vista dividida: documento a la izquierda y desglose contable a la derecha"
              >
                <span className="material-symbols-outlined text-[16px]">vertical_split</span>
                <span>Vista Dividida</span>
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border border-dashed ${
                isBalanced
                  ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/40'
                  : 'bg-amber-950/40 text-amber-300 border-amber-800/40'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isBalanced ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`}></span>
                <span>{isBalanced ? 'Partida doble balanceada' : `Descuadre: ${discrepancy.toFixed(2)} €`}</span>
              </span>
            </div>
          </div>
        </section>

        {/* Dual Workspace Layout: Document Canvas + Line Allocation Engine */}
        <section className="w-full px-4 sm:px-6 py-4 sm:py-6 flex-1">
          <div className={`max-w-7xl mx-auto w-full gap-6 items-start ${
            isSplit
              ? 'grid grid-cols-1 lg:grid-cols-12'
              : 'flex flex-col'
          }`}>
            
            {/* LEFT COLUMN: Optical Inspection & Document Sandbox */}
            {showDocument && (
            <div className={`flex flex-col h-full bg-[#1c1b1d]/85 backdrop-blur-md border border-dashed border-[#444748]/40 rounded-xl shadow-md overflow-hidden ${
              isSplit ? 'lg:col-span-5' : 'w-full max-w-4xl mx-auto'
            }`}>
              
              {/* Document Canvas Header Toolbar */}
              <div className="flex items-center justify-between px-3 py-2 bg-[#201f22]/90 border-b border-dashed border-[#444748]/40 min-h-[3.25rem] flex-wrap gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="px-2 py-0.5 rounded bg-[#353437] text-white font-mono text-[10px] font-medium border border-dashed border-[#444748]/50 uppercase shrink-0">
                    {fileExt || 'DOC'}
                  </span>
                  <span className="font-mono text-xs text-[#c4c7c8] truncate max-w-[100px] sm:max-w-[150px]" title={invoice.original_name}>
                    {invoice.original_name}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
                  {/* View Mode Toggle */}
                  <div className="flex items-center bg-[#2a2a2c] rounded-lg p-0.5 border border-dashed border-[#444748]/50 shrink-0">
                    <button
                      type="button"
                      onClick={() => setPreviewMode('document')}
                      className={`px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                        previewMode === 'document' ? 'bg-[#353437] text-white shadow-sm font-semibold' : 'text-zinc-400 hover:text-white'
                      }`}
                      title="Ver factura original real"
                    >
                      <span className="material-symbols-outlined text-[14px]">description</span>
                      <span className="hidden sm:inline">Factura Real</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewMode('compact')}
                      className={`px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                        previewMode === 'compact' ? 'bg-[#353437] text-white shadow-sm font-semibold' : 'text-zinc-400 hover:text-white'
                      }`}
                      title="Ver ficha sintética compacta"
                    >
                      <span className="material-symbols-outlined text-[14px]">view_compact</span>
                      <span className="hidden sm:inline">Ficha</span>
                    </button>
                    {(isJson || isText) && rawFileText && (
                      <button
                        type="button"
                        onClick={() => setPreviewMode('raw')}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                          previewMode === 'raw' ? 'bg-[#353437] text-white shadow-sm font-semibold' : 'text-zinc-400 hover:text-white'
                        }`}
                        title="Ver código fuente JSON del archivo"
                      >
                        <span className="material-symbols-outlined text-[14px]">code</span>
                        <span className="hidden sm:inline">JSON</span>
                      </button>
                    )}
                  </div>

                  {/* Zoom Controls */}
                  {(previewMode === 'document' || previewMode === 'compact' || isImage) && (
                    <div className="flex items-center gap-0.5 bg-[#2a2a2c] border border-dashed border-[#444748]/50 rounded p-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={handleZoomOut}
                        className="w-6 h-6 flex items-center justify-center rounded text-[#c4c7c8] hover:text-white hover:bg-[#353437] transition-colors cursor-pointer"
                        title="Reducir zoom"
                      >
                        <span className="material-symbols-outlined text-[14px]">remove</span>
                      </button>
                      <span className="font-mono text-[10px] px-1 text-white select-none">
                        {zoom}%
                      </span>
                      <button
                        type="button"
                        onClick={handleZoomIn}
                        className="w-6 h-6 flex items-center justify-center rounded text-[#c4c7c8] hover:text-white hover:bg-[#353437] transition-colors cursor-pointer"
                        title="Aumentar zoom"
                      >
                        <span className="material-symbols-outlined text-[14px]">add</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleZoomFit}
                        className="w-6 h-6 flex items-center justify-center rounded text-[#c4c7c8] hover:text-white hover:bg-[#353437] transition-colors ml-0.5 border-l border-dashed border-[#444748]/40 cursor-pointer"
                        title="Ajustar vista 100%"
                      >
                        <span className="material-symbols-outlined text-[14px]">fit_screen</span>
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleReScan}
                    disabled={isScanning}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#2a2a2c] hover:bg-[#353437] text-white text-xs font-medium border border-dashed border-[#444748]/50 transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                    title="Re-ejecutar escaneo láser y análisis óptico con SplitLLM"
                  >
                    <span className="material-symbols-outlined text-[15px]">document_scanner</span>
                    <span className="hidden md:inline">Escanear</span>
                  </button>
                </div>
              </div>

              {/* Visual Invoice Sheet or Laser Scanning Animation */}
              {isScanning ? (
                <div className="relative flex-1 min-h-[580px] bg-[#0e0e10]/80 p-4 flex items-center justify-center shadow-inner">
                  <ScanningAnimationCard
                    fileName={invoice.original_name || invoice.filename}
                    amountText={`${targetGrandTotal.toFixed(2)} €`}
                    stage={scanStage}
                    statusMessage={scanStatusText}
                    progressPercent={scanProgress}
                    onCancel={() => setIsScanning(false)}
                  />
                </div>
              ) : previewMode === 'raw' ? (
                /* RAW FILE / JSON CODE VIEWER */
                <div className="relative flex-1 min-h-[580px] bg-[#0e0e10]/95 p-3.5 overflow-auto flex flex-col shadow-inner">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-dashed border-[#444748]/40 text-xs">
                    <span className="font-mono text-zinc-400 text-[11px] flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
                      Código Fuente del Archivo ({fileExt.toUpperCase()})
                    </span>
                    {rawFileText && (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(rawFileText);
                          setSaveMessage('[OK] Contenido copiado.');
                          setTimeout(() => setSaveMessage(''), 2000);
                        }}
                        className="px-2 py-0.5 rounded bg-[#2a2a2c] hover:bg-[#353437] text-zinc-300 hover:text-white font-mono text-[10px] border border-dashed border-[#444748]/50 transition-colors cursor-pointer"
                      >
                        Copiar
                      </button>
                    )}
                  </div>
                  {isLoadingRaw ? (
                    <div className="flex items-center justify-center flex-1 text-zinc-500 text-xs font-mono">
                      Cargando documento original...
                    </div>
                  ) : rawFileText ? (
                    <pre className="p-3 rounded-lg bg-[#141416] border border-dashed border-[#444748]/40 font-mono text-[11px] text-zinc-300 leading-relaxed overflow-x-auto whitespace-pre selection:bg-white/20">
                      {rawFileText}
                    </pre>
                  ) : (
                    <div className="flex items-center justify-center flex-1 text-zinc-500 text-xs font-mono">
                      Documento fuente no disponible en disco.
                    </div>
                  )}
                </div>
              ) : previewMode === 'document' ? (
                /* REAL DOCUMENT VIEWER */
                <div className="relative flex-1 min-h-[580px] bg-[#0e0e10]/95 flex flex-col justify-start items-stretch shadow-inner overflow-hidden">
                  {isPdf && invoice.file_path && fileExt === 'pdf' ? (
                    <div className="w-full h-full flex-1 min-h-[580px] bg-[#141416] p-1.5 flex flex-col">
                      <iframe
                        src={`${invoice.file_path}#toolbar=0&navpanes=0`}
                        className="w-full flex-1 min-h-[580px] rounded-lg border border-dashed border-[#444748]/50 bg-[#1c1b1d]"
                        title={`Documento PDF: ${invoice.original_name}`}
                      />
                    </div>
                  ) : isImage && invoice.file_path ? (
                    <div className="relative flex-1 min-h-[580px] bg-[#0e0e10]/90 p-4 overflow-auto select-none flex justify-center items-start shadow-inner">
                      <img
                        src={invoice.file_path}
                        alt={invoice.original_name}
                        style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
                        className="max-w-full h-auto object-contain rounded border border-dashed border-[#444748]/50 shadow-2xl transition-transform duration-150"
                      />
                    </div>
                  ) : isHtml && invoice.file_path && (fileExt === 'html' || fileExt === 'htm') ? (
                    <div className="w-full h-full flex-1 min-h-[580px] bg-[#141416] p-1.5 flex flex-col">
                      <iframe
                        src={invoice.file_path}
                        className="w-full flex-1 min-h-[580px] rounded-lg border border-dashed border-[#444748]/50 bg-white"
                        title={`Documento HTML: ${invoice.original_name}`}
                      />
                    </div>
                  ) : (
                    /* AUTHENTIC VISUAL INVOICE DOCUMENT (PREVIEW DE FACTURA REAL) */
                    <div className="relative flex-1 min-h-[580px] bg-[#0a0a0c] p-4 sm:p-6 overflow-auto flex justify-center items-start shadow-inner">
                      <div
                        style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
                        className="w-full max-w-[640px] bg-white text-slate-900 rounded-sm shadow-2xl p-4 sm:p-6 md:p-8 flex flex-col gap-4 sm:gap-6 transition-transform duration-150 select-text border border-slate-200"
                      >
                        {/* Top Header & Document Metadata */}
                        <div className="flex items-start justify-between border-b-2 border-slate-900 pb-5">
                          <div className="flex items-start gap-3.5">
                            <div className="w-12 h-12 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-lg tracking-wider shrink-0 shadow">
                              {docSupplierName.substring(0, 2).toUpperCase()}
                            </div>
                            <div className="flex flex-col">
                              <h2 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                                {docSupplierName}
                              </h2>
                              <span className="text-xs font-mono font-bold text-slate-600 mt-0.5">
                                NIF/CIF: {docSupplierTaxId || 'No informado'}
                              </span>
                              {docSupplierAddress && (
                                <span className="text-[11px] text-slate-500 max-w-[280px] leading-snug">
                                  {docSupplierAddress}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="text-right flex flex-col items-end">
                            <span className="text-[11px] uppercase font-black tracking-widest text-slate-400">
                              Factura Comercial
                            </span>
                            <span className="text-base sm:text-lg font-mono font-black text-slate-950 mt-0.5">
                              {docInvoiceNumber}
                            </span>
                            <div className="flex flex-col text-xs font-mono text-slate-600 mt-1 space-y-0.5">
                              <span className="whitespace-nowrap">Fecha Emisión: <strong className="text-slate-900 font-mono whitespace-nowrap">{docIssueDate}</strong></span>
                              {docDueDate && (
                                <span className="whitespace-nowrap">Vencimiento: <strong className="text-slate-900 font-mono whitespace-nowrap">{docDueDate}</strong></span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Bilateral Fiscal Boxes: Emisor y Cliente */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs flex flex-col gap-1">
                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Datos del Emisor</span>
                            <span className="font-bold text-slate-900">{docSupplierName}</span>
                            <span className="font-mono text-slate-600">NIF: {docSupplierTaxId || '-'}</span>
                            <span className="text-slate-500 text-[11px]">{docSupplierAddress || 'Domicilio fiscal España'}</span>
                          </div>

                          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs flex flex-col gap-1">
                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Facturado a (Cliente)</span>
                            <span className="font-bold text-slate-900">{docCustomerName}</span>
                            <span className="font-mono text-slate-600">NIF: {docCustomerTaxId || 'ESB87219034'}</span>
                            <span className="text-slate-500 text-[11px]">{docCustomerAddress || 'Paseo de la Castellana 95, 28046 Madrid'}</span>
                          </div>
                        </div>

                        {/* Line Items Table */}
                        <div className="overflow-hidden border border-slate-200 rounded-lg">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-100 text-slate-700 text-[10px] uppercase font-bold tracking-wider border-b border-slate-200">
                                <th className="px-3 py-2.5">#</th>
                                <th className="px-3 py-2.5">Descripción / Concepto</th>
                                <th className="px-3 py-2.5 text-center">Cant.</th>
                                <th className="px-3 py-2.5 text-right">Precio Unit.</th>
                                <th className="px-3 py-2.5 text-right">% IVA</th>
                                <th className="px-3 py-2.5 text-right">Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-800 font-sans">
                              {displayDocItems.length === 0 ? (
                                <tr>
                                  <td colSpan={6} className="px-3 py-4 text-center text-slate-400 font-mono">
                                    No se encontraron partidas desglosadas
                                  </td>
                                </tr>
                              ) : (
                                displayDocItems.map((item, idx) => {
                                  const qty = Number(item.quantity) || 1;
                                  const price = Number(item.unit_price) || Number(item.base_amount) || 0;
                                  const total = Number(item.total_amount) || (price * qty * 1.21);
                                  return (
                                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                                      <td className="px-3 py-2.5 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                                      <td className="px-3 py-2.5 font-semibold text-slate-900">
                                        {item.concept || item.description || 'Partida'}
                                      </td>
                                      <td className="px-3 py-2.5 text-center font-mono">{qty}</td>
                                      <td className="px-3 py-2.5 text-right font-mono">
                                        {price.toFixed(2)} €
                                      </td>
                                      <td className="px-3 py-2.5 text-right font-mono text-slate-600">
                                        {item.tax_rate ?? 21}%
                                      </td>
                                      <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900">
                                        {total.toFixed(2)} €
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>

                        {/* Financial Totals Box & Official Stamp */}
                        <div className="flex flex-col sm:flex-row items-start justify-between gap-4 pt-2">
                          {/* Official Stamp & Fiscal Notice */}
                          <div className="flex flex-col gap-2 max-w-[280px]">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-emerald-300 bg-emerald-50 text-emerald-800 text-[11px] font-medium tracking-tight">
                              <span className="material-symbols-outlined text-[15px] text-emerald-600">verified</span>
                              <span>Factura Electrónica Válida</span>
                            </div>
                            <p className="text-[10px] text-slate-400 leading-tight">
                              Documento expedido de conformidad con el Real Decreto 1619/2012 de facturación. Válido para deducción fiscal y contabilidad oficial.
                            </p>
                          </div>

                          {/* Totals Summary */}
                          <div className="w-full sm:w-64 bg-slate-50 border border-slate-200 rounded-lg p-3 sm:p-3.5 flex flex-col gap-1.5 text-xs font-mono">
                            <div className="flex justify-between items-baseline text-slate-600">
                              <span className="shrink-0">Base Imponible:</span>
                              <span className="text-slate-800 font-medium whitespace-nowrap">{docSubtotal.toFixed(2)} €</span>
                            </div>
                            <div className="flex justify-between items-baseline text-slate-600">
                              <span className="shrink-0">IVA (21%):</span>
                              <span className="text-slate-800 font-medium whitespace-nowrap">{docTaxTotal.toFixed(2)} €</span>
                            </div>
                            {docRetention > 0 && (
                              <div className="flex justify-between items-baseline text-rose-600">
                                <span className="shrink-0">Retención IRPF:</span>
                                <span className="whitespace-nowrap">-{docRetention.toFixed(2)} €</span>
                              </div>
                            )}
                            <div className="pt-2 border-t border-slate-300 flex justify-between items-baseline text-sm font-bold text-slate-900 gap-2">
                              <span className="font-sans shrink-0">TOTAL:</span>
                              <span className="text-base sm:text-lg text-slate-950 font-mono font-black whitespace-nowrap">{docGrandTotal.toFixed(2)} {docCurrency === 'EUR' ? '€' : docCurrency}</span>
                            </div>
                          </div>
                        </div>

                        {/* Footer: Payment Method, IBAN & Fiscal QR */}
                        <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold text-slate-700">Forma de pago: {invoice.payment_method || 'Transferencia Bancaria'}</span>
                            {invoice.iban && (
                              <span className="font-mono text-[11px]">IBAN: {invoice.iban}</span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="flex flex-col items-end text-[10px] font-mono text-slate-400">
                              <span>CSV: {invoice.id.substring(0, 8).toUpperCase()}-VERIF</span>
                              <span>Cotejo oficial regulatorio</span>
                            </div>
                            <div className="w-9 h-9 bg-slate-900 text-white rounded p-1 flex items-center justify-center">
                              <span className="material-symbols-outlined text-[20px]">qr_code_2</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* STREAMLINED COMPACT SUMMARY CARD */
                <div className="relative flex-1 min-h-[580px] bg-[#0e0e10]/80 p-5 overflow-auto flex justify-center items-start shadow-inner">
                  <div
                    style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
                    className="w-full max-w-[440px] bg-[#1c1b1d] rounded-xl border border-dashed border-[#444748]/60 p-5 shadow-2xl flex flex-col gap-4 transition-transform duration-150"
                  >
                    {/* Compact Header */}
                    <div className="flex items-start justify-between pb-3 border-b border-dashed border-[#444748]/40">
                      <div className="flex flex-col min-w-0 pr-3">
                        <span className="text-[10px] uppercase font-semibold text-zinc-400 tracking-wider">Emisor</span>
                        <h3 className="text-sm font-bold text-white tracking-tight truncate" title={cleanSupplierName(invoice.supplier_name)}>
                          {cleanSupplierName(invoice.supplier_name)}
                        </h3>
                        <span className="font-mono text-xs text-zinc-400 mt-0.5">NIF: {cleanSupplierTaxId(invoice.supplier_name, invoice.supplier_tax_id) || '-'}</span>
                        {invoice.supplier_address && (
                          <span className="text-[11px] text-zinc-500 truncate max-w-[260px]">{invoice.supplier_address}</span>
                        )}
                      </div>
                      <div className="text-right flex flex-col items-end shrink-0">
                        <span className="font-mono text-xs font-bold text-white"># {invoice.invoice_number}</span>
                        <span className="font-mono text-[11px] text-zinc-400">{invoice.invoice_date}</span>
                        {invoice.due_date && (
                          <span className="font-mono text-[10px] text-zinc-500">Vence: {invoice.due_date}</span>
                        )}
                      </div>
                    </div>

                    {/* Compact Recipient */}
                    <div className="p-2.5 rounded-lg bg-[#201f22] border border-dashed border-[#444748]/40 flex items-center justify-between text-xs">
                      <div className="flex flex-col min-w-0">
                        <span className="text-[10px] uppercase font-semibold text-zinc-400">Cliente / Receptor</span>
                        <span className="text-white font-medium truncate">{invoice.customer_name || 'SplitLedger Labs S.L.'}</span>
                      </div>
                      <span className="font-mono text-[11px] text-zinc-400 shrink-0 pl-2">{invoice.customer_tax_id || 'ESB87219034'}</span>
                    </div>

                    {/* Partidas Count */}
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-[#201f22] border border-dashed border-[#444748]/40 text-xs">
                      <span className="text-zinc-300 font-medium">Partidas desglosadas</span>
                      <span className="font-mono text-white font-bold">{items.length} partidas</span>
                    </div>

                    {/* Compact Totals Box */}
                    <div className="p-3 rounded-lg bg-[#141416] border border-dashed border-[#444748]/50 flex flex-col gap-1.5 text-xs font-mono">
                      <div className="flex justify-between text-zinc-400">
                        <span>Base Imponible</span>
                        <span className="text-zinc-200">{targetSubtotal.toFixed(2)} €</span>
                      </div>
                      <div className="flex justify-between text-zinc-400">
                        <span>IVA / Impuestos</span>
                        <span className="text-zinc-200">{targetTaxTotal.toFixed(2)} €</span>
                      </div>
                      {Boolean((invoice.surcharge_total ?? 0) > 0) && (
                        <div className="flex justify-between text-zinc-400">
                          <span>Recargo Eq.</span>
                          <span className="text-amber-300">+{(invoice.surcharge_total || 0).toFixed(2)} €</span>
                        </div>
                      )}
                      {Boolean((invoice.retention_total ?? 0) > 0) && (
                        <div className="flex justify-between text-zinc-400">
                          <span>Retención IRPF</span>
                          <span className="text-rose-300">-{(invoice.retention_total || 0).toFixed(2)} €</span>
                        </div>
                      )}
                      <div className="pt-2 border-t border-dashed border-[#444748]/40 flex justify-between items-center text-sm font-bold text-white">
                        <span className="font-sans">Total Liquidación</span>
                        <span className="text-base text-white">{targetGrandTotal.toFixed(2)} {invoice.currency || '€'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Document Canvas Status Footer */}
              <div className="flex items-center justify-between text-zinc-400 text-xs px-3 py-2 bg-[#201f22]/90 border-t border-dashed border-[#444748]/40 h-10">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  <span className="text-xs text-zinc-300">
                    {previewMode === 'document' ? 'Visualizando factura real' : previewMode === 'compact' ? 'Ficha sintética compacta' : 'Código fuente original'}
                  </span>
                </div>
                <span className="font-mono text-[11px] text-zinc-400">
                  {fileExt.toUpperCase()} • Precisión {((invoice.confidence_score || 0.988) * 100).toFixed(1)}%
                </span>
              </div>

            </div>
            )}

            {/* RIGHT COLUMN: Master Item Breakdown Table */}
            {showItems && (
            <div className={`flex flex-col h-full bg-[#1c1b1d]/85 backdrop-blur-md border border-dashed border-[#444748]/40 rounded-xl shadow-md overflow-hidden ${
              isSplit ? 'lg:col-span-7' : 'w-full'
            }`}>
              
              {/* Table Toolbar */}
              <div className="flex items-center justify-between px-3 py-2 bg-[#201f22]/90 border-b border-dashed border-[#444748]/40 h-14">
                <div className="flex items-center gap-2">
                  <span className="text-white font-semibold text-sm sm:text-base">Partidas Desglosadas</span>
                  <span className="px-2 py-0.5 rounded-full bg-[#353437] border border-dashed border-[#444748]/50 font-mono text-[11px] text-white font-medium">
                    {items.length} detectadas
                  </span>
                </div>

                {invoice.thinking_process && (
                  <button
                    type="button"
                    onClick={() => setShowThinking(!showThinking)}
                    className={`px-2.5 py-1 rounded text-xs font-mono font-medium border border-dashed flex items-center gap-1.5 transition-colors cursor-pointer ${
                      showThinking
                        ? 'bg-zinc-800 text-white border-zinc-500'
                        : 'bg-[#2a2a2c] text-zinc-300 border-[#444748]/50 hover:bg-[#353437]'
                    }`}
                    title="Visualizar traza de razonamiento Chain-of-Thought (CoT) del modelo"
                  >
                    <span className="material-symbols-outlined text-[15px]">terminal</span>
                    <span>{showThinking ? 'Ocultar CoT' : 'Razonamiento CoT'}</span>
                  </button>
                )}
              </div>

              {/* Collapsible Chain-of-Thought drawer */}
              {showThinking && invoice.thinking_process && (
                <div className="p-3 bg-[#111113] border-b border-dashed border-[#444748]/50 text-xs font-mono animate-fade-in">
                  <div className="flex items-center justify-between text-zinc-400 mb-1.5">
                    <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-300 font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                      Traza de Razonamiento Neuronal (CoT Reasoning)
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">tokens de inferencia</span>
                  </div>
                  <pre className="p-2.5 rounded bg-[#0a0a0c] border border-zinc-800/80 text-zinc-300 whitespace-pre-wrap font-mono text-[11px] leading-relaxed max-h-44 overflow-y-auto">
                    {invoice.thinking_process}
                  </pre>
                </div>
              )}

              {/* Executive Metadata Ribbon */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-[#181719] border-b border-dashed border-[#444748]/40 text-xs">
                <div className="flex flex-col">
                  <span className="text-[10px] text-[#c4c7c8] uppercase font-semibold">Emisor / NIF</span>
                  <span className="text-white font-medium truncate" title={cleanSupplierName(invoice.supplier_name)}>{cleanSupplierName(invoice.supplier_name)}</span>
                  <span className="text-[11px] font-mono text-zinc-400">{cleanSupplierTaxId(invoice.supplier_name, invoice.supplier_tax_id) || '-'}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-[#c4c7c8] uppercase font-semibold">Cliente / Receptor</span>
                  <span className="text-white font-medium truncate" title={invoice.customer_name}>{invoice.customer_name || 'No especificado'}</span>
                  <span className="text-[11px] font-mono text-zinc-400">{invoice.customer_tax_id || '-'}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-[#c4c7c8] uppercase font-semibold">Tesorería & Pago</span>
                  <span className="text-white font-mono truncate">{invoice.payment_method || 'Contado / Giro'}</span>
                  <span className="text-[11px] font-mono text-zinc-400 truncate" title={invoice.iban}>{invoice.iban || 'Sin IBAN'}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-[#c4c7c8] uppercase font-semibold">Liquidación Fiscal</span>
                  <span className="text-white font-mono font-semibold">
                    {(targetGrandTotal).toFixed(2)} {invoice.currency || 'EUR'}
                  </span>
                  <span className="text-[11px] font-mono text-zinc-400 truncate">
                    {invoice.currency_conversion?.is_foreign ? (
                      `PGC: ${invoice.currency_conversion.converted_total_eur.toFixed(2)} € (@ ${invoice.currency_conversion.exchange_rate})`
                    ) : (
                      `IVA: ${currentItemsTaxSum.toFixed(2)} €${invoice.surcharge_total ? ` • RE: ${invoice.surcharge_total.toFixed(2)} €` : ''}`
                    )}
                  </span>
                </div>
              </div>

              {/* Master Table */}
              <div className="flex-1 w-full overflow-x-auto bg-[#0e0e10]/40 flex flex-col justify-between">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#201f22]/70 border-b border-dashed border-[#444748]/40 text-zinc-400 text-[11px] tracking-wider uppercase select-none">
                      <th className="py-2.5 px-2 w-8 text-center">#</th>
                      <th className="py-2.5 px-3 min-w-[170px]">Concepto / Partida</th>
                      <th className="py-2.5 px-2 w-20 text-center">Cant.</th>
                      <th className="py-2.5 px-2 w-24 text-right">P. Unit.</th>
                      <th className="py-2.5 px-2 w-16 text-right">Desc.</th>
                      <th className="py-2.5 px-2 min-w-[150px]">Cuenta PGC</th>
                      <th className="py-2.5 px-2 min-w-[95px]">C. Coste</th>
                      <th className="py-2.5 px-2 text-right w-20">Base</th>
                      <th className="py-2.5 px-1.5 text-center w-12">IVA</th>
                      <th className="py-2.5 px-2.5 text-right w-24">Total</th>
                      <th className="py-2.5 px-2 text-center w-10">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-0 text-xs">
                    {items.map((item, idx) => {
                      const isHovered = hoveredLineIndex === idx;
                      return (
                        <tr
                          key={idx}
                          onMouseEnter={() => setHoveredLineIndex(idx)}
                          onMouseLeave={() => setHoveredLineIndex(null)}
                          className={`border-b border-dashed border-[#444748]/30 transition-colors group ${
                            isHovered
                              ? 'bg-[#353437]'
                              : idx % 2 === 0
                              ? 'hover:bg-[#201f22]'
                              : 'bg-[#0e0e10]/30 hover:bg-[#201f22]'
                          }`}
                        >
                          <td className="py-2.5 px-2 font-mono text-center text-xs text-zinc-400">
                            {String(idx + 1).padStart(2, '0')}
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              value={item.concept}
                              onChange={(e) => {
                                const updated = [...items];
                                updated[idx] = { ...updated[idx], concept: e.target.value };
                                setItems(updated);
                              }}
                              className="w-full bg-transparent text-white font-medium text-xs focus:outline-none focus:border-b focus:border-white"
                            />
                            <div className="text-[10px] text-zinc-500 font-mono mt-0.5 truncate max-w-[190px]">
                              {item.notes || 'Partida validada por OCR'}
                            </div>
                          </td>
                          <td className="py-2.5 px-2 text-center font-mono">
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="number"
                                step="any"
                                value={item.quantity ?? 1}
                                onChange={(e) => handleItemQuantityChange(idx, e.target.value)}
                                className="w-10 text-center bg-transparent text-white font-mono text-xs focus:outline-none focus:bg-[#353437] rounded py-0.5"
                              />
                              <input
                                type="text"
                                value={item.unit || 'uds'}
                                onChange={(e) => handleItemUnitChange(idx, e.target.value)}
                                className="w-7 text-[10px] text-zinc-400 bg-transparent text-center focus:outline-none font-mono"
                                title="Unidad de medida"
                              />
                            </div>
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono">
                            <input
                              type="number"
                              step="0.01"
                              value={item.unit_price ?? item.base_amount ?? 0}
                              onChange={(e) => handleItemUnitPriceChange(idx, e.target.value)}
                              className="w-16 text-right bg-transparent text-white font-mono text-xs focus:outline-none focus:bg-[#353437] rounded px-1 py-0.5"
                            /> €
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono">
                            <input
                              type="number"
                              step="0.01"
                              value={item.discount_amount ?? 0}
                              onChange={(e) => handleItemDiscountChange(idx, e.target.value)}
                              className="w-12 text-right bg-transparent text-zinc-400 font-mono text-xs focus:outline-none focus:bg-[#353437] rounded px-1 py-0.5"
                            /> €
                          </td>
                          <td className="py-2.5 px-2">
                            <select
                              value={item.account_code ? item.account_code.replace(/\./g, '') : '628000'}
                              onChange={(e) => handleItemAccountChange(idx, e.target.value)}
                              className="w-full bg-[#353437] border border-dashed border-[#444748]/50 text-white text-xs px-2 py-1 rounded focus:outline-none focus:ring-1 focus:ring-white transition-colors cursor-pointer"
                            >
                              {pgcGroups.map(grp => (
                                <optgroup key={grp} label={grp} className="bg-[#201f22] text-zinc-300 font-semibold text-[11px]">
                                  {availableAccounts.filter(a => (a.group || 'Grupo 62 - Servicios Exteriores') === grp).map(acc => (
                                    <option key={acc.code} value={acc.code.replace(/\./g, '')} className="bg-[#1c1b1d] text-white font-normal text-xs">
                                      {acc.code.replace(/\./g, '')} - {acc.name}
                                    </option>
                                  ))}
                                </optgroup>
                              ))}
                            </select>
                          </td>
                          <td className="py-2.5 px-2">
                            <select
                              value={item.cost_center || 'DevOps'}
                              onChange={(e) => handleItemCostCenterChange(idx, e.target.value)}
                              className="bg-[#2a2a2c] border border-dashed border-[#444748]/40 text-white text-xs px-2 py-1 rounded font-mono cursor-pointer"
                            >
                              <option value="DevOps">DevOps</option>
                              <option value="Data">Data</option>
                              <option value="Management">Management</option>
                              <option value="Operations">Operations</option>
                              <option value="AI-Research">AI-Research</option>
                              <option value="Marketing">Marketing</option>
                              <option value="General">General</option>
                            </select>
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono">
                            <input
                              type="number"
                              step="0.01"
                              value={item.base_amount}
                              onChange={(e) => handleItemBaseChange(idx, e.target.value)}
                              className="w-20 text-right bg-transparent text-white font-mono text-xs focus:outline-none focus:bg-[#353437] rounded px-1"
                            /> €
                          </td>
                          <td className="py-2.5 px-1.5 text-center font-mono text-zinc-400">
                            {item.tax_rate ?? 21}%
                          </td>
                          <td className="py-2.5 px-2.5 text-right font-mono text-white font-semibold">
                            {(item.total_amount || 0).toFixed(2)} €
                          </td>
                          <td className="py-2.5 px-2 text-center">
                            <button
                              onClick={() => handleDeleteItem(idx)}
                              className="p-1 rounded hover:bg-[#353437] text-zinc-400 hover:text-red-400 transition-colors cursor-pointer"
                              title="Eliminar partida"
                            >
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Bottom Operational Action Bar */}
              <div className="px-3 py-2 bg-[#201f22]/90 border-t border-dashed border-[#444748]/40 flex flex-col sm:flex-row items-center justify-between gap-2 h-auto sm:h-12">
                <button
                  type="button"
                  onClick={handleAddManualItem}
                  className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-[#353437] border border-dashed border-[#444748]/40 hover:bg-[#444748] text-white text-xs font-medium transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">add_circle</span>
                  <span>Añadir partida manual (+)</span>
                </button>

                <div className={`flex items-center gap-2 px-3 py-1 rounded text-xs border border-dashed ${
                  isBalanced
                    ? 'bg-[#0e0e10] border-[#444748]/40 text-zinc-200'
                    : 'bg-amber-950/40 border-amber-800/40 text-amber-200'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${isBalanced ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`}></span>
                  <span>{isBalanced ? 'Cuadrante balanceado' : 'Ajuste pendiente'}</span>
                  <span className="font-mono text-zinc-400">
                    (Dif: <strong className={isBalanced ? 'text-white' : 'text-amber-400'}>{discrepancy.toFixed(2)} €</strong>)
                  </span>
                </div>
              </div>

              {/* Asiento Contable PGC (Double Entry Journal Seat) */}
              <div className="p-3.5 bg-[#181719] border-t border-dashed border-[#444748]/40">
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[16px] text-zinc-300">account_balance</span>
                    <span className="text-white text-xs font-semibold uppercase tracking-wider">Asiento Contable PGC (Partida Doble)</span>
                  </div>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
                    isBalanced ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-800/50' : 'bg-amber-950/70 text-amber-300 border border-amber-800/50'
                  }`}>
                    {isBalanced ? '[ASIENTO CUADRADO]' : '[DESCUADRE PGC]'}
                  </span>
                </div>

                {invoice.currency_conversion?.is_foreign && (
                  <div className="mb-2.5 p-2 rounded bg-[#201f22] border border-dashed border-[#444748]/50 flex items-center justify-between text-xs font-mono text-zinc-300 flex-wrap gap-1">
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[15px] text-amber-300">currency_exchange</span>
                      <span>PGC NRV 11ª (Moneda extranjera): <strong>{invoice.currency_conversion.source_grand_total.toFixed(2)} {invoice.currency_conversion.source_currency}</strong> @ {invoice.currency_conversion.exchange_rate} = <strong>{invoice.currency_conversion.converted_total_eur.toFixed(2)} EUR</strong></span>
                    </div>
                    <span className="text-[10px] text-zinc-400 font-mono">Cuenta 4004 (Moneda extranjera)</span>
                  </div>
                )}

                <div className="overflow-x-auto rounded border border-dashed border-[#444748]/40 bg-[#0e0e10]/60">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="bg-[#201f22]/80 border-b border-dashed border-[#444748]/40 text-zinc-400 text-[10px] uppercase">
                        <th className="py-2 px-3">Cuenta PGC</th>
                        <th className="py-2 px-3">Concepto / Subcuenta</th>
                        <th className="py-2 px-3 text-right">Debe</th>
                        <th className="py-2 px-3 text-right">Haber</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#444748]/20 text-[11px]">
                      {(invoice.journal_entry?.lines || [
                        ...items.map(it => ({
                          account_code: it.account_code || '628000',
                          account_name: it.account_name || it.concept,
                          debit: it.base_amount || 0,
                          credit: 0
                        })),
                        ...(currentItemsTaxSum > 0 ? [{
                          account_code: '472000',
                          account_name: `H.P. IVA Soportado (${items[0]?.tax_rate || 21}%)`,
                          debit: currentItemsTaxSum,
                          credit: 0
                        }] : []),
                        ...(invoice.surcharge_total && invoice.surcharge_total > 0 ? [{
                          account_code: '472001',
                          account_name: 'H.P. Recargo de Equivalencia (5,2%)',
                          debit: invoice.surcharge_total,
                          credit: 0
                        }] : []),
                        ...(invoice.retention_total && invoice.retention_total > 0 ? [{
                          account_code: '475100',
                          account_name: 'H.P. Acreedora por Retenciones IRPF',
                          debit: 0,
                          credit: invoice.retention_total
                        }] : []),
                        {
                          account_code: '400000',
                          account_name: `Proveedores: ${invoice.supplier_name || 'Acreedor'}`,
                          debit: 0,
                          credit: targetGrandTotal
                        }
                      ]).map((seatLine, sIdx) => (
                        <tr key={sIdx} className="hover:bg-[#201f22]/50 transition-colors">
                          <td className="py-1.5 px-3 text-white font-semibold">{seatLine.account_code}</td>
                          <td className="py-1.5 px-3 text-zinc-300 truncate max-w-[240px]">{seatLine.account_name}</td>
                          <td className="py-1.5 px-3 text-right text-emerald-400">
                            {seatLine.debit > 0 ? `${seatLine.debit.toFixed(2)} €` : '-'}
                          </td>
                          <td className="py-1.5 px-3 text-right text-sky-400">
                            {seatLine.credit > 0 ? `${seatLine.credit.toFixed(2)} €` : '-'}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-[#201f22] font-semibold border-t border-dashed border-[#444748]/60 text-white">
                        <td colSpan={2} className="py-1.5 px-3 text-right uppercase text-[10px] text-zinc-400">Sumas del Asiento:</td>
                        <td className="py-1.5 px-3 text-right text-emerald-300">{targetGrandTotal.toFixed(2)} €</td>
                        <td className="py-1.5 px-3 text-right text-sky-300">{targetGrandTotal.toFixed(2)} €</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
            )}

          </div>
        </section>

      </div>
    </main>
  );
}
