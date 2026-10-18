import express from 'express';
import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from '../config/env.js';
import { InvoiceController } from '../controllers/InvoiceController.js';
import { MetricsController } from '../controllers/MetricsController.js';
import { GoogleIntegrationController } from '../controllers/GoogleIntegrationController.js';

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `${crypto.randomUUID()}${ext}`;
    cb(null, safeName);
  }
});

const fileFilter: multer.Options['fileFilter'] = (req, file, cb) => {
  const allowedMimes = [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'image/tiff',
    'text/xml',
    'application/xml',
    'text/plain'
  ];

  if (allowedMimes.includes(file.mimetype) || /\.(pdf|png|jpe?g|webp|xml|txt)$/i.test(file.originalname)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de archivo no permitido. Sube un PDF, imagen (PNG/JPG) o XML de factura.'));
  }
};

const upload = multer({
  storage,
  limits: { fileSize: config.maxFileSize },
  fileFilter
});

// Invoices CRUD & Upload (Supports single file or batch uploads)
router.post('/invoices/upload', upload.any(), InvoiceController.upload);
router.post('/invoices/batch', upload.array('invoices', 50), InvoiceController.uploadBatch);
router.get('/invoices', InvoiceController.getAll);
router.get('/invoices/export', InvoiceController.exportCsv);
router.get('/invoices/rules', InvoiceController.getRules);
router.get('/invoices/:id', InvoiceController.getById);
router.put('/invoices/:id', InvoiceController.update);
router.delete('/invoices/:id', InvoiceController.delete);

// Dedicated Processing Unit Job Queue & Telemetry
router.get('/jobs/:id', InvoiceController.getJobStatus);
router.get('/jobs/stream/:id', InvoiceController.streamJobProgress);
router.get('/engine/status', InvoiceController.getEngineStats);

// Metrics
router.get('/metrics', MetricsController.getSummary);

// Google Cloud & Workspace Integrations
router.get('/integrations/google/status', GoogleIntegrationController.getStatus);
router.post('/integrations/google/connect', GoogleIntegrationController.connect);
router.post('/integrations/google/disconnect', GoogleIntegrationController.disconnect);
router.post('/integrations/google/drive/sync', GoogleIntegrationController.syncDrive);
router.post('/integrations/google/sheets/sync', GoogleIntegrationController.syncSheets);
router.post('/integrations/google/gmail/fetch', GoogleIntegrationController.fetchGmail);

export default router;
