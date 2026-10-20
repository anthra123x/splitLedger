import React, { useState, useEffect, useCallback } from 'react';
import { Invoice, CoactiveLiquidationResult, HistoricalRateTranche } from '../types/index.js';
import { calculateCoactiveInterest, recalculateInvoiceCoactiveInterest, fetchCoactiveRates } from '../services/api';

interface CoactiveLiquidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice;
  onLiquidationApplied?: (updatedInvoice: Invoice) => void;
}

export default function CoactiveLiquidationModal({
  isOpen,
  onClose,
  invoice,
  onLiquidationApplied,
}: CoactiveLiquidationModalProps) {
  const initialPrincipal = invoice?.coactive?.principal_amount || invoice?.subtotal || invoice?.grand_total || 1000;
  const initialDueDate = invoice?.due_date || invoice?.invoice_date || '2024-01-01';
  const initialRegime = (invoice?.coactive?.regime as 'dian_superfinanciera' | 'interes_demora_tributario') || 'dian_superfinanciera';

  const [principal, setPrincipal] = useState<number>(initialPrincipal);
  const [dueDate, setDueDate] = useState<string>(initialDueDate);
  const [calculationDate, setCalculationDate] = useState<string>(() => new Date().toISOString().substring(0, 10));
  const [regime, setRegime] = useState<'dian_superfinanciera' | 'interes_demora_tributario'>(initialRegime);
  const [penaltyPct, setPenaltyPct] = useState<number>(5.0);
  const [costsPct, setCostsPct] = useState<number>(3.0);

  const [activeTab, setActiveTab] = useState<'liquidation' | 'rates_table'>('liquidation');
  const [liquidation, setLiquidation] = useState<CoactiveLiquidationResult | null>(null);
  const [certifiedRates, setCertifiedRates] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isApplying, setIsApplying] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');

  const handleRunCalculation = useCallback(async () => {
    setIsLoading(true);
    setStatusMessage('');
    try {
      const res = await calculateCoactiveInterest({
        principal,
        due_date: dueDate,
        calculation_date: calculationDate,
        regime,
        penalty_percentage: penaltyPct,
        costs_percentage: costsPct,
      });
      if (res?.data) {
        setLiquidation(res.data);
      }
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message || 'No se pudo calcular la liquidación'}`);
    } finally {
      setIsLoading(false);
    }
  }, [principal, dueDate, calculationDate, regime, penaltyPct, costsPct]);

  // Handle ESC key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Initial calculation and rates loading when modal opens
  useEffect(() => {
    if (!isOpen) return;
    handleRunCalculation();
    fetchCoactiveRates().then((res) => {
      if (res?.data) setCertifiedRates(res.data);
    }).catch(() => null);
  }, [isOpen, handleRunCalculation]);

  const handleApplyToInvoice = async () => {
    if (!invoice?.id) return;
    setIsApplying(true);
    setStatusMessage('');
    try {
      const res = await recalculateInvoiceCoactiveInterest(invoice.id, {
        calculation_date: calculationDate,
        regime,
        penalty_percentage: penaltyPct,
        costs_percentage: costsPct,
      });

      if (res?.data?.coactive) {
        setStatusMessage('Liquidación guardada y aplicada en el expediente coactivo.');
        if (onLiquidationApplied) {
          const updated: Invoice = {
            ...invoice,
            coactive: {
              ...invoice.coactive,
              ...res.data.coactive,
            },
          };
          onLiquidationApplied(updated);
        }
        setTimeout(() => {
          onClose();
        }, 1200);
      }
    } catch (err: any) {
      setStatusMessage(`Error al aplicar: ${err.message}`);
    } finally {
      setIsApplying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-[#1c1b1d] border border-dashed border-[#444748]/60 rounded-2xl shadow-2xl overflow-hidden my-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-dashed border-[#444748]/50 bg-[#171618]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#201f22] border border-dashed border-[#444748]/60 flex items-center justify-center text-sky-400">
              <span className="material-symbols-outlined text-[20px]">calculate</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Motor de Intereses Moratorios Oficiales
                </h2>
                <span className="font-mono text-xs px-2 py-0.5 rounded-lg bg-sky-950/40 text-sky-300 border border-sky-800/40">
                  {invoice?.coactive?.expediente_number || `EXP-${invoice.id.substring(0, 8).toUpperCase()}`}
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Liquidación tramo a tramo con tablas históricas certificadas (DIAN / Superfinanciera / LGT)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-[#201f22] hover:bg-[#2a2a2c] text-zinc-400 hover:text-white border border-dashed border-[#444748]/50 flex items-center justify-center transition-colors cursor-pointer"
            title="Cerrar modal"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center justify-between px-5 py-2.5 bg-[#141315] border-b border-dashed border-[#444748]/40">
          <div className="inline-flex items-center p-0.5 rounded-lg bg-[#1c1b1d] border border-dashed border-[#444748]/50 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('liquidation')}
              className={`px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'liquidation'
                  ? 'bg-white text-zinc-950 font-semibold shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">balance</span>
              <span>Liquidación de Deuda</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('rates_table')}
              className={`px-3 py-1.5 rounded-md font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'rates_table'
                  ? 'bg-white text-zinc-950 font-semibold shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">table_chart</span>
              <span>Tablas Históricas Certificadas</span>
            </button>
          </div>

          {statusMessage && (
            <span className="text-xs font-mono text-emerald-300 animate-fade-in truncate max-w-sm">
              {statusMessage}
            </span>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5">
          {activeTab === 'liquidation' ? (
            <>
              {/* Parameter Settings Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-[#171618] p-4 rounded-xl border border-dashed border-[#444748]/50">
                <div>
                  <label className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block mb-1">
                    Deuda Principal (Capital €)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={principal}
                    onChange={(e) => setPrincipal(parseFloat(e.target.value) || 0)}
                    className="w-full bg-[#201f22] text-white text-xs font-mono font-semibold px-3 py-2 rounded-lg border border-dashed border-[#444748]/60 focus:outline-none focus:border-white/50"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block mb-1">
                    Fecha Exigibilidad (Vencimiento)
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full bg-[#201f22] text-white text-xs font-mono px-3 py-2 rounded-lg border border-dashed border-[#444748]/60 focus:outline-none focus:border-white/50"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block mb-1">
                    Fecha de Corte / Liquidación
                  </label>
                  <input
                    type="date"
                    value={calculationDate}
                    onChange={(e) => setCalculationDate(e.target.value)}
                    className="w-full bg-[#201f22] text-white text-xs font-mono px-3 py-2 rounded-lg border border-dashed border-[#444748]/60 focus:outline-none focus:border-white/50"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider block mb-1">
                    Régimen Oficial
                  </label>
                  <select
                    value={regime}
                    onChange={(e) => setRegime(e.target.value as any)}
                    className="w-full bg-[#201f22] text-white text-xs px-3 py-2 rounded-lg border border-dashed border-[#444748]/60 focus:outline-none focus:border-white/50 cursor-pointer"
                  >
                    <option value="dian_superfinanciera">DIAN / Superfinanciera (Colombia)</option>
                    <option value="interes_demora_tributario">Interés Demora LGT (España)</option>
                  </select>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 text-xs text-zinc-400">
                  <span className="flex items-center gap-1.5 font-mono">
                    <span>Sanción:</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="100"
                      value={penaltyPct}
                      onChange={(e) => setPenaltyPct(parseFloat(e.target.value) || 0)}
                      className="w-14 bg-[#201f22] text-white px-1.5 py-0.5 rounded border border-dashed border-[#444748]/60 text-center font-mono"
                    />
                    <span>%</span>
                  </span>

                  <span className="flex items-center gap-1.5 font-mono">
                    <span>Costas:</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="100"
                      value={costsPct}
                      onChange={(e) => setCostsPct(parseFloat(e.target.value) || 0)}
                      className="w-14 bg-[#201f22] text-white px-1.5 py-0.5 rounded border border-dashed border-[#444748]/60 text-center font-mono"
                    />
                    <span>%</span>
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleRunCalculation}
                  disabled={isLoading}
                  className="px-4 py-2 rounded-xl bg-[#2a2a2c] hover:bg-[#353437] text-white text-xs font-semibold border border-dashed border-[#444748]/60 inline-flex items-center gap-2 cursor-pointer transition-all active:scale-95 disabled:opacity-50 shadow-sm"
                >
                  <span className="material-symbols-outlined text-[16px] text-sky-400">sync</span>
                  <span>{isLoading ? 'Calculando tramos...' : 'Recalcular Liquidación'}</span>
                </button>
              </div>

              {/* KPI Summary Cards */}
              {liquidation && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-[#171618] p-3.5 rounded-xl border border-dashed border-[#444748]/50">
                    <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">
                      Días en Mora
                    </span>
                    <span className="text-xl font-bold font-mono text-white mt-0.5 block">
                      {liquidation.days_in_arrears} días
                    </span>
                    <span className="text-[10px] text-zinc-400 block mt-1">
                      Desde {liquidation.due_date}
                    </span>
                  </div>

                  <div className="bg-[#171618] p-3.5 rounded-xl border border-dashed border-[#444748]/50">
                    <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">
                      Tasa Media Ponderada
                    </span>
                    <span className="text-xl font-bold font-mono text-sky-400 mt-0.5 block">
                      {liquidation.weighted_annual_rate.toFixed(2)} % EA
                    </span>
                    <span className="text-[10px] text-zinc-400 block mt-1">
                      {liquidation.tranches.length} tramos oficiales
                    </span>
                  </div>

                  <div className="bg-[#171618] p-3.5 rounded-xl border border-dashed border-[#444748]/50">
                    <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider block">
                      Intereses de Mora
                    </span>
                    <span className="text-xl font-bold font-mono text-amber-400 mt-0.5 block">
                      {liquidation.interest_amount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                    </span>
                    <span className="text-[10px] text-zinc-400 block mt-1">
                      Interés diario simple
                    </span>
                  </div>

                  <div className="bg-[#171618] p-3.5 rounded-xl border border-dashed border-sky-800/40 bg-sky-950/20">
                    <span className="text-[10px] font-mono text-sky-300 uppercase tracking-wider block font-semibold">
                      Total Crédito Coactivo
                    </span>
                    <span className="text-xl font-bold font-mono text-white mt-0.5 block">
                      {liquidation.total_coactive_debt.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
                    </span>
                    <span className="text-[10px] text-zinc-400 block mt-1">
                      Cap + Mora + Sanc + Cost
                    </span>
                  </div>
                </div>
              )}

              {/* Tranches Breakdown Table */}
              {liquidation && liquidation.tranches.length > 0 && (
                <div className="bg-[#171618] rounded-xl border border-dashed border-[#444748]/50 overflow-hidden">
                  <div className="px-4 py-2.5 bg-[#201f22]/70 border-b border-dashed border-[#444748]/50 flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">
                      Desglose Cronológico por Tramos Oficiales
                    </span>
                    <span className="text-[10px] font-mono text-zinc-400">
                      {liquidation.tranches.length} periodos aplicados
                    </span>
                  </div>

                  <div className="overflow-x-auto max-h-56">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-[#141315] border-b border-dashed border-[#444748]/40 text-zinc-400 font-mono text-[11px]">
                          <th className="py-2 px-3">Periodo / Resolución</th>
                          <th className="py-2 px-3">Vigencia Tramo</th>
                          <th className="py-2 px-3 text-center">Días</th>
                          <th className="py-2 px-3 text-right">Tasa EA</th>
                          <th className="py-2 px-3 text-right">Tasa Diaria</th>
                          <th className="py-2 px-3 text-right">Interés Causado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#444748]/30 font-mono">
                        {liquidation.tranches.map((t: HistoricalRateTranche) => (
                          <tr key={t.period_id} className="hover:bg-[#201f22]/50 transition-colors">
                            <td className="py-2 px-3 text-white">
                              <div className="flex flex-col">
                                <span className="font-semibold">{t.period_label}</span>
                                <span className="text-[10px] text-zinc-400 font-sans truncate max-w-xs" title={t.resolution_reference}>
                                  {t.resolution_reference}
                                </span>
                              </div>
                            </td>
                            <td className="py-2 px-3 text-zinc-300 whitespace-nowrap">
                              {t.start_date} <span className="text-zinc-600">→</span> {t.end_date}
                            </td>
                            <td className="py-2 px-3 text-center text-zinc-200">
                              {t.days}
                            </td>
                            <td className="py-2 px-3 text-right text-sky-400 font-semibold">
                              {t.effective_annual_rate.toFixed(2)} %
                            </td>
                            <td className="py-2 px-3 text-right text-zinc-400 text-[11px]">
                              {(t.daily_rate * 100).toFixed(4)} %
                            </td>
                            <td className="py-2 px-3 text-right text-amber-300 font-bold">
                              {t.interest_accrued.toFixed(2)} €
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-[#201f22] font-semibold border-t border-dashed border-[#444748]/60 text-white font-mono">
                          <td colSpan={2} className="py-2 px-3 uppercase text-[10px] text-zinc-400">
                            Total Intereses Moratorios Acumulados:
                          </td>
                          <td className="py-2 px-3 text-center text-zinc-200">
                            {liquidation.days_in_arrears}
                          </td>
                          <td className="py-2 px-3 text-right text-sky-300">
                            {liquidation.weighted_annual_rate.toFixed(2)} %
                          </td>
                          <td className="py-2 px-3"></td>
                          <td className="py-2 px-3 text-right text-amber-300 font-bold">
                            {liquidation.interest_amount.toFixed(2)} €
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* Legal Framework Alert */}
              {liquidation && (
                <div className="bg-[#141315] p-3.5 rounded-xl border border-dashed border-[#444748]/40 text-xs text-zinc-400 flex items-start gap-2.5">
                  <span className="material-symbols-outlined text-[18px] text-sky-400 shrink-0 mt-0.5">verified</span>
                  <div className="space-y-1">
                    <span className="text-white font-semibold block">Fundamento Legal y Metodología Oficial:</span>
                    <p className="leading-relaxed text-[11px]">
                      {liquidation.legal_framework}
                    </p>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Historical Rates Reference Tab */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">
                  Tabla de tasas moratorias históricas vigentes en el sistema para liquidaciones automáticas:
                </span>
                <span className="text-[11px] font-mono text-zinc-400 px-2 py-0.5 rounded bg-[#201f22] border border-dashed border-[#444748]/50">
                  Años 2021 a 2026
                </span>
              </div>

              {certifiedRates ? (
                <div className="space-y-5">
                  {/* DIAN Table */}
                  <div className="bg-[#171618] rounded-xl border border-dashed border-[#444748]/50 overflow-hidden">
                    <div className="px-4 py-2.5 bg-[#201f22]/70 border-b border-dashed border-[#444748]/50 font-semibold text-xs text-sky-300 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px]">account_balance</span>
                      <span>Régimen DIAN / Superintendencia Financiera (Colombia)</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs font-mono">
                        <thead>
                          <tr className="bg-[#141315] text-zinc-400 text-[10px] uppercase">
                            <th className="py-2 px-3">Periodo</th>
                            <th className="py-2 px-3">Vigencia</th>
                            <th className="py-2 px-3 text-right">Tasa Efectiva Anual (EA)</th>
                            <th className="py-2 px-3 text-right">Tasa Diaria</th>
                            <th className="py-2 px-3">Resolución Oficial</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#444748]/30">
                          {certifiedRates.dian_superfinanciera?.map((r: any) => (
                            <tr key={r.id} className="hover:bg-[#201f22]/50">
                              <td className="py-1.5 px-3 font-semibold text-white">{r.period_label}</td>
                              <td className="py-1.5 px-3 text-zinc-400 text-[11px]">{r.start_date} al {r.end_date}</td>
                              <td className="py-1.5 px-3 text-right text-sky-400 font-bold">{r.effective_annual_rate}%</td>
                              <td className="py-1.5 px-3 text-right text-zinc-300">{(r.daily_rate * 100).toFixed(4)}%</td>
                              <td className="py-1.5 px-3 text-zinc-400 font-sans text-[11px] truncate max-w-xs">{r.resolution_reference}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Spain LGT Table */}
                  <div className="bg-[#171618] rounded-xl border border-dashed border-[#444748]/50 overflow-hidden">
                    <div className="px-4 py-2.5 bg-[#201f22]/70 border-b border-dashed border-[#444748]/50 font-semibold text-xs text-amber-300 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px]">gavel</span>
                      <span>Régimen Interés de Demora Tributario - Ley General Tributaria (España)</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs font-mono">
                        <thead>
                          <tr className="bg-[#141315] text-zinc-400 text-[10px] uppercase">
                            <th className="py-2 px-3">Periodo</th>
                            <th className="py-2 px-3">Vigencia</th>
                            <th className="py-2 px-3 text-right">Tasa Efectiva Anual (EA)</th>
                            <th className="py-2 px-3 text-right">Tasa Diaria</th>
                            <th className="py-2 px-3">Base Legal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#444748]/30">
                          {certifiedRates.interes_demora_tributario?.map((r: any) => (
                            <tr key={r.id} className="hover:bg-[#201f22]/50">
                              <td className="py-1.5 px-3 font-semibold text-white">{r.period_label}</td>
                              <td className="py-1.5 px-3 text-zinc-400 text-[11px]">{r.start_date} al {r.end_date}</td>
                              <td className="py-1.5 px-3 text-right text-amber-400 font-bold">{r.effective_annual_rate}%</td>
                              <td className="py-1.5 px-3 text-right text-zinc-300">{(r.daily_rate * 100).toFixed(4)}%</td>
                              <td className="py-1.5 px-3 text-zinc-400 font-sans text-[11px] truncate max-w-xs">{r.resolution_reference}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-zinc-400 text-xs font-mono">
                  Cargando tablas certificadas del motor de cálculo...
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-[#171618] border-t border-dashed border-[#444748]/50">
          <div className="text-xs text-zinc-400">
            {liquidation && (
              <span className="font-mono">
                Deuda consolidada: <strong className="text-white">{liquidation.total_coactive_debt.toFixed(2)} €</strong>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-[#201f22] hover:bg-[#2a2a2c] text-zinc-300 text-xs font-semibold border border-dashed border-[#444748]/60 cursor-pointer transition-colors"
            >
              Cerrar
            </button>

            {activeTab === 'liquidation' && (
              <button
                type="button"
                onClick={handleApplyToInvoice}
                disabled={isApplying || !liquidation}
                className="px-4 py-2 rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 active:scale-95 text-xs font-semibold shadow-md inline-flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                <span>{isApplying ? 'Guardando en expediente...' : 'Aplicar Liquidación a Factura'}</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
