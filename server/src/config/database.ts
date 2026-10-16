import { neon } from '@neondatabase/serverless';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from './env.js';

export const isPostgres = Boolean(config.databaseUrl);
export const sql = isPostgres ? neon(config.databaseUrl) : null;

// Local fallback SQLite
let localDb: DatabaseSync | null = null;
if (!isPostgres) {
  const dbDir = path.dirname(config.databasePath);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
  localDb = new DatabaseSync(config.databasePath);
  localDb.exec('PRAGMA journal_mode = WAL;');
  localDb.exec('PRAGMA foreign_keys = ON;');
}

export const sqliteDb = localDb;

export async function initDatabase() {
  if (isPostgres && sql) {
    console.log('[DATABASE] Conectado a Neon PostgreSQL (Serverless Cloud)');
    await seedPostgresData();
  } else if (sqliteDb) {
    console.log('[DATABASE] Conectado a SQLite Local (Modo Desarrollo Offline)');
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        original_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        invoice_number TEXT,
        supplier_name TEXT,
        supplier_tax_id TEXT,
        supplier_address TEXT,
        customer_name TEXT,
        customer_tax_id TEXT,
        customer_address TEXT,
        invoice_date TEXT,
        due_date TEXT,
        currency TEXT DEFAULT 'EUR',
        subtotal REAL DEFAULT 0,
        tax_total REAL DEFAULT 0,
        retention_total REAL DEFAULT 0,
        grand_total REAL DEFAULT 0,
        status TEXT DEFAULT 'pending',
        confidence_score REAL DEFAULT 0.95,
        raw_ocr_text TEXT,
        error_message TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS invoice_items (
        id TEXT PRIMARY KEY,
        invoice_id TEXT NOT NULL,
        item_index INTEGER NOT NULL,
        concept TEXT NOT NULL,
        account_code TEXT,
        account_name TEXT,
        cost_center TEXT,
        quantity REAL DEFAULT 1,
        unit_price REAL DEFAULT 0,
        base_amount REAL NOT NULL,
        tax_rate REAL DEFAULT 21,
        tax_amount REAL DEFAULT 0,
        total_amount REAL NOT NULL,
        bounding_box TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
      );
    `);
  }
}

async function seedPostgresData() {
  if (!sql) return;
  const countRes = await sql`SELECT COUNT(*)::int as count FROM invoices`;
  if (countRes[0]?.count > 0) return;

  console.log('[DATABASE] Inicializando datos base en Neon PostgreSQL...');

  const awsId = 'inv-aws-2024-9841';
  await sql`
    INSERT INTO invoices (
      id, filename, original_name, file_path, mime_type, file_size,
      invoice_number, supplier_name, supplier_tax_id, supplier_address,
      customer_name, customer_tax_id, customer_address,
      invoice_date, due_date, currency,
      subtotal, tax_total, retention_total, grand_total,
      status, confidence_score
    ) VALUES (
      ${awsId}, 'AWS_EMEA_INV9841.pdf', 'AWS_EMEA_INV9841.pdf', '/demo/AWS_EMEA_INV9841.pdf', 'application/pdf', 245760,
      'AWS-2024-9841', 'Amazon Web Services EMEA SARL', 'LU26375245', '38 Avenue John F. Kennedy, L-1855 Luxembourg',
      'SplitLedger Engineering Labs S.L.', 'ESB87219034', 'Calle Velázquez 45, Madrid',
      '2024-10-14', '2024-11-14', 'EUR',
      2671.49, 561.01, 0, 3232.50,
      'analyzed', 0.988
    ) ON CONFLICT (id) DO NOTHING
  `;

  const awsItems = [
    {
      concept: 'Amazon Elastic Compute Cloud (EC2)',
      code: '628000',
      name: 'Suministros IT',
      costCenter: 'DevOps',
      qty: 1,
      price: 1840.00,
      base: 1840.00,
      taxRate: 21,
      taxAmt: 386.40,
      tot: 2226.40,
      notes: 'Region: eu-west-1 (Ireland) | c5.2xlarge reserved 730 hrs',
      box: { x: 20, y: 140, w: 380, h: 48, confidence: 99.8 }
    },
    {
      concept: 'Amazon Simple Storage Service (S3 Glacier)',
      code: '628000',
      name: 'Suministros IT',
      costCenter: 'Data',
      qty: 1,
      price: 412.50,
      base: 412.50,
      taxRate: 21,
      taxAmt: 86.63,
      tot: 499.13,
      notes: 'Glacier Flexible Retrieval Data Transfer • Cold Store',
      box: { x: 20, y: 195, w: 380, h: 45, confidence: 98.4 }
    },
    {
      concept: 'Amazon Route 53 DNS Services',
      code: '628000',
      name: 'Suministros IT',
      costCenter: 'DevOps',
      qty: 1,
      price: 85.00,
      base: 85.00,
      taxRate: 21,
      taxAmt: 17.85,
      tot: 102.85,
      notes: '14 Hosted Zones & Latency Health Checks',
      box: { x: 20, y: 248, w: 380, h: 45, confidence: 99.1 }
    },
    {
      concept: 'AWS Enterprise Support Tier Package',
      code: '629002',
      name: 'Servicios Profesionales Cloud',
      costCenter: 'Management',
      qty: 1,
      price: 333.99,
      base: 333.99,
      taxRate: 21,
      taxAmt: 70.13,
      tot: 404.12,
      notes: '10% Cloud Spend Fee | 24x7 Direct TAM Access',
      box: { x: 20, y: 300, w: 380, h: 45, confidence: 97.9 }
    }
  ];

  for (let i = 0; i < awsItems.length; i++) {
    const it = awsItems[i];
    await sql`
      INSERT INTO invoice_items (
        id, invoice_id, item_index, concept, account_code, account_name,
        cost_center, quantity, unit_price, base_amount, tax_rate, tax_amount,
        total_amount, bounding_box, notes
      ) VALUES (
        ${crypto.randomUUID()}, ${awsId}, ${i + 1}, ${it.concept}, ${it.code}, ${it.name},
        ${it.costCenter}, ${it.qty}, ${it.price}, ${it.base}, ${it.taxRate}, ${it.taxAmt},
        ${it.tot}, ${JSON.stringify(it.box)}, ${it.notes}
      )
    `;
  }
}
