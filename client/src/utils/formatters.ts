/**
 * Utility formatters for invoice display across SplitLedger
 * Keeps views compact, clean, and free of redundant raw OCR artifacts.
 */

export function cleanSupplierName(raw?: string): string {
  if (!raw) return 'Proveedor General';
  let clean = raw.trim();

  // Remove leading labels like "PROVEEDOR |", "PROVEEDOR:", "PROVEEDOR\t", "EMISOR |", "Proveedor: "
  clean = clean.replace(/^(proveedor|emisor|supplier|issuer)[\s:|.\t-]+/i, '');

  // Remove trailing pipe separators with NIF/CIF/VAT/TAX ID and its value (e.g., "| NIF | A80907397")
  clean = clean.replace(/[\s|,\t-]+(?:nif|cif|vat|tax\s*id|id)[\s:|.\t-]+[A-Z0-9-]+$/i, '');

  // Remove parenthesized NIF like "(NIF: A80907397)"
  clean = clean.replace(/\s*\((?:nif|cif|vat|tax\s*id)[\s:|.\t-]*[A-Z0-9-]+\)/gi, '');

  // Clean any remaining trailing or leading pipes, colons, or dashes
  clean = clean.replace(/^[\s|:\-_]+|[\s|:\-_]+$/g, '').trim();

  return clean || raw.trim();
}

export function cleanSupplierTaxId(rawSupplier?: string, existingTaxId?: string): string {
  if (existingTaxId && existingTaxId.trim() && existingTaxId.trim() !== 'N/D') {
    return existingTaxId.trim();
  }
  if (!rawSupplier) return '';
  const match = rawSupplier.match(/(?:nif|cif|vat|tax\s*id)[\s:|.\t-]+([A-Z0-9-]+)/i);
  return match ? match[1].trim() : '';
}

export function formatCurrency(amount?: number): string {
  return (amount || 0).toLocaleString('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) + ' €';
}
