export type InvoiceStatus = 'pending' | 'processing' | 'analyzed' | 'reconciled' | 'error';

export interface BoundingBox {
  x: number;
  y: number;
  w: number;
  h: number;
  confidence: number;
}

export interface InvoiceItem {
  id?: string;
  invoice_id?: string;
  item_index: number;
  concept: string;
  account_code: string;
  account_name: string;
  cost_center: string;
  quantity: number;
  unit?: string;
  unit_price: number;
  discount_amount?: number;
  base_amount: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  bounding_box?: BoundingBox | null;
  notes?: string;
  created_at?: string;
}

export interface JournalEntryLine {
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
}

export interface DoubleEntrySeat {
  seat_number: number;
  date: string;
  concept: string;
  lines: JournalEntryLine[];
  total_debit: number;
  total_credit: number;
  is_balanced: boolean;
}

export interface TaxBreakdownItem {
  tax_rate: number;
  base_amount: number;
  tax_amount: number;
  surcharge_rate?: number;
  surcharge_amount?: number;
}

export interface TaxIdValidation {
  is_valid: boolean;
  entity_type: string;
  diagnostic_message: string;
}

export interface TemporalAnalysis {
  normalized_invoice_date: string;
  normalized_due_date?: string;
  payment_terms_days: number;
  is_overdue: boolean;
  days_overdue: number;
  diagnostic_message: string;
}

export interface CurrencyConversion {
  is_foreign: boolean;
  source_currency: string;
  target_currency: string;
  exchange_rate: number;
  exchange_date: string;
  source_grand_total: number;
  converted_total_eur: number;
  regulation?: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  color?: string;
  icon?: string;
  is_archived?: boolean;
  invoices_count?: number;
  total_volume?: number | string;
  created_at?: string;
  updated_at?: string;
}

export interface Invoice {
  id: string;
  workspace_id?: string | null;
  workspace?: Workspace | null;
  filename: string;
  original_name: string;
  file_path: string;
  mime_type: string;
  file_size: number;
  invoice_number: string;
  supplier_name: string;
  supplier_tax_id: string;
  supplier_address?: string;
  supplier_postal_code?: string;
  supplier_city?: string;
  supplier_email?: string;
  supplier_phone?: string;
  customer_name?: string;
  customer_tax_id?: string;
  customer_address?: string;
  customer_postal_code?: string;
  customer_city?: string;
  customer_email?: string;
  customer_phone?: string;
  invoice_date: string;
  due_date?: string;
  payment_method?: string;
  iban?: string;
  currency: string;
  subtotal: number;
  tax_total: number;
  surcharge_total?: number;
  retention_total: number;
  grand_total: number;
  status: InvoiceStatus;
  confidence_score: number;
  raw_ocr_text?: string;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
  items?: InvoiceItem[];
  items_count?: number;
  journal_entry?: DoubleEntrySeat | null;
  tax_breakdown?: TaxBreakdownItem[];
  thinking_process?: string | null;
  tax_id_validation?: TaxIdValidation | null;
  temporal_analysis?: TemporalAnalysis | null;
  currency_conversion?: CurrencyConversion | null;
}

export interface SystemMetrics {
  total_invoices?: number;
  reconciled_volume?: number;
  total_items?: number;
  avg_confidence?: string;
}

export interface EngineStats {
  totalSubmitted: number;
  totalCompleted: number;
  totalFailed: number;
  avgProcessingTimeMs: number;
  queuedJobs: number;
  activeWorkers: number;
  concurrency: number;
  engineVersion: string;
  architecture: string;
}

export interface AccountingAccount {
  code: string;
  name: string;
}
