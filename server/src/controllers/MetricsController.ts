import { Request, Response, NextFunction } from 'express';
import { InvoiceRepository } from '../repositories/InvoiceRepository.js';

export class MetricsController {
  static async getSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const metrics = await InvoiceRepository.getMetrics();
      return res.json({
        status: 'success',
        data: metrics
      });
    } catch (error) {
      next(error);
    }
  }
}
