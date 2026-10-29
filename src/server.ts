import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import {join} from 'node:path';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

import os from 'node:os';
import path from 'node:path';

app.use(express.json());
app.use('/imagenes', express.static(path.resolve(process.cwd(), 'public', 'imagenes')));

import { chronoBotSingleton } from './chronobot-engine';
import { employeeStore } from './server/employee-store';

/**
 * ChronoBot WhatsApp Integration REST API
 */
app.get('/api/bot/status', (req, res) => {
  res.json(chronoBotSingleton.getStatus());
});

app.get('/api/bot/system-stats', (req, res) => {
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
});

app.get('/api/bot/logs', (req, res) => {
  res.json({ logs: chronoBotSingleton.getLogs() });
});

app.get('/api/bot/events', (req, res) => {
  res.json({ events: chronoBotSingleton.getEvents() });
});

app.get('/api/bot/images', (req, res) => {
  res.json({ images: chronoBotSingleton.getSavedImages() });
});

// Server API handles employee querying & file metadata; ChronoBot only reads allowed contacts
app.get('/api/bot/contacts', (req, res) => {
  res.json({
    employees: employeeStore.getEmployees(),
    file: employeeStore.getEmployeeFileDetails()
  });
});

app.get('/api/bot/contacts/file', (req, res) => {
  res.json({
    success: true,
    file: employeeStore.getEmployeeFileDetails()
  });
});

app.put('/api/bot/contacts/file', (req, res) => {
  const { rawJson } = req.body;
  const result = employeeStore.saveRawEmployeesFile(rawJson);
  chronoBotSingleton.reloadAuthorizedContacts('Fichero reescrito');
  res.json({
    ...result,
    employees: employeeStore.getEmployees(),
    file: employeeStore.getEmployeeFileDetails(),
    logs: chronoBotSingleton.getLogs(10)
  });
});

// Server API handles employee addition
app.post('/api/bot/contacts', (req, res) => {
  const employee = employeeStore.addEmployee(req.body);
  chronoBotSingleton.reloadAuthorizedContacts(`Contacto añadido: ${employee.nombre}`);
  res.json({
    success: true,
    employee,
    file: employeeStore.getEmployeeFileDetails(),
    logs: chronoBotSingleton.getLogs(10)
  });
});

// Server API handles employee updates
app.put('/api/bot/contacts/:id', (req, res) => {
  const employee = employeeStore.updateEmployee(req.params.id, req.body);
  if (employee) {
    chronoBotSingleton.reloadAuthorizedContacts(`Contacto actualizado: ${employee.nombre}`);
  }
  res.json({
    success: Boolean(employee),
    employee,
    file: employeeStore.getEmployeeFileDetails(),
    logs: chronoBotSingleton.getLogs(10)
  });
});

// Server API handles toggling employee authorization
app.put('/api/bot/contacts/:id/toggle', (req, res) => {
  const employee = employeeStore.toggleEmployeeActive(req.params.id);
  if (employee) {
    chronoBotSingleton.reloadAuthorizedContacts(`Permiso modificado: ${employee.nombre} (${employee.activo ? 'AUTORIZADO' : 'REVOCADO'})`);
  }
  res.json({
    success: Boolean(employee),
    employee,
    file: employeeStore.getEmployeeFileDetails(),
    logs: chronoBotSingleton.getLogs(10)
  });
});

// Server API handles employee deletion
app.delete('/api/bot/contacts/:id', (req, res) => {
  const employee = employeeStore.deleteEmployee(req.params.id);
  if (employee) {
    chronoBotSingleton.reloadAuthorizedContacts(`Contacto eliminado: ${employee.nombre}`);
  }
  res.json({
    success: Boolean(employee),
    employee,
    file: employeeStore.getEmployeeFileDetails(),
    logs: chronoBotSingleton.getLogs(10)
  });
});

app.delete('/api/bot/images/:id', (req, res) => {
  const image = chronoBotSingleton.deleteImage(req.params.id);
  res.json({ success: Boolean(image), image, logs: chronoBotSingleton.getLogs(10) });
});

app.get('/api/bot/qr', (req, res) => {
  res.json({ success: true, qr: chronoBotSingleton.getQrData(), status: chronoBotSingleton.getStatus().status });
});

app.post('/api/bot/start', async (req, res) => {
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
});

app.post('/api/bot/control', async (req, res) => {
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
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
