import { isPostgres, sql, sqliteDb } from '../config/database.js';
import { Invoice, InvoiceItem, SystemMetrics } from '../types/index.js';
import crypto from 'node:crypto';

export class InvoiceRepository {
  static async findAll({ search = '', status = '', limit = 50, offset = 0 } = {}): Promise<Invoice[]> {
    if (isPostgres && sql) {
      let query = sql`
        SELECT i.*, 
          (SELECT COUNT(*)::int FROM invoice_items WHERE invoice_id = i.id) as items_count
        FROM invoices i
        WHERE 1=1
      `;

      // Postgres parameterized query
      if (status && status !== 'all' && status !== 'Todas') {
        const mappedStatus = status.toLowerCase() === 'desglosadas' ? 'analyzed' :
                             status.toLowerCase() === 'en proceso' ? 'processing' : status.toLowerCase();
        if (search && search.trim()) {
          const term = `%${search.trim()}%`;
          const rows = await sql`
            SELECT i.*, (SELECT COUNT(*)::int FROM invoice_items WHERE invoice_id = i.id) as items_count
            FROM invoices i
            WHERE i.status = ${mappedStatus}
              AND (i.invoice_number ILIKE ${term} OR i.supplier_name ILIKE ${term} OR i.supplier_tax_id ILIKE ${term})
            ORDER BY i.created_at DESC LIMIT ${limit} OFFSET ${offset}
          `;
          return rows as unknown as Invoice[];
        } else {
          const rows = await sql`
            SELECT i.*, (SELECT COUNT(*)::int FROM invoice_items WHERE invoice_id = i.id) as items_count
            FROM invoices i
            WHERE i.status = ${mappedStatus}
            ORDER BY i.created_at DESC LIMIT ${limit} OFFSET ${offset}
          `;
          return rows as unknown as Invoice[];
        }
      }

      if (search && search.trim()) {
        const term = `%${search.trim()}%`;
        const rows = await sql`
          SELECT i.*, (SELECT COUNT(*)::int FROM invoice_items WHERE invoice_id = i.id) as items_count
          FROM invoices i
          WHERE (i.invoice_number ILIKE ${term} OR i.supplier_name ILIKE ${term} OR i.supplier_tax_id ILIKE ${term})
          ORDER BY i.created_at DESC LIMIT ${limit} OFFSET ${offset}
        `;
        return rows as unknown as Invoice[];
      }

      const rows = await sql`
        SELECT i.*, (SELECT COUNT(*)::int FROM invoice_items WHERE invoice_id = i.id) as items_count
        FROM invoices i
        ORDER BY i.created_at DESC LIMIT ${limit} OFFSET ${offset}
      `;
      return rows as unknown as Invoice[];
    }

    // SQLite fallback
    let q = 'SELECT * FROM invoices WHERE 1=1';
    const params: any[] = [];

    if (status && status !== 'all' && status !== 'Todas') {
      const mapped = status.toLowerCase() === 'desglosadas' ? 'analyzed' :
                     status.toLowerCase() === 'en proceso' ? 'processing' : status.toLowerCase();
      q += ' AND status = ?';
      params.push(mapped);
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      q += ' AND (invoice_number LIKE ? OR supplier_name LIKE ? OR supplier_tax_id LIKE ?)';
      params.push(term, term, term);
    }

    q += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const invoices = sqliteDb!.prepare(q).all(...params) as any[];
    const getCount = sqliteDb!.prepare('SELECT COUNT(*) as count FROM invoice_items WHERE invoice_id = ?');

    return invoices.map(inv => ({
      ...inv,
      items_count: (getCount.get(inv.id) as any)?.count || 0
    }));
  }

  static async countAll({ search = '', status = '' } = {}): Promise<number> {
    if (isPostgres && sql) {
      const rows = await sql`SELECT COUNT(*)::int as total FROM invoices`;
      return rows[0]?.total || 0;
    }

    let q = 'SELECT COUNT(*) as total FROM invoices WHERE 1=1';
    const params: any[] = [];
    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      q += ' AND (invoice_number LIKE ? OR supplier_name LIKE ? OR supplier_tax_id LIKE ?)';
      params.push(term, term, term);
    }
    return (sqliteDb!.prepare(q).get(...params) as any)?.total || 0;
  }

  static async findById(id: string): Promise<Invoice | null> {
    if (isPostgres && sql) {
      const invRows = await sql`SELECT * FROM invoices WHERE id = ${id}`;
      if (invRows.length === 0) return null;

      const itemRows = await sql`SELECT * FROM invoice_items WHERE invoice_id = ${id} ORDER BY item_index ASC`;
      const invoice = invRows[0] as any;

      return {
        ...invoice,
        subtotal: parseFloat(invoice.subtotal) || 0,
        tax_total: parseFloat(invoice.tax_total) || 0,
        retention_total: parseFloat(invoice.retention_total) || 0,
        grand_total: parseFloat(invoice.grand_total) || 0,
        confidence_score: parseFloat(invoice.confidence_score) || 0.95,
        items: itemRows.map((it: any) => ({
          ...it,
          base_amount: parseFloat(it.base_amount) || 0,
          unit_price: parseFloat(it.unit_price) || 0,
          tax_rate: parseFloat(it.tax_rate) || 21,
          tax_amount: parseFloat(it.tax_amount) || 0,
          total_amount: parseFloat(it.total_amount) || 0,
          bounding_box: it.bounding_box ? (typeof it.bounding_box === 'string' ? JSON.parse(it.bounding_box) : it.bounding_box) : null
        }))
      };
    }

    const invoice = sqliteDb!.prepare('SELECT * FROM invoices WHERE id = ?').get(id) as any;
    if (!invoice) return null;

    const items = sqliteDb!.prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY item_index ASC').all(id) as any[];

    return {
      ...invoice,
      items: items.map(item => ({
        ...item,
        bounding_box: item.bounding_box ? JSON.parse(item.bounding_box) : null
      }))
    };
  }

  static async create(data: Partial<Invoice>): Promise<string> {
    const id = data.id || crypto.randomUUID();
    const now = new Date().toISOString();

    if (isPostgres && sql) {
      await sql`
        INSERT INTO invoices (
          id, filename, original_name, file_path, mime_type, file_size,
          invoice_number, supplier_name, supplier_tax_id, supplier_address,
          customer_name, customer_tax_id, customer_address,
          invoice_date, due_date, currency,
          subtotal, tax_total, retention_total, grand_total,
          status, confidence_score
        ) VALUES (
          ${id}, ${data.filename || ''}, ${data.original_name || ''}, ${data.file_path || ''}, ${data.mime_type || ''}, ${data.file_size || 0},
          ${data.invoice_number || 'PENDIENTE'}, ${data.supplier_name || 'Desconocido'}, ${data.supplier_tax_id || ''}, ${data.supplier_address || ''},
          ${data.customer_name || ''}, ${data.customer_tax_id || ''}, ${data.customer_address || ''},
          ${data.invoice_date || now.split('T')[0]}, ${data.due_date || ''}, ${data.currency || 'EUR'},
          ${data.subtotal || 0}, ${data.tax_total || 0}, ${data.retention_total || 0}, ${data.grand_total || 0},
          ${data.status || 'pending'}, ${data.confidence_score || 0.95}
        )
      `;
      return id;
    }

    sqliteDb!.prepare(`
      INSERT INTO invoices (
        id, filename, original_name, file_path, mime_type, file_size,
        invoice_number, supplier_name, supplier_tax_id, supplier_address,
        customer_name, customer_tax_id, customer_address,
        invoice_date, due_date, currency,
        subtotal, tax_total, retention_total, grand_total,
        status, confidence_score, raw_ocr_text, error_message,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.filename ?? '',
      data.original_name ?? '',
      data.file_path ?? '',
      data.mime_type ?? 'application/pdf',
      data.file_size ?? 0,
      data.invoice_number || 'PENDIENTE',
      data.supplier_name || 'Desconocido',
      data.supplier_tax_id || '',
      data.supplier_address || '',
      data.customer_name || '',
      data.customer_tax_id || '',
      data.customer_address || '',
      data.invoice_date || now.split('T')[0],
      data.due_date || '',
      data.currency || 'EUR',
      data.subtotal || 0,
      data.tax_total || 0,
      data.retention_total || 0,
      data.grand_total || 0,
      data.status || 'pending',
      data.confidence_score || 0.95,
      data.raw_ocr_text || '',
      data.error_message || null,
      now,
      now
    );

    return id;
  }

  static async update(id: string, data: Partial<Invoice>): Promise<Invoice | null> {
    if (isPostgres && sql) {
      if (data.invoice_number !== undefined || data.supplier_name !== undefined || data.status !== undefined) {
        await sql`
          UPDATE invoices SET
            invoice_number = COALESCE(${data.invoice_number}, invoice_number),
            supplier_name = COALESCE(${data.supplier_name}, supplier_name),
            supplier_tax_id = COALESCE(${data.supplier_tax_id}, supplier_tax_id),
            supplier_address = COALESCE(${data.supplier_address}, supplier_address),
            customer_name = COALESCE(${data.customer_name}, customer_name),
            customer_tax_id = COALESCE(${data.customer_tax_id}, customer_tax_id),
            customer_address = COALESCE(${data.customer_address}, customer_address),
            invoice_date = COALESCE(${data.invoice_date}, invoice_date),
            due_date = COALESCE(${data.due_date}, due_date),
            currency = COALESCE(${data.currency}, currency),
            subtotal = COALESCE(${data.subtotal}, subtotal),
            tax_total = COALESCE(${data.tax_total}, tax_total),
            retention_total = COALESCE(${data.retention_total}, retention_total),
            grand_total = COALESCE(${data.grand_total}, grand_total),
            status = COALESCE(${data.status}, status),
            confidence_score = COALESCE(${data.confidence_score}, confidence_score),
            raw_ocr_text = COALESCE(${data.raw_ocr_text}, raw_ocr_text),
            updated_at = NOW()
          WHERE id = ${id}
        `;
      }

      if (data.items && Array.isArray(data.items)) {
        await sql`DELETE FROM invoice_items WHERE invoice_id = ${id}`;
        for (let i = 0; i < data.items.length; i++) {
          const item = data.items[i];
          await sql`
            INSERT INTO invoice_items (
              id, invoice_id, item_index, concept, account_code, account_name,
              cost_center, quantity, unit_price, base_amount, tax_rate, tax_amount,
              total_amount, bounding_box, notes
            ) VALUES (
              ${item.id || crypto.randomUUID()}, ${id}, ${i + 1}, ${item.concept || 'Partida'},
              ${item.account_code || '628000'}, ${item.account_name || 'Suministros IT'},
              ${item.cost_center || 'General'}, ${item.quantity || 1}, ${item.unit_price || item.base_amount || 0},
              ${item.base_amount || 0}, ${item.tax_rate ?? 21}, ${item.tax_amount || 0},
              ${item.total_amount || 0}, ${item.bounding_box ? JSON.stringify(item.bounding_box) : null}, ${item.notes || ''}
            )
          `;
        }
      }

      return this.findById(id);
    }

    // SQLite
    const fields: string[] = [];
    const params: any[] = [];
    const allowed = [
      'invoice_number', 'supplier_name', 'supplier_tax_id', 'supplier_address',
      'customer_name', 'customer_tax_id', 'customer_address',
      'invoice_date', 'due_date', 'currency',
      'subtotal', 'tax_total', 'retention_total', 'grand_total',
      'status', 'confidence_score', 'raw_ocr_text'
    ];
    for (const f of allowed) {
      if ((data as any)[f] !== undefined) {
        fields.push(`${f} = ?`);
        params.push((data as any)[f]);
      }
    }
    fields.push('updated_at = ?');
    params.push(new Date().toISOString());
    params.push(id);

    if (fields.length > 1) {
      sqliteDb!.prepare(`UPDATE invoices SET ${fields.join(', ')} WHERE id = ?`).run(...params);
    }

    if (data.items && Array.isArray(data.items)) {
      sqliteDb!.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(id);
      const insert = sqliteDb!.prepare(`
        INSERT INTO invoice_items (
          id, invoice_id, item_index, concept, account_code, account_name,
          cost_center, quantity, unit_price, base_amount, tax_rate, tax_amount,
          total_amount, bounding_box, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      data.items.forEach((item, idx) => {
        insert.run(
          item.id || crypto.randomUUID(), id, idx + 1, item.concept, item.account_code, item.account_name,
          item.cost_center, item.quantity || 1, item.unit_price || item.base_amount, item.base_amount,
          item.tax_rate ?? 21, item.tax_amount || 0, item.total_amount || 0,
          item.bounding_box ? JSON.stringify(item.bounding_box) : null, item.notes || '', new Date().toISOString()
        );
      });
    }

    return this.findById(id);
  }

  static async delete(id: string): Promise<boolean> {
    if (isPostgres && sql) {
      await sql`DELETE FROM invoice_items WHERE invoice_id = ${id}`;
      await sql`DELETE FROM invoices WHERE id = ${id}`;
      return true;
    }
    sqliteDb!.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(id);
    sqliteDb!.prepare('DELETE FROM invoices WHERE id = ?').run(id);
    return true;
  }

  static async getMetrics(): Promise<SystemMetrics> {
    if (isPostgres && sql) {
      const totalInv = await sql`SELECT COUNT(*)::int as total FROM invoices`;
      const recVol = await sql`SELECT COALESCE(SUM(grand_total), 0)::float as sum FROM invoices WHERE status = 'reconciled' OR status = 'analyzed'`;
      const totalItems = await sql`SELECT COUNT(*)::int as count FROM invoice_items`;
      const avgConf = await sql`SELECT COALESCE(AVG(confidence_score), 0.985)::float as avg FROM invoices`;

      return {
        total_invoices: totalInv[0]?.total || 0,
        reconciled_volume: recVol[0]?.sum || 0,
        total_items: totalItems[0]?.count || 0,
        avg_confidence: ((avgConf[0]?.avg || 0.985) * 100).toFixed(1)
      };
    }

    const totalInvoices = (sqliteDb!.prepare('SELECT COUNT(*) as total FROM invoices').get() as any).total || 0;
    const reconciledVolume = (sqliteDb!.prepare("SELECT SUM(grand_total) as sum FROM invoices WHERE status = 'reconciled' OR status = 'analyzed'").get() as any).sum || 0;
    const totalItems = (sqliteDb!.prepare('SELECT COUNT(*) as count FROM invoice_items').get() as any).count || 0;
    const avgConfidence = (sqliteDb!.prepare('SELECT AVG(confidence_score) as avg FROM invoices').get() as any).avg || 0.985;

    return {
      total_invoices: totalInvoices,
      reconciled_volume: reconciledVolume,
      total_items: totalItems,
      avg_confidence: (avgConfidence * 100).toFixed(1)
    };
  }
}
