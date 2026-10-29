import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { join } from 'node:path';
import path from 'node:path';

import { BotController } from './server/controllers/bot.controller';
import { ContactsController } from './server/controllers/contacts.controller';
import { MediaController } from './server/controllers/media.controller';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

app.use(express.json());
app.use('/imagenes', express.static(path.resolve(process.cwd(), 'public', 'imagenes')));

/**
 * ChronoBot WhatsApp Integration REST API Routes
 */

// Bot Status, Telemetry & Controls
app.get('/api/bot/status', BotController.getStatus);
app.get('/api/bot/system-stats', BotController.getSystemStats);
app.get('/api/bot/logs', BotController.getLogs);
app.get('/api/bot/events', BotController.getEvents);
app.get('/api/bot/qr', BotController.getQr);
app.post('/api/bot/start', BotController.startBot);
app.post('/api/bot/control', BotController.controlBot);

// Contacts & Employee File Operations
app.get('/api/bot/contacts', ContactsController.getContacts);
app.get('/api/bot/contacts/file', ContactsController.getFileMeta);
app.put('/api/bot/contacts/file', ContactsController.updateFile);
app.post('/api/bot/contacts', ContactsController.addContact);
app.put('/api/bot/contacts/:id', ContactsController.updateContact);
app.put('/api/bot/contacts/:id/toggle', ContactsController.toggleAuthorization);
app.delete('/api/bot/contacts/:id', ContactsController.deleteContact);

// Media Management
app.get('/api/bot/images', MediaController.getImages);
app.delete('/api/bot/images/:id', MediaController.deleteImage);

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
