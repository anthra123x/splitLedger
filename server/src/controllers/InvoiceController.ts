import { Request, Response, NextFunction } from 'express';
import fs from 'node:fs';
import { InvoiceRepository } from '../repositories/InvoiceRepository.js';
import { processingQueue } from '../queue/ProcessingQueue.js';
import { AccountingRulesService } from '../services/AccountingRulesService.js';

export class InvoiceController {
  static async upload(req: Request, res: Response, next: NextFunction) {
    try {
      const files: Express.Multer.File[] = [];
      if (req.file) {
        files.push(req.file);
      } else if (Array.isArray(req.files)) {
        files.push(...req.files);
      } else if (req.files && typeof req.files === 'object') {
        for (const key of Object.keys(req.files)) {
          const list = (req.files as any)[key];
          if (Array.isArray(list)) files.push(...list);
        }
      }

      if (files.length === 0) {
        return res.status(400).json({ status: 'error', error: 'No se ha adjuntado ningún archivo.' });
      }

      // 1. Initial pending records in database and queue dispatch
      const fileJobs = await Promise.all(
        files.map(async (file) => {
          const { path: filePath, originalname, mimetype, size, filename } = file;
          const invoiceId = await InvoiceRepository.create({
            filename,
            original_name: originalname,
            file_path: filePath,
            mime_type: mimetype,
            file_size: size,
            status: 'processing'
          });

          const job = processingQueue.addJob({
            invoiceId,
            filePath,
            originalName: originalname,
            mimeType: mimetype,
            size
          });

          return { file, invoiceId, job };
        })
      );

      // Si el cliente pide modo asíncrono con 'async=true'
      if (req.query.async === 'true') {
        return res.status(202).json({
          status: 'accepted',
          message: `${fileJobs.length} factura(s) encolada(s) en la Unidad de Procesamiento SplitLLM`,
          data: {
            batchSize: fileJobs.length,
            jobs: fileJobs.map((fj) => ({
              jobId: fj.job.id,
              invoiceId: fj.invoiceId,
              originalName: fj.file.originalname,
              statusUrl: `/api/jobs/${fj.job.id}`,
              streamUrl: `/api/jobs/stream/${fj.job.id}`
            }))
          }
        });
      }

      // Modo interactivo síncrono
      const results = await Promise.all(
        fileJobs.map(({ job, file }) => {
          return new Promise<any>((resolve) => {
            const onCompleted = (completedJob: any) => {
              if (completedJob.id === job.id) {
                cleanup();
                resolve(completedJob.result);
              }
            };

            const onFailed = (failedJob: any) => {
              if (failedJob.id === job.id) {
                cleanup();
                resolve({
                  error: failedJob.error || 'Fallo en la Unidad de Procesamiento',
                  invoice: { original_name: file.originalname, status: 'error' }
                });
              }
            };

            const cleanup = () => {
              processingQueue.off('job:completed', onCompleted);
              processingQueue.off('job:failed', onFailed);
            };

            processingQueue.on('job:completed', onCompleted);
            processingQueue.on('job:failed', onFailed);
          });
        })
      );

      // Backward compatibility: If 1 file was uploaded, return standard single invoice format
      if (files.length === 1) {
        const single = results[0];
        if (single.error) {
          return res.status(500).json({ status: 'error', error: single.error });
        }
        return res.status(201).json({
          status: 'success',
          data: single.invoice,
          meta: {
            telemetry: single.telemetry,
            auditLog: single.auditLog,
            isBalanced: single.isBalanced
          }
        });
      }

      // Multi-invoice batch result
      return res.status(201).json({
        status: 'success',
        count: results.length,
        data: results.map((r) => r.invoice),
        meta: {
          isBatch: true,
          processedCount: results.length,
          allBalanced: results.every((r) => r.isBalanced),
          results: results.map((r) => ({
            id: r.invoice?.id,
            invoice_number: r.invoice?.invoice_number,
            supplier_name: r.invoice?.supplier_name,
            grand_total: r.invoice?.grand_total,
            items_count: r.invoice?.items?.length || 0,
            isBalanced: r.isBalanced,
            error: r.error || null
          }))
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async uploadBatch(req: Request, res: Response, next: NextFunction) {
    return InvoiceController.upload(req, res, next);
  }

  static getJobStatus(req: Request, res: Response) {
    const id = String(req.params.id);
    const job = processingQueue.getJob(id);

    if (!job) {
      return res.status(404).json({ status: 'error', error: 'Trabajo no encontrado' });
    }

    return res.json({
      status: 'success',
      data: {
        id: job.id,
        status: job.status,
        stage: job.stage,
        stageDetail: job.stageDetail,
        progress: job.progress,
        stages: job.stages,
        result: job.result,
        error: job.error,
        durationMs: (job.finishedAt || Date.now()) - (job.startedAt || job.submittedAt)
      }
    });
  }

  static streamJobProgress(req: Request, res: Response) {
    const id = String(req.params.id);
    const job = processingQueue.getJob(id);

    if (!job) {
      return res.status(404).send('Job not found');
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const sendEvent = (event: string, data: any) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    sendEvent('progress', {
      stage: job.stage,
      detail: job.stageDetail,
      progress: job.progress
    });

    const onProgress = (prog: any) => {
      if (prog.jobId === id) sendEvent('progress', prog);
    };

    const onCompleted = (completedJob: any) => {
      if (completedJob.id === id) {
        sendEvent('completed', completedJob.result);
        cleanup();
        res.end();
      }
    };

    const onFailed = (failedJob: any) => {
      if (failedJob.id === id) {
        sendEvent('failed', { error: failedJob.error });
        cleanup();
        res.end();
      }
    };

    const cleanup = () => {
      processingQueue.off('job:progress', onProgress);
      processingQueue.off('job:completed', onCompleted);
      processingQueue.off('job:failed', onFailed);
    };

    processingQueue.on('job:progress', onProgress);
    processingQueue.on('job:completed', onCompleted);
    processingQueue.on('job:failed', onFailed);

    req.on('close', cleanup);
  }

  static getEngineStats(req: Request, res: Response) {
    const stats = processingQueue.getStats();
    return res.json({
      status: 'success',
      data: {
        ...stats,
        engineVersion: 'SplitLLM-v2.4-Enterprise',
        architecture: 'Decoupled-Microservices-Worker-Pipeline'
      }
    });
  }

  static async getAll(req: Request, res: Response, next: NextFunction) {
    try {
      const { search, status, page = '1', limit = '50' } = req.query as any;
      const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
      const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
      const offset = (parsedPage - 1) * parsedLimit;

      const invoices = await InvoiceRepository.findAll({
        search,
        status,
        limit: parsedLimit,
        offset
      });

      const total = await InvoiceRepository.countAll({ search, status });

      return res.json({
        status: 'success',
        data: {
          invoices,
          pagination: {
            page: parsedPage,
            limit: parsedLimit,
            total,
            totalPages: Math.ceil(total / parsedLimit)
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      const invoice = await InvoiceRepository.findById(id);

      if (!invoice) {
        return res.status(404).json({ status: 'error', error: 'Factura no encontrada' });
      }

      return res.json({
        status: 'success',
        data: invoice
      });
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      const existing = await InvoiceRepository.findById(id);

      if (!existing) {
        return res.status(404).json({ status: 'error', error: 'Factura no encontrada' });
      }

      const updated = await InvoiceRepository.update(id, req.body);

      return res.json({
        status: 'success',
        data: updated
      });
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      const invoice = await InvoiceRepository.findById(id);

      if (!invoice) {
        return res.status(404).json({ status: 'error', error: 'Factura no encontrada' });
      }

      if (invoice.file_path && fs.existsSync(invoice.file_path)) {
        try {
          fs.unlinkSync(invoice.file_path);
        } catch {
          // ignore
        }
      }

      await InvoiceRepository.delete(id);

      return res.json({
        status: 'success',
        message: 'Factura eliminada correctamente'
      });
    } catch (error) {
      next(error);
    }
  }

  static async exportCsv(req: Request, res: Response, next: NextFunction) {
    try {
      const invoices = await InvoiceRepository.findAll({ limit: 1000 });
      let csv = 'ID Factura,Proveedor,NIF,Fecha,Partida,Cuenta Contable,Centro Coste,Base EUR,IVA %,Cuota IVA EUR,Total Partida EUR,Estado\n';

      for (const inv of invoices) {
        const full = await InvoiceRepository.findById(inv.id);
        if (full?.items && full.items.length > 0) {
          for (const item of full.items) {
            const row = [
              `"${full.invoice_number || ''}"`,
              `"${full.supplier_name || ''}"`,
              `"${full.supplier_tax_id || ''}"`,
              `"${full.invoice_date || ''}"`,
              `"${(item.concept || '').replace(/"/g, '""')}"`,
              `"${item.account_code || ''} - ${item.account_name || ''}"`,
              `"${item.cost_center || ''}"`,
              (item.base_amount || 0).toFixed(2),
              `${item.tax_rate || 21}%`,
              (item.tax_amount || 0).toFixed(2),
              (item.total_amount || 0).toFixed(2),
              `"${full.status}"`
            ];
            csv += row.join(',') + '\n';
          }
        } else if (full) {
          const row = [
            `"${full.invoice_number || ''}"`,
            `"${full.supplier_name || ''}"`,
            `"${full.supplier_tax_id || ''}"`,
            `"${full.invoice_date || ''}"`,
            `"Total General"`,
            `"628000"`,
            `"General"`,
            (full.subtotal || 0).toFixed(2),
            `"21%"`,
            (full.tax_total || 0).toFixed(2),
            (full.grand_total || 0).toFixed(2),
            `"${full.status}"`
          ];
          csv += row.join(',') + '\n';
        }
      }

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="SplitLedger_Export_Facturas.csv"');
      return res.send(csv);
    } catch (error) {
      next(error);
    }
  }

  static getRules(req: Request, res: Response) {
    return res.json({
      status: 'success',
      data: {
        accounts: AccountingRulesService.getAccounts(),
        cost_centers: AccountingRulesService.getCostCenters()
      }
    });
  }
}
