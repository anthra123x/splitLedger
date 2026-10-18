import { Request, Response } from 'express';
import { GoogleIntegrationService } from '../services/GoogleIntegrationService.js';

export class GoogleIntegrationController {
  public static getStatus(req: Request, res: Response) {
    const data = GoogleIntegrationService.getStatus();
    res.json({ status: 'success', data });
  }

  public static connect(req: Request, res: Response) {
    const data = GoogleIntegrationService.connect(req.body);
    res.json({
      status: 'success',
      message: 'Cuenta de Google Workspace vinculada correctamente.',
      data
    });
  }

  public static disconnect(req: Request, res: Response) {
    const data = GoogleIntegrationService.disconnect();
    res.json({
      status: 'success',
      message: 'Cuenta de Google desvinculada y permisos revocados.',
      data
    });
  }

  public static syncDrive(req: Request, res: Response) {
    const result = GoogleIntegrationService.syncDrive();
    res.json(result);
  }

  public static syncSheets(req: Request, res: Response) {
    const result = GoogleIntegrationService.syncSheets();
    res.json(result);
  }

  public static fetchGmail(req: Request, res: Response) {
    const result = GoogleIntegrationService.fetchGmail();
    res.json(result);
  }
}
