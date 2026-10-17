import { Invoice, SystemMetrics, EngineStats, Workspace } from '../types/index.js';

const API_BASE = '/api';

export interface FetchInvoicesParams {
  search?: string;
  status?: string;
  workspace_id?: string;
  page?: number;
  limit?: number;
}

export interface InvoicesResponse {
  status: string;
  data: {
    invoices: Invoice[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

export async function fetchInvoices({ search = '', status = '', workspace_id = '', page = 1, limit = 50 }: FetchInvoicesParams = {}): Promise<InvoicesResponse> {
  const query = new URLSearchParams();
  if (search) query.append('search', search);
  if (status && status !== 'Todas' && status !== 'all') query.append('status', status);
  if (workspace_id) query.append('workspace_id', workspace_id);
  query.append('page', String(page));
  query.append('limit', String(limit));

  const res = await fetch(`${API_BASE}/invoices?${query.toString()}`);
  if (!res.ok) throw new Error('Error al cargar facturas');
  return res.json();
}

export async function fetchInvoiceById(id: string): Promise<{ status: string; data: Invoice }> {
  const res = await fetch(`${API_BASE}/invoices/${id}`);
  if (!res.ok) throw new Error('Factura no encontrada');
  return res.json();
}

export async function uploadInvoice(file: File): Promise<{ status: string; data: Invoice; meta?: any }> {
  const formData = new FormData();
  formData.append('invoice', file);

  const res = await fetch(`${API_BASE}/invoices/upload`, {
    method: 'POST',
    body: formData
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Error al procesar y descomponer la factura');
  }

  return res.json();
}

export async function uploadInvoicesBatch(files: File[] | FileList): Promise<{ status: string; data: Invoice | Invoice[]; count?: number; meta?: any }> {
  const formData = new FormData();
  for (let i = 0; i < files.length; i++) {
    formData.append('invoices[]', files[i]);
  }

  const res = await fetch(`${API_BASE}/invoices/upload`, {
    method: 'POST',
    body: formData
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Error al procesar el lote de facturas');
  }

  return res.json();
}

export async function updateInvoice(id: string, data: Partial<Invoice>): Promise<{ status: string; data: Invoice }> {
  const res = await fetch(`${API_BASE}/invoices/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (!res.ok) throw new Error('Error al actualizar la factura');
  return res.json();
}

export async function deleteInvoice(id: string): Promise<{ status: string; message: string }> {
  const res = await fetch(`${API_BASE}/invoices/${id}`, {
    method: 'DELETE'
  });

  if (!res.ok) throw new Error('Error al eliminar la factura');
  return res.json();
}

export async function fetchMetrics(): Promise<{ status: string; data: SystemMetrics }> {
  const res = await fetch(`${API_BASE}/metrics`);
  if (!res.ok) throw new Error('Error al obtener métricas');
  return res.json();
}

export async function fetchAccountingRules(): Promise<{ status: string; data: { accounts: any[]; cost_centers: string[] } }> {
  const res = await fetch(`${API_BASE}/invoices/rules`);
  if (!res.ok) throw new Error('Error al obtener reglas contables');
  return res.json();
}

export async function fetchEngineStats(): Promise<{ status: string; data: EngineStats }> {
  const res = await fetch(`${API_BASE}/engine/status`);
  if (!res.ok) throw new Error('Error al obtener estado del motor SplitLLM');
  return res.json();
}

export function getExportCsvUrl(): string {
  return `${API_BASE}/invoices/export`;
}

export function getExportZipUrl(params?: { ids?: string[]; search?: string; status?: string; date?: string; workspace_id?: string }): string {
  const q = new URLSearchParams();
  if (params?.ids && params.ids.length > 0) {
    q.append('ids', params.ids.join(','));
  }
  if (params?.search) {
    q.append('search', params.search);
  }
  if (params?.status && params.status !== 'Todas' && params.status !== 'all') {
    q.append('status', params.status);
  }
  if (params?.date) {
    q.append('date', params.date);
  }
  if (params?.workspace_id) {
    q.append('workspace_id', params.workspace_id);
  }
  const queryStr = q.toString();
  return `${API_BASE}/invoices/export-zip${queryStr ? '?' + queryStr : ''}`;
}

export function getExportPdfUrl(params?: { ids?: string[]; search?: string; status?: string; date?: string; workspace_id?: string; autoprint?: boolean }): string {
  const q = new URLSearchParams();
  if (params?.ids && params.ids.length > 0) {
    q.append('ids', params.ids.join(','));
  }
  if (params?.search) {
    q.append('search', params.search);
  }
  if (params?.status && params.status !== 'Todas' && params.status !== 'all') {
    q.append('status', params.status);
  }
  if (params?.date) {
    q.append('date', params.date);
  }
  if (params?.workspace_id) {
    q.append('workspace_id', params.workspace_id);
  }
  if (params?.autoprint) {
    q.append('autoprint', 'true');
  }
  const queryStr = q.toString();
  return `${API_BASE}/invoices/export-pdf${queryStr ? '?' + queryStr : ''}`;
}

export function getInvoicePdfUrl(id: string): string {
  return `${API_BASE}/invoices/${id}/pdf`;
}

export interface WorkspacesResponse {
  status: string;
  data: {
    workspaces: Workspace[];
    unassigned: {
      count: number;
      total_volume: number;
    };
  };
}

export async function fetchWorkspaces(): Promise<WorkspacesResponse> {
  const res = await fetch(`${API_BASE}/workspaces`);
  if (!res.ok) throw new Error('Error al cargar workspaces');
  return res.json();
}

export async function createWorkspace(data: { name: string; description?: string; color?: string; icon?: string }): Promise<{ status: string; data: Workspace }> {
  const res = await fetch(`${API_BASE}/workspaces`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || 'Error al crear workspace');
  }
  return res.json();
}

export async function updateWorkspace(id: string, data: Partial<Workspace>): Promise<{ status: string; data: Workspace }> {
  const res = await fetch(`${API_BASE}/workspaces/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) throw new Error('Error al actualizar workspace');
  return res.json();
}

export async function deleteWorkspace(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/workspaces/${id}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error('Error al eliminar workspace');
}

export async function assignInvoicesToWorkspace(workspaceId: string, invoiceIds: string[]): Promise<{ status: string; message: string }> {
  const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ invoice_ids: invoiceIds })
  });
  if (!res.ok) throw new Error('Error al asignar facturas al workspace');
  return res.json();
}

export interface UploadStreamProgressEvent {
  event: 'init' | 'progress' | 'item_processed' | 'item_error' | 'complete' | 'error';
  total?: number;
  index?: number;
  currentFile?: string;
  stage?: string;
  message?: string;
  invoice?: Invoice;
  error?: string;
}

export async function uploadInvoicesStream(
  files: File[] | FileList,
  onProgress?: (event: UploadStreamProgressEvent) => void
): Promise<{ data: Invoice[]; count: number }> {
  const formData = new FormData();
  if (files.length === 1) {
    formData.append('invoice', files[0]);
  } else {
    for (let i = 0; i < files.length; i++) {
      formData.append('invoices[]', files[i]);
    }
  }

  const res = await fetch(`${API_BASE}/invoices/upload-stream`, {
    method: 'POST',
    body: formData
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.error || 'Error en transmisión de procesamiento');
  }

  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error('Respuesta del servidor no soporta flujo de eventos (ReadableStream)');
  }

  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  const processedInvoices: Invoice[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split('\n\n');
    buffer = chunks.pop() || '';

    for (const chunk of chunks) {
      const match = chunk.match(/^data:\s*(.+)$/m);
      if (match) {
        try {
          const payload: UploadStreamProgressEvent = JSON.parse(match[1]);
          if (onProgress) onProgress(payload);
          if (payload.event === 'item_processed' && payload.invoice) {
            processedInvoices.push(payload.invoice);
          }
        } catch {
          // ignore partial JSON chunk
        }
      }
    }
  }

  return {
    data: processedInvoices,
    count: processedInvoices.length
  };
}

export interface AgentAction {
  type: 'navigate_upload' | 'navigate_history' | 'navigate_detail' | 'export_csv';
  label: string;
  invoice_id?: string;
  invoice_number?: string;
}

export interface AgentChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AgentChatResponse {
  status: string;
  data: {
    reply: string;
    action?: AgentAction | null;
    suggestions?: string[];
  };
}

export async function sendAgentMessage(message: string, history: AgentChatMessage[] = []): Promise<AgentChatResponse> {
  const res = await fetch(`${API_BASE}/agent/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Error al comunicarse con SplitLedger AI');
  }
  return res.json();
}

export interface UserProfileData {
  user: {
    id: number;
    name: string;
    email: string;
    role: string;
    organization: string;
    tax_id: string;
    environment: string;
    engine_version: string;
    created_at: string;
  };
  stats: {
    invoices_audited: number;
    accounting_items: number;
    total_volume_eur: number;
    parity_balance_rate: number;
    last_audit_at: string;
  };
  preferences: {
    currency: string;
    accounting_standard: string;
    auto_reconciliation: boolean;
    double_entry_tolerance: string;
    export_format: string;
    storage_encryption: string;
  };
}

export interface UserProfileResponse {
  status: string;
  data: UserProfileData;
}

export async function fetchUserProfile(): Promise<UserProfileResponse> {
  const res = await fetch(`${API_BASE}/user/profile`);
  if (!res.ok) throw new Error('Error al cargar perfil de usuario');
  return res.json();
}

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: string;
  organization: string;
}

export interface AuthResponse {
  status: string;
  message?: string;
  data?: {
    user: AuthUser;
    token: string;
  };
  errors?: Record<string, string[]>;
}

const AUTH_STORAGE_KEY = 'splitledger_auth_session';

export function getStoredAuth(): { user: AuthUser; token: string } | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredAuth(data: { user: AuthUser; token: string }) {
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Error al guardar credenciales locales:', err);
  }
}

export function clearStoredAuth() {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch (err) {
    console.error('Error al limpiar credenciales locales:', err);
  }
}

export async function loginUser(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Error al iniciar sesión');
  }
  if (data.data) {
    setStoredAuth(data.data);
  }
  return data;
}

export async function registerUser(name: string, email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data.errors ? Object.values(data.errors).flat().join('. ') : data.message;
    throw new Error(msg || 'Error al registrar usuario');
  }
  if (data.data) {
    setStoredAuth(data.data);
  }
  return data;
}

export async function loginWithMagicLink(email: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/magic-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Error al solicitar enlace de acceso');
  }
  if (data.data) {
    setStoredAuth(data.data);
  }
  return data;
}

export async function loginWithSso(provider: string = 'google'): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/sso`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Error en autenticación SSO');
  }
  if (data.data) {
    setStoredAuth(data.data);
  }
  return data;
}

export async function logoutUser(): Promise<void> {
  try {
    const auth = getStoredAuth();
    if (auth?.token) {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.token}`
        }
      });
    }
  } catch (err) {
    console.warn('Cierre de sesión local:', err);
  } finally {
    clearStoredAuth();
  }
}



