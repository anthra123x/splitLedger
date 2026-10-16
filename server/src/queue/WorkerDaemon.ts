import { processingQueue, QueueJob } from './ProcessingQueue.js';
import { OcrService } from '../services/OcrService.js';
import { SplitLLMEngine } from '../engine/SplitLLMEngine.js';
import { InvoiceRepository } from '../repositories/InvoiceRepository.js';

export class WorkerDaemon {
  static init() {
    console.log('[WORKER] Iniciando Worker Daemon de la Unidad de Procesamiento SplitLLM (TypeScript)...');

    processingQueue.registerHandler(async (job: QueueJob, updateStage: (stage: any) => void) => {
      const { invoiceId, filePath, originalName, mimeType } = job.data;

      // 1. OCR Preprocessing
      updateStage({ stage: 'ocr', detail: 'Extrayendo capa óptica y coordenadas espaciales...' });
      const ocrResult = await OcrService.processDocument(filePath, mimeType);

      // 2. SplitLLM Neural Pipeline
      const decomposed = await SplitLLMEngine.process({
        rawText: ocrResult.text,
        originalName,
        mimeType,
        boundingBoxes: ocrResult.boundingBoxes,
        onStageUpdate: updateStage
      });

      // 3. Persist to Database (Neon PostgreSQL / SQLite)
      await InvoiceRepository.update(invoiceId, {
        invoice_number: decomposed.invoice_number,
        supplier_name: decomposed.supplier_name,
        supplier_tax_id: decomposed.supplier_tax_id,
        supplier_address: decomposed.supplier_address,
        customer_name: decomposed.customer_name,
        customer_tax_id: decomposed.customer_tax_id,
        customer_address: decomposed.customer_address,
        invoice_date: decomposed.invoice_date,
        due_date: decomposed.due_date,
        currency: decomposed.currency || 'EUR',
        subtotal: decomposed.subtotal,
        tax_total: decomposed.tax_total,
        retention_total: decomposed.retention_total,
        grand_total: decomposed.grand_total,
        status: 'analyzed',
        confidence_score: decomposed.confidence_score,
        items: decomposed.items
      });

      const updatedInvoice = await InvoiceRepository.findById(invoiceId);

      return {
        invoice: updatedInvoice,
        telemetry: decomposed.telemetry,
        auditLog: decomposed.audit_log,
        isBalanced: decomposed.is_balanced
      };
    });
  }
}
