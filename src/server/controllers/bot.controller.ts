import { Request, Response } from 'express';
import os from 'node:os';
import { chronoBotSingleton } from '../../chronobot-engine';

export class BotController {
  public static getStatus(req: Request, res: Response): void {
    res.json(chronoBotSingleton.getStatus());
  }

  public static getSystemStats(req: Request, res: Response): void {
    const totalRam = os.totalmem();
    const freeRam = os.freemem();
    const usedRam = totalRam - freeRam;
    const status = chronoBotSingleton.getStatus();
    const isActive = status.status === 'active';

    res.json({
      nodeVersion: process.version,
      os: `${os.type()} (${os.arch()})`,
      ramUsedMb: Math.round(usedRam / (1024 * 1024)),
      ramTotalMb: Math.round(totalRam / (1024 * 1024)),
      diskUsedGb: 0.24,
      diskTotalGb: 15.0,
      isHealthy: isActive,
      healthTitle: isActive ? 'Todo funcionando' : 'Bot apagado',
      healthMessage: isActive
        ? `Bot conectado y procesando mensajes. ${status.authorizedCount} contactos autorizados.`
        : 'La aplicación de WhatsApp no está funcionando. Escanea el código QR para conectar el bot.',
      uptimeSeconds: status.uptimeSeconds
    });
  }

  public static getLogs(req: Request, res: Response): void {
    res.json({ logs: chronoBotSingleton.getLogs() });
  }

  public static getEvents(req: Request, res: Response): void {
    res.json({ events: chronoBotSingleton.getEvents() });
  }

  public static getQr(req: Request, res: Response): void {
    res.json({ success: true, qr: chronoBotSingleton.getQrData(), status: chronoBotSingleton.getStatus().status });
  }

  public static async startBot(req: Request, res: Response): Promise<void> {
    await chronoBotSingleton.startBotProcess();
    const status = chronoBotSingleton.getStatus();
    const conflict = status.sessionConflict;
    res.status(conflict ? 409 : status.status === 'stopped' ? 503 : 200).json({
      success: !conflict && status.status !== 'stopped',
      message: conflict
        ? 'Ya hay una sesión de WhatsApp Web abierta con este perfil. Se evitó abrir un segundo navegador.'
        : undefined,
      status
    });
  }

  public static async controlBot(req: Request, res: Response): Promise<void> {
    const { action } = req.body;
    let started = true;
    if (action === 'start') {
      started = await chronoBotSingleton.startBotProcess();
    } else if (action === 'stop') {
      await chronoBotSingleton.stopBotProcess();
    } else if (action === 'disconnect') {
      await chronoBotSingleton.disconnectWhatsApp();
    } else if (action === 'restart') {
      await chronoBotSingleton.restartBotProcess();
    } else if (action === 'clear_logs') {
      chronoBotSingleton.clearLogs();
    } else if (action === 'regenerate_qr') {
      await chronoBotSingleton.regenerateQr();
    }

    const status = chronoBotSingleton.getStatus();
    const conflict = (action === 'start' && !started)
      || (['start', 'restart', 'regenerate_qr'].includes(action) && status.sessionConflict);
    res.status(conflict ? 409 : 200).json({
      success: !conflict,
      message: conflict
        ? 'Ya hay una sesión de WhatsApp Web abierta con este perfil. Se evitó abrir un segundo navegador.'
        : undefined,
      status,
      logs: chronoBotSingleton.getLogs(15)
    });
  }
}
