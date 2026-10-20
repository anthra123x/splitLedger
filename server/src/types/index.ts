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
  coactive?: CoactiveData | null;
}

export type CoactiveStage = 'persuasivo' | 'mandamiento' | 'medidas_cautelares' | 'acuerdo_pago' | 'recaudado';

export type CoactiveDocumentType = 'titulo_ejecutivo' | 'mandamiento_pago' | 'acuerdo_pago' | 'factura_coactiva';

export interface CoactiveData {
  stage: CoactiveStage;
  document_type: CoactiveDocumentType;
  expediente_number: string;
  fiscal_year: string;
  debtor_name: string;
  debtor_tax_id: string;
  creditor_name: string;
  principal_amount: number;
  interest_amount: number;
  penalty_amount: number;
  costs_amount: number;
  collected_amount: number;
  pending_balance: number;
  last_action_date?: string;
  notes?: string;
}

export interface CoactiveMetrics {
  total_portfolio: number;
  total_collected: number;
  recovery_rate: number;
  pending_balance: number;
  principal_sum: number;
  interest_sum: number;
  penalty_sum: number;
  costs_sum: number;
  stages_distribution: {
    persuasivo: number;
    mandamiento: number;
    medidas_cautelares: number;
    acuerdo_pago: number;
    recaudado: number;
  };
}

export interface SystemMetrics {
  total_invoices: number;
  reconciled_volume: number;
  total_items: number;
  avg_confidence: string;
  coactive?: CoactiveMetrics;
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
