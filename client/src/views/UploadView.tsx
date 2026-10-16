import React, { useState, useRef, useEffect } from 'react';
import { uploadInvoice, uploadInvoicesBatch, uploadInvoicesStream } from '../services/api';
import { Invoice } from '../types/index.js';
import ScanningAnimationCard from '../components/ScanningAnimationCard';

interface UploadViewProps {
  invoices: Invoice[];
  onSelectInvoice: (invoice: Invoice) => void;
  onInvoiceUploaded: (invoice: Invoice) => void;
  onGoToHistory: () => void;
}

export default function UploadView({ invoices = [], onSelectInvoice, onInvoiceUploaded, onGoToHistory }: UploadViewProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingFileName, setUploadingFileName] = useState('');
  const [uploadProgressPercent, setUploadProgressPercent] = useState(15);
  const [scanningStage, setScanningStage] = useState(1);
  const [scanningStatusText, setScanningStatusText] = useState('');
  const [filterType, setFilterType] = useState('Todas');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach(t => clearTimeout(t));
    };
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  };

  const cancelScanning = () => {
    timersRef.current.forEach(t => clearTimeout(t));
    timersRef.current = [];
    setIsUploading(false);
    setUploadProgressPercent(15);
    setScanningStage(1);
    setScanningStatusText('');
  };

  const processFiles = async (files: FileList) => {
    if (!files || files.length === 0) return;

    // Reset previous timers
    timersRef.current.forEach(t => clearTimeout(t));
    timersRef.current = [];

    const isSingleZip = files.length === 1 && files[0].name.toLowerCase().endsWith('.zip');
    const isBatch = files.length > 1 || isSingleZip;
    const titleText = isSingleZip
      ? `Archivo comprimido ZIP: ${files[0].name}`
      : (files.length > 1 ? `Lote de ${files.length} facturas heterogéneas` : files[0].name);

    setUploadingFileName(titleText);
    setIsUploading(true);
    setScanningStage(1);
    setUploadProgressPercent(22);
    setScanningStatusText(
      isSingleZip
        ? `Descomprimiendo y sanitizando archivo ZIP "${files[0].name}"...`
        : (files.length > 1
            ? `Lectura y extracción paralela de ${files.length} facturas del lote...`
            : `Lectura óptica y extracción de coordenadas OCR de "${files[0].name}"...`)
    );

    const t1 = setTimeout(() => {
      setScanningStage(2);
      setUploadProgressPercent(52);
      setScanningStatusText(
        isSingleZip
          ? 'Extrayendo facturas contenidas y construyendo grafos de atención espacial 2D...'
          : (files.length > 1
              ? `Construyendo grafos de atención espacial 2D y correlación tabular para ${files.length} documentos...`
              : 'Construyendo Grafo de Atención Espacial 2D y correlación tabular...')
      );
    }, 700);

    const t2 = setTimeout(() => {
      setUploadProgressPercent(74);
      setScanningStatusText(
        isBatch
          ? 'Inferencia cognitiva SplitLLM en lote y clasificación automática en PGC...'
          : 'Inferencia cognitiva con SplitLLM y clasificación de cuentas PGC...'
      );
    }, 1900);

    const t3 = setTimeout(() => {
      setScanningStage(3);
      setUploadProgressPercent(92);
      setScanningStatusText('Auditando balance contable, retenciones y paridad de partida doble...');
    }, 3200);

    timersRef.current = [t1, t2, t3];

    try {
      let list: Invoice[] = [];
      try {
        const streamRes = await uploadInvoicesStream(files, (evt) => {
          if (evt.event === 'init') {
            setScanningStage(2);
            setUploadProgressPercent(20);
            setScanningStatusText(`Lote iniciado: analizando ${evt.total} documentos...`);
          } else if (evt.event === 'progress') {
            const pct = Math.min(92, Math.round(((evt.index || 1) / (evt.total || 1)) * 90));
            setUploadProgressPercent(pct);
            setScanningStatusText(`[${evt.index}/${evt.total}] Extrayendo: ${evt.currentFile}...`);
          } else if (evt.event === 'item_processed') {
            const pct = Math.min(96, Math.round(((evt.index || 1) / (evt.total || 1)) * 95));
            setUploadProgressPercent(pct);
            setScanningStatusText(`[${evt.index}/${evt.total}] Conciliada: ${evt.invoice?.invoice_number || evt.currentFile}`);
          }
        });
        list = streamRes.data;
      } catch (streamErr) {
        console.warn('Streaming no disponible o interrumpido, recurriendo a endpoint estándar:', streamErr);
        if (files.length > 1) {
          const res = await uploadInvoicesBatch(files);
          list = Array.isArray(res.data) ? res.data : (res.data ? [res.data] : []);
        } else {
          const res = await uploadInvoice(files[0]);
          list = Array.isArray(res.data) ? res.data : (res.data ? [res.data] : []);
        }
      }

      timersRef.current.forEach(t => clearTimeout(t));
      setScanningStage(3);
      setUploadProgressPercent(100);

      const count = list.length;
      setScanningStatusText(
        count > 1
          ? `Lote de ${count} facturas desglosado y conciliado con éxito`
          : 'Descomposición y conciliación completada con éxito'
      );

      setTimeout(() => {
        setIsUploading(false);
        list.forEach(inv => {
          if (onInvoiceUploaded) onInvoiceUploaded(inv);
        });
        if (list.length > 0 && onSelectInvoice) {
          onSelectInvoice(list[0]);
        }
      }, 500);
    } catch (err: any) {
      timersRef.current.forEach(t => clearTimeout(t));
      alert(`Error al procesar: ${err.message}`);
      setIsUploading(false);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const filteredInvoices = invoices.filter(inv => {
    if (filterType === 'Desglosadas') return inv.status === 'analyzed' || inv.status === 'reconciled';
    if (filterType === 'En Proceso') return inv.status === 'processing' || inv.status === 'pending';
    return true;
  });

  return (
    <div className="w-full pt-20 sm:pt-24 bg-transparent min-h-[calc(100vh-4rem)]">
      <div className="pt-6 pb-16 max-w-6xl mx-auto px-4 sm:px-6 space-y-8">


        {/* Upload Zone or Scanning Animation */}
        {isUploading ? (
          <ScanningAnimationCard
            fileName={uploadingFileName || 'Factura.pdf'}
            stage={scanningStage}
            statusMessage={scanningStatusText}
            progressPercent={uploadProgressPercent}
            onCancel={cancelScanning}
            onViewPreliminary={invoices.length > 0 ? () => onSelectInvoice(invoices[0]) : undefined}
          />
        ) : (
          <section
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative rounded-3xl border-2 border-dashed transition-all p-8 sm:p-12 text-center flex flex-col items-center justify-center group ${
              isDragging
                ? 'border-white bg-zinc-900/90 scale-[1.01]'
                : 'border-[#444748]/60 hover:border-zinc-500 bg-zinc-950/75 backdrop-blur-md'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept=".pdf,.png,.jpg,.jpeg,.webp,.bmp,.tiff,.xml,.txt,.csv,.tsv,.json,.md,.html,.htm,.xlsx,.xls,.zip"
              multiple
              className="hidden"
            />

            <div className="w-14 h-14 bg-white/5 border border-dashed border-[#444748]/60 rounded-2xl flex items-center justify-center mb-5 text-zinc-300 shadow-inner group-hover:scale-105 group-hover:border-zinc-500 transition-all">
              <svg className="w-7 h-7 text-zinc-300" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="8" y1="13" x2="16" y2="13"></line>
                <line x1="8" y1="17" x2="13" y2="17"></line>
                <circle cx="16" cy="17" r="1.5"></circle>
              </svg>
            </div>

            <h2 className="text-xl sm:text-2xl font-semibold text-zinc-100 tracking-tight">
              Arrastra cualquier formato de factura o documento aquí
            </h2>

            <p className="text-xs sm:text-sm text-zinc-400 mt-2 max-w-md mx-auto leading-relaxed">
              Motor universal: Lotes comprimidos (ZIP con múltiples facturas), PDF (vectorial o escaneo OCR), hojas de cálculo (Excel XLSX/XLS), facturación electrónica Facturae XML/UBL, tablas CSV/TSV/JSON, HTML e imágenes (PNG/JPG/WEBP).
            </p>

            <div className="mt-6 flex items-center justify-center">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="bg-white text-zinc-950 hover:bg-zinc-200 px-6 py-2.5 rounded-full text-sm font-medium shadow-sm inline-flex items-center gap-2 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">add_circle</span>
                <span>Seleccionar archivos</span>
              </button>
            </div>
          </section>
        )}

        {/* Recent Invoices Feed */}
        <section className="space-y-4">
          <div className="flex items-center justify-between pb-1">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-medium text-zinc-100 tracking-tight">Procesamiento Reciente</h3>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-900 text-zinc-400 border border-dashed border-[#444748]/50">
                {filteredInvoices.length} recientes
              </span>
            </div>

            <div className="inline-flex items-center p-1 rounded-full bg-zinc-900/80 border border-dashed border-[#444748]/50 text-xs">
              {['Todas', 'Desglosadas', 'En Proceso'].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setFilterType(tab)}
                  className={`px-3 py-1 rounded-full transition-colors cursor-pointer ${
                    filterType === tab
                      ? 'bg-zinc-800 text-zinc-100 font-medium shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-dashed border-[#444748]/50 bg-zinc-950/75 backdrop-blur-md divide-y divide-dashed divide-[#444748]/30 overflow-hidden shadow-sm">
            {filteredInvoices.map((inv) => {
              const isAnalyzed = inv.status === 'analyzed' || inv.status === 'reconciled';
              return (
                <div
                  key={inv.id}
                  onClick={() => onSelectInvoice(inv)}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-zinc-900/40 transition-colors group cursor-pointer"
                >
                  <div className="flex items-start sm:items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-dashed border-[#444748]/50 flex items-center justify-center text-zinc-300 shrink-0 group-hover:border-zinc-500 transition-colors">
                      <span className="material-symbols-outlined text-[20px]">receipt_long</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-zinc-100">{inv.invoice_number}</span>
                        <span className="text-zinc-500">•</span>
                        <span className="text-sm text-zinc-300 font-medium">{inv.supplier_name}</span>
                        {inv.supplier_tax_id && (
                          <span className="text-xs text-zinc-500 font-mono">(NIF: {inv.supplier_tax_id})</span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400 mt-1">
                        {inv.items_count || inv.items?.length || 1} partida{(inv.items_count || inv.items?.length || 1) === 1 ? '' : 's'} desglosada{(inv.items_count || inv.items?.length || 1) === 1 ? '' : 's'}
                        {inv.customer_name ? ` • Facturado a ${inv.customer_name}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-5 pl-14 sm:pl-0">
                    <div className="text-right">
                      <div className="text-sm font-medium text-zinc-100 font-mono">
                        {(inv.grand_total || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                      </div>
                      <div className="text-xs text-zinc-500">
                        Base: {(inv.subtotal || 0).toFixed(2)} € + IVA
                      </div>
                    </div>

                    {isAnalyzed ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-950/40 text-emerald-300 border border-emerald-800/40">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                        Desglosada
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-800/80 text-zinc-300 border border-zinc-700/50">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                        En proceso
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectInvoice(inv);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2a2a2c] hover:bg-[#353437] text-white text-xs font-medium border border-dashed border-[#444748]/50 transition-all cursor-pointer group/btn active:scale-95 shadow-sm"
                    >
                      <span>Ver desglose</span>
                      <span className="material-symbols-outlined text-[16px] group-hover/btn:translate-x-0.5 transition-transform">arrow_forward</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-500">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-zinc-600">verified_user</span>
              <span>Asientos balanceados bajo partida doble y algoritmo de verificación SHA-256</span>
            </div>
            <button
              onClick={onGoToHistory}
              className="text-zinc-400 hover:text-zinc-200 transition-colors inline-flex items-center gap-1 font-medium cursor-pointer"
            >
              <span>Ver todos los registros</span>
              <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
            </button>
          </div>
        </section>

      </div>
    </div>
  );
}
