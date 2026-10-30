import os from 'node:os';
import { Router } from 'express';
import { ChronoBotEngine } from '../chronobot-engine';
import { EmployeeStore } from './employee-store';

export function createBotApiRouter(bot: ChronoBotEngine, employeeStore: EmployeeStore) {
  const router = Router();

  router.get('/status', (_req, res) => {
    res.json(bot.getStatus());
  });

  router.get('/system-stats', (_req, res) => {
    const totalRam = os.totalmem();
    const usedRam = totalRam - os.freemem();
    const status = bot.getStatus();
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
  });

  router.get('/logs', (_req, res) => {
    res.json({ logs: bot.getLogs() });
  });

  router.get('/events', (_req, res) => {
    res.json({ events: bot.getEvents() });
  });

  router.get('/images', (_req, res) => {
    res.json({ images: bot.getSavedImages() });
  });

  router.get('/contacts', (_req, res) => {
    res.json({ employees: employeeStore.getEmployees() });
  });

  router.post('/contacts', (req, res) => {
    const employee = employeeStore.addEmployee(req.body);
    bot.reloadAuthorizedContacts(`Contacto añadido: ${employee.nombre}`);
    res.json({ success: true, employee, logs: bot.getLogs(10) });
  });

  router.put('/contacts/:id', (req, res) => {
    const employee = employeeStore.updateEmployee(req.params.id, req.body);
    if (employee) bot.reloadAuthorizedContacts(`Contacto actualizado: ${employee.nombre}`);
    res.json({ success: Boolean(employee), employee, logs: bot.getLogs(10) });
  });

  router.put('/contacts/:id/toggle', (req, res) => {
    const employee = employeeStore.toggleEmployeeActive(req.params.id);
    if (employee) {
      bot.reloadAuthorizedContacts(`Permiso modificado: ${employee.nombre} (${employee.activo ? 'AUTORIZADO' : 'REVOCADO'})`);
    }
    res.json({ success: Boolean(employee), employee, logs: bot.getLogs(10) });
  });

  router.delete('/contacts/:id', (req, res) => {
    const employee = employeeStore.deleteEmployee(req.params.id);
    if (employee) bot.reloadAuthorizedContacts(`Contacto eliminado: ${employee.nombre}`);
    res.json({ success: Boolean(employee), employee, logs: bot.getLogs(10) });
  });

  router.delete('/images/:id', (req, res) => {
    const image = bot.deleteImage(req.params.id);
    res.json({ success: Boolean(image), image, logs: bot.getLogs(10) });
  });

  router.get('/qr', (_req, res) => {
    res.json({ success: true, qr: bot.getQrData(), status: bot.getStatus().status });
  });

  router.post('/start', async (_req, res, next) => {
    try {
      await bot.startBotProcess();
      const status = bot.getStatus();
      const conflict = status.sessionConflict;
      res.status(conflict ? 409 : status.status === 'stopped' ? 503 : 200).json({
        success: !conflict && status.status !== 'stopped',
        message: conflict
          ? 'Ya hay una sesión de WhatsApp Web abierta con este perfil. Se evitó abrir un segundo navegador.'
          : undefined,
        status
      });
    } catch (error: unknown) {
      next(error);
    }
  });

  router.post('/control', async (req, res, next) => {
    try {
      const { action } = req.body;
      let started = true;
      if (action === 'start') {
        started = await bot.startBotProcess();
      } else if (action === 'stop') {
        await bot.stopBotProcess();
      } else if (action === 'disconnect') {
        await bot.disconnectWhatsApp();
      } else if (action === 'restart') {
        await bot.restartBotProcess();
      } else if (action === 'clear_logs') {
        bot.clearLogs();
      } else if (action === 'regenerate_qr') {
        await bot.regenerateQr();
      }

      const status = bot.getStatus();
      const conflict = (action === 'start' && !started)
        || (['start', 'restart', 'regenerate_qr'].includes(action) && status.sessionConflict);
      res.status(conflict ? 409 : 200).json({
        success: !conflict,
        message: conflict
          ? 'Ya hay una sesión de WhatsApp Web abierta con este perfil. Se evitó abrir un segundo navegador.'
          : undefined,
        status,
        logs: bot.getLogs(15)
      });
    } catch (error: unknown) {
      next(error);
    }
  });

  return router;
}
