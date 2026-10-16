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
  unit_price: number;
  base_amount: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  bounding_box?: BoundingBox | null;
  notes?: string;
  created_at?: string;
}

export interface Invoice {
  id: string;
  filename: string;
  original_name: string;
  file_path: string;
  mime_type: string;
  file_size: number;
  invoice_number: string;
  supplier_name: string;
  supplier_tax_id: string;
  supplier_address?: string;
  customer_name?: string;
  customer_tax_id?: string;
  customer_address?: string;
  invoice_date: string;
  due_date?: string;
  currency: string;
  subtotal: number;
  tax_total: number;
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
}

export interface SystemMetrics {
  total_invoices: number;
  reconciled_volume: number;
  total_items: number;
  avg_confidence: string;
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
