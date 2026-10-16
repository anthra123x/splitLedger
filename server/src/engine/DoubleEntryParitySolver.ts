import { InvoiceItem } from '../types/index.js';

export interface ParityReconcileResult {
  isBalanced: boolean;
  subtotal: number;
  tax_total: number;
  retention_total: number;
  grand_total: number;
  items: InvoiceItem[];
  auditLog: string[];
  discrepancy: number;
  parityScore: number;
}

export class DoubleEntryParitySolver {
  static reconcile(invoiceData: any): ParityReconcileResult {
    const items: InvoiceItem[] = [...(invoiceData.items || [])];
    let subtotal = parseFloat(invoiceData.subtotal) || 0;
    let taxTotal = parseFloat(invoiceData.tax_total) || 0;
    const retentionTotal = parseFloat(invoiceData.retention_total) || 0;
    let grandTotal = parseFloat(invoiceData.grand_total) || 0;

    const sumBase = Number(items.reduce((acc, it) => acc + (parseFloat(it.base_amount as any) || 0), 0).toFixed(2));
    const sumTax = Number(items.reduce((acc, it) => acc + (parseFloat(it.tax_amount as any) || 0), 0).toFixed(2));
    const sumTotal = Number(items.reduce((acc, it) => acc + (parseFloat(it.total_amount as any) || 0), 0).toFixed(2));

    if (subtotal === 0 && sumBase > 0) subtotal = sumBase;
    if (taxTotal === 0 && sumTax > 0) taxTotal = sumTax;
    if (grandTotal === 0 && sumTotal > 0) {
      grandTotal = Number((sumBase + sumTax - retentionTotal).toFixed(2));
    }

    const auditLog: string[] = [];
    let isBalanced = true;

    // Harmonize subtotal if sumBase is accurate and matches grandTotal formula
    if (Math.abs(sumBase - subtotal) > 0.05 && sumBase > 0) {
      const candidateGrand = Number((sumBase + taxTotal - retentionTotal).toFixed(2));
      if (Math.abs(candidateGrand - grandTotal) <= 0.05) {
        auditLog.push(`Armonización de base imponible ajustada a la suma de partidas: ${subtotal} € -> ${sumBase} €`);
        subtotal = sumBase;
      }
    }

    // Cent rounding distribution in base amounts (up to 0.05 €)
    const deltaBase = Number((sumBase - subtotal).toFixed(2));
    if (Math.abs(deltaBase) > 0 && Math.abs(deltaBase) <= 0.05 && items.length > 0) {
      auditLog.push(`Ajuste de redondeo de céntimos en base imponible: Δ ${deltaBase > 0 ? '+' : ''}${deltaBase} € distribuido`);
      const maxItem = items.reduce((prev, curr) => (curr.base_amount > prev.base_amount ? curr : prev), items[0]);
      maxItem.base_amount = Number((maxItem.base_amount - deltaBase).toFixed(2));
      maxItem.total_amount = Number((maxItem.base_amount + (maxItem.tax_amount || 0)).toFixed(2));
    } else if (Math.abs(deltaBase) > 0.05) {
      isBalanced = false;
      auditLog.push(`Discrepancia en sumatorio de partidas vs base imponible declarada: Δ ${deltaBase} €`);
    }

    // Cent rounding distribution in tax amounts (up to 0.05 €)
    const deltaTax = Number((sumTax - taxTotal).toFixed(2));
    if (Math.abs(deltaTax) > 0 && Math.abs(deltaTax) <= 0.05 && items.length > 0) {
      auditLog.push(`Ajuste de redondeo de céntimos en cuotas de IVA: Δ ${deltaTax > 0 ? '+' : ''}${deltaTax} €`);
      const maxItem = items.reduce((prev, curr) => (curr.tax_amount > prev.tax_amount ? curr : prev), items[0]);
      maxItem.tax_amount = Number((maxItem.tax_amount - deltaTax).toFixed(2));
      maxItem.total_amount = Number((maxItem.base_amount + maxItem.tax_amount).toFixed(2));
    }

    // Cuadratura de Liquidación: Base + IVA - Retención == Total
    const expectedGrand = Number((subtotal + taxTotal - retentionTotal).toFixed(2));
    const deltaGrand = Number((expectedGrand - grandTotal).toFixed(2));

    if (Math.abs(deltaGrand) <= 0.05) {
      grandTotal = expectedGrand;
      auditLog.push('Cuadratura matemática de liquidación verificada al 100% (Partida doble balanceada: Base + IVA - Retención = Total).');
    } else {
      isBalanced = false;
      auditLog.push(`Alerta de cuadratura: Base (${subtotal} €) + IVA (${taxTotal} €) - Retención (${retentionTotal} €) = ${expectedGrand} € != Declarado (${grandTotal} €)`);
    }

    const discrepancy = Math.abs(deltaGrand);
    const parityScore = isBalanced ? 1.0 : Math.max(0.7, 1.0 - (discrepancy / (grandTotal || 1)));

    return {
      isBalanced,
      subtotal,
      tax_total: taxTotal,
      retention_total: retentionTotal,
      grand_total: grandTotal,
      items,
      auditLog,
      discrepancy,
      parityScore
    };
  }
}
