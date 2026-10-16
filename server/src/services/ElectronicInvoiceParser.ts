import { DecomposedInvoiceResult } from './AiDecompositionService.js';
import { InvoiceItem } from '../types/index.js';
import { AccountingRulesService } from './AccountingRulesService.js';

export class ElectronicInvoiceParser {
  /**
   * Detects if raw content represents an electronic invoice (Facturae XML or UBL XML)
   */
  static isElectronicInvoice(rawText: string): boolean {
    if (!rawText) return false;
    const trimmed = rawText.trim();
    return (
      trimmed.includes('<fe:Facturae') ||
      trimmed.includes('<Facturae') ||
      trimmed.includes('<Invoice') ||
      trimmed.includes('<ubl:Invoice') ||
      trimmed.includes('<rsm:CrossIndustryInvoice')
    );
  }

  /**
   * Direct high-precision deterministic parsing of XML e-invoices
   */
  static parse(rawText: string, originalName: string): DecomposedInvoiceResult | null {
    try {
      if (rawText.includes('<fe:Facturae') || rawText.includes('<Facturae')) {
        return this.parseFacturae(rawText, originalName);
      }
      if (rawText.includes('<Invoice') || rawText.includes('<ubl:Invoice')) {
        return this.parseUbl(rawText, originalName);
      }
    } catch (err: any) {
      console.warn('XML e-invoice parsing failed, falling back:', err.message);
    }
    return null;
  }

  private static getTagValue(xml: string, tag: string): string {
    const regex = new RegExp(`<(?:[a-zA-Z0-9]+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9]+:)?${tag}>`, 'i');
    const match = xml.match(regex);
    if (!match) return '';
    return match[1].replace(/<[^>]+>/g, ' ').trim();
  }

  private static getTagValues(xml: string, tag: string): string[] {
    const regex = new RegExp(`<(?:[a-zA-Z0-9]+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:[a-zA-Z0-9]+:)?${tag}>`, 'gi');
    const matches: string[] = [];
    let m;
    while ((m = regex.exec(xml)) !== null) {
      matches.push(m[1].trim());
    }
    return matches;
  }

  private static parseFacturae(xml: string, originalName: string): DecomposedInvoiceResult {
    // 1. Emisor (Seller)
    const sellerPartyXml = this.getTagValue(xml, 'SellerParty') || this.getTagValue(xml, 'Parties');
    const supplierTaxId = this.getTagValue(sellerPartyXml, 'TaxIdentificationNumber') || 'B00000000';
    const supplierName =
      this.getTagValue(sellerPartyXml, 'CorporateName') ||
      `${this.getTagValue(sellerPartyXml, 'Name')} ${this.getTagValue(sellerPartyXml, 'FirstSurname')}`.trim() ||
      'Proveedor Facturae';
    const supplierAddress = [
      this.getTagValue(sellerPartyXml, 'Address'),
      this.getTagValue(sellerPartyXml, 'PostCode'),
      this.getTagValue(sellerPartyXml, 'Town')
    ].filter(Boolean).join(', ');

    // 2. Receptor (Buyer)
    const buyerPartyXml = this.getTagValue(xml, 'BuyerParty');
    const customerTaxId = this.getTagValue(buyerPartyXml, 'TaxIdentificationNumber') || 'ESB87219034';
    const customerName =
      this.getTagValue(buyerPartyXml, 'CorporateName') ||
      `${this.getTagValue(buyerPartyXml, 'Name')} ${this.getTagValue(buyerPartyXml, 'FirstSurname')}`.trim() ||
      'Cliente Facturae';
    const customerAddress = [
      this.getTagValue(buyerPartyXml, 'Address'),
      this.getTagValue(buyerPartyXml, 'PostCode'),
      this.getTagValue(buyerPartyXml, 'Town')
    ].filter(Boolean).join(', ');

    // 3. Cabecera Factura
    const invoiceNumber = this.getTagValue(xml, 'InvoiceNumber') || `FAC-${Date.now().toString().slice(-6)}`;
    const issueDate = this.getTagValue(xml, 'IssueDate') || new Date().toISOString().split('T')[0];
    const currency = this.getTagValue(xml, 'InvoiceCurrencyCode') || 'EUR';

    // 4. Totales
    const invoiceTotalsXml = this.getTagValue(xml, 'InvoiceTotals');
    const totalGross = parseFloat(this.getTagValue(invoiceTotalsXml, 'TotalGrossAmountBeforeTaxes') || this.getTagValue(invoiceTotalsXml, 'TotalGrossAmount')) || 0;
    const totalTax = parseFloat(this.getTagValue(invoiceTotalsXml, 'TotalTaxOutputs')) || 0;
    const totalWithheld = parseFloat(this.getTagValue(invoiceTotalsXml, 'TotalWithheldTaxes')) || 0;
    const grandTotal = parseFloat(this.getTagValue(invoiceTotalsXml, 'InvoiceTotal')) || (totalGross + totalTax - totalWithheld);

    // 5. Partidas (Invoice Lines)
    const lineBlocks = this.getTagValues(xml, 'InvoiceLine');
    const items: InvoiceItem[] = [];

    lineBlocks.forEach((lineXml, idx) => {
      const concept = this.getTagValue(lineXml, 'ItemDescription') || `Partida Facturae ${idx + 1}`;
      const qty = parseFloat(this.getTagValue(lineXml, 'Quantity')) || 1;
      const unitPrice = parseFloat(this.getTagValue(lineXml, 'UnitPriceWithoutTax')) || 0;
      const baseAmt = parseFloat(this.getTagValue(lineXml, 'TotalCost')) || (qty * unitPrice);

      const taxOutputsXml = this.getTagValue(lineXml, 'TaxesOutputs') || lineXml;
      const taxRate = parseFloat(this.getTagValue(taxOutputsXml, 'TaxRate')) || 21;
      const taxAmount = parseFloat(this.getTagValue(taxOutputsXml, 'TaxAmount')) || Number((baseAmt * (taxRate / 100)).toFixed(2));
      const lineTotal = baseAmt + taxAmount;

      const matched = AccountingRulesService.matchAccountAndCenter(concept, supplierName);

      items.push({
        item_index: idx + 1,
        concept,
        account_code: matched.account_code,
        account_name: matched.account_name,
        cost_center: matched.cost_center,
        quantity: qty,
        unit_price: unitPrice || baseAmt,
        base_amount: baseAmt,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total_amount: lineTotal,
        notes: `Facturae XML Schema v3.2 Línea #${idx + 1}`,
        bounding_box: { x: 20, y: 130 + idx * 45, w: 380, h: 42, confidence: 99.9 }
      });
    });

    // Si no había líneas separadas pero hay total bruto
    if (items.length === 0 && (totalGross > 0 || grandTotal > 0)) {
      const base = totalGross > 0 ? totalGross : Number((grandTotal / 1.21).toFixed(2));
      const tax = totalTax > 0 ? totalTax : Number((grandTotal - base).toFixed(2));
      const matched = AccountingRulesService.matchAccountAndCenter('Servicios Facturae', supplierName);
      items.push({
        item_index: 1,
        concept: 'Servicios facturados según Facturae XML',
        account_code: matched.account_code,
        account_name: matched.account_name,
        cost_center: matched.cost_center,
        quantity: 1,
        unit_price: base,
        base_amount: base,
        tax_rate: 21,
        tax_amount: tax,
        total_amount: grandTotal,
        notes: 'Generado desde totales del XML Facturae',
        bounding_box: { x: 20, y: 140, w: 380, h: 45, confidence: 99.9 }
      });
    }

    return {
      invoice_number: invoiceNumber,
      supplier_name: supplierName,
      supplier_tax_id: supplierTaxId,
      supplier_address: supplierAddress,
      customer_name: customerName,
      customer_tax_id: customerTaxId,
      customer_address: customerAddress,
      invoice_date: issueDate,
      due_date: this.getTagValue(xml, 'DueDate') || '',
      currency,
      subtotal: totalGross,
      tax_total: totalTax,
      retention_total: totalWithheld,
      grand_total: grandTotal,
      confidence_score: 0.999,
      items
    };
  }

  private static parseUbl(xml: string, originalName: string): DecomposedInvoiceResult {
    const invoiceNumber = this.getTagValue(xml, 'ID') || `UBL-${Date.now().toString().slice(-6)}`;
    const issueDate = this.getTagValue(xml, 'IssueDate') || new Date().toISOString().split('T')[0];
    const currency = this.getTagValue(xml, 'DocumentCurrencyCode') || 'EUR';

    // Supplier
    const supplierParty = this.getTagValue(xml, 'AccountingSupplierParty');
    const supplierName = this.getTagValue(supplierParty, 'RegistrationName') || this.getTagValue(supplierParty, 'Name') || 'Proveedor UBL';
    const supplierTaxId = this.getTagValue(supplierParty, 'CompanyID') || this.getTagValue(supplierParty, 'ID') || 'LU00000000';

    // Customer
    const customerParty = this.getTagValue(xml, 'AccountingCustomerParty');
    const customerName = this.getTagValue(customerParty, 'RegistrationName') || this.getTagValue(customerParty, 'Name') || 'SplitLedger Engineering Labs S.L.';
    const customerTaxId = this.getTagValue(customerParty, 'CompanyID') || this.getTagValue(customerParty, 'ID') || 'ESB87219034';

    // Monetary Totals
    const legalMonetary = this.getTagValue(xml, 'LegalMonetaryTotal');
    const subtotal = parseFloat(this.getTagValue(legalMonetary, 'LineExtensionAmount') || this.getTagValue(legalMonetary, 'TaxExclusiveAmount')) || 0;
    const grandTotal = parseFloat(this.getTagValue(legalMonetary, 'PayableAmount') || this.getTagValue(legalMonetary, 'TaxInclusiveAmount')) || subtotal;

    const taxTotalXml = this.getTagValue(xml, 'TaxTotal');
    const taxTotal = parseFloat(this.getTagValue(taxTotalXml, 'TaxAmount')) || 0;

    // Lines
    const lineBlocks = this.getTagValues(xml, 'InvoiceLine');
    const items: InvoiceItem[] = [];

    lineBlocks.forEach((lXml, idx) => {
      const concept = this.getTagValue(lXml, 'Description') || this.getTagValue(lXml, 'Name') || `Línea UBL #${idx + 1}`;
      const qty = parseFloat(this.getTagValue(lXml, 'InvoicedQuantity')) || 1;
      const baseAmt = parseFloat(this.getTagValue(lXml, 'LineExtensionAmount')) || 0;
      const priceXml = this.getTagValue(lXml, 'Price');
      const unitPrice = parseFloat(this.getTagValue(priceXml, 'PriceAmount')) || (qty > 0 ? baseAmt / qty : baseAmt);

      const taxRate = parseFloat(this.getTagValue(lXml, 'Percent')) || (subtotal > 0 && taxTotal > 0 ? Number(((taxTotal / subtotal) * 100).toFixed(0)) : 0);
      const taxAmount = Number((baseAmt * (taxRate / 100)).toFixed(2));
      const lineTotal = baseAmt + taxAmount;

      const matched = AccountingRulesService.matchAccountAndCenter(concept, supplierName);

      items.push({
        item_index: idx + 1,
        concept,
        account_code: matched.account_code,
        account_name: matched.account_name,
        cost_center: matched.cost_center,
        quantity: qty,
        unit_price: unitPrice,
        base_amount: baseAmt,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        total_amount: lineTotal,
        notes: `UBL 2.1 e-Invoice Item #${idx + 1}`,
        bounding_box: { x: 20, y: 130 + idx * 45, w: 380, h: 42, confidence: 99.8 }
      });
    });

    return {
      invoice_number: invoiceNumber,
      supplier_name: supplierName,
      supplier_tax_id: supplierTaxId,
      customer_name: customerName,
      customer_tax_id: customerTaxId,
      invoice_date: issueDate,
      currency,
      subtotal,
      tax_total: taxTotal,
      retention_total: 0,
      grand_total: grandTotal,
      confidence_score: 0.998,
      items
    };
  }
}
