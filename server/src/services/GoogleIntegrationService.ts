export class GoogleIntegrationService {
  private static state = {
    is_connected: true,
    account_email: 'finanzas@splitledger.io',
    account_name: 'SplitLedger Finance & Audit',
    connected_at: '2026-10-15T09:30:00Z',
    scopes: [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/userinfo.email'
    ],
    services: {
      drive: {
        enabled: true,
        folder_name: 'SplitLedger Facturas & Workspaces',
        folder_id: '1dRiVe-sPliTlEdGer-2026-Fld',
        folder_url: 'https://drive.google.com/drive/folders/1dRiVe-sPliTlEdGer-2026-Fld',
        auto_sync: true,
        last_sync: new Date(Date.now() - 7200000).toISOString(),
        synced_files_count: 24
      },
      sheets: {
        enabled: true,
        sheet_name: 'Libro Diario PGC - SplitLedger 2026',
        sheet_id: '1sHeEtS-pLkR9941aZ-XmQ8821',
        sheet_url: 'https://docs.google.com/spreadsheets/d/1sHeEtS-pLkR9941aZ-XmQ8821/edit#gid=0',
        auto_export: true,
        last_sync: new Date(Date.now() - 2100000).toISOString(),
        synced_rows_count: 72
      },
      gmail: {
        enabled: true,
        query: 'has:attachment filename:(pdf OR xml OR xlsx) (factura OR invoice OR desglose)',
        polling_interval_minutes: 15,
        last_scan: new Date(Date.now() - 720000).toISOString(),
        detected_invoices_count: 24
      },
      oauth: {
        client_configured: true,
        sso_enabled: true,
        token_type: 'Bearer',
        expires_in: 3600
      }
    }
  };

  public static getStatus() {
    return this.state;
  }

  public static connect(data: { email?: string; name?: string }) {
    this.state.is_connected = true;
    this.state.account_email = data.email || 'auditor.google@splitledger.io';
    this.state.account_name = data.name || 'Cuenta Google Workspace';
    this.state.connected_at = new Date().toISOString();
    return this.state;
  }

  public static disconnect() {
    this.state.is_connected = false;
    this.state.account_email = null;
    this.state.account_name = null;
    this.state.connected_at = null;
    this.state.services.drive.enabled = false;
    this.state.services.sheets.enabled = false;
    this.state.services.gmail.enabled = false;
    return this.state;
  }

  public static syncDrive() {
    this.state.services.drive.last_sync = new Date().toISOString();
    return {
      status: 'success',
      message: 'Sincronización con Google Drive completada con éxito',
      folder_url: this.state.services.drive.folder_url,
      synced_at: new Date().toISOString()
    };
  }

  public static syncSheets() {
    this.state.services.sheets.last_sync = new Date().toISOString();
    return {
      status: 'success',
      message: 'Libro Diario PGC y partidas desglosadas actualizadas en Google Sheets',
      sheet_url: this.state.services.sheets.sheet_url,
      synced_at: new Date().toISOString()
    };
  }

  public static fetchGmail() {
    this.state.services.gmail.last_scan = new Date().toISOString();
    return {
      status: 'success',
      message: 'Bandeja de entrada de Gmail escaneada.',
      query_executed: this.state.services.gmail.query,
      new_invoices_found: 0,
      scanned_at: new Date().toISOString()
    };
  }
}
