const path = require('node:path');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const {
  buildAllowedNumbers,
  loadEmployees,
  normalizePhoneNumber,
  EMPLOYEES_FILE_PATH
} = require('./lib/contacts');

const { saveImageMessage } = require('./lib/mediaStorage');

const AUTH_DIRECTORY = path.resolve(__dirname, '.wwebjs_auth');

let employees = loadEmployees();
let allowedNumbers = buildAllowedNumbers(employees);

function log(level, message, details) {
  const timestamp = new Date().toLocaleString('es-ES');

  if (details !== undefined) {
    console[level](`[${timestamp}] [${level.toUpperCase()}] ${message}`, details);
  } else {
    console[level](`[${timestamp}] [${level.toUpperCase()}] ${message}`);
  }
}

function refreshAllowedNumbers() {
  employees = loadEmployees();
  allowedNumbers = buildAllowedNumbers(employees);
  log('log', `Contactos autorizados recargados desde ${EMPLOYEES_FILE_PATH}: ${Object.keys(allowedNumbers).length}`);
  return allowedNumbers;
}

function normalizeWhatsAppPhone(value) {
  if (typeof value !== 'string' || !value.trim()) return null;

  // Admitir tanto identificadores telefónicos como números simples.
  const withoutServer = value.trim().replace(/@(c\.us|s\.whatsapp\.net)$/i, '');

  if (value.includes('@lid') || value.includes('@g.us')) return null;

  const normalized = normalizePhoneNumber(withoutServer);
  return normalized || null;
}

function sendText(client, phoneNumber, text) {
  const normalized = normalizeWhatsAppPhone(phoneNumber);

  if (!normalized) {
    return Promise.reject(new Error('Número de teléfono no válido.'));
  }

  return client.sendMessage(`${normalized}@c.us`, text, {
    sendSeen: false,
  });
}

/**
 * Intenta obtener el teléfono real de un mensaje entrante.
 * Los identificadores LID no deben interpretarse directamente como teléfonos.
 */
async function resolveSender(client, message) {
  const senderId = message.author || message.from;

  if (!senderId) {
    return { phoneNumber: null, contact: null };
  }

  if (senderId.endsWith('@g.us')) {
    return { phoneNumber: null, contact: null };
  }

  if (senderId.endsWith('@c.us') || senderId.endsWith('@s.whatsapp.net')) {
    let contact = null;

    try {
      contact = await message.getContact();
    } catch (error) {
      log('warn', 'No se pudo consultar el contacto:', error.message);
    }

    const phoneNumber = normalizeWhatsAppPhone(
      contact?.number ||
      contact?.id?.user ||
      senderId
    );

    return { phoneNumber, contact };
  }

  if (senderId.endsWith('@lid')) {
    log('log', 'Resolviendo LID:', senderId);

    try {
      if (typeof client.getContactLidAndPhone !== 'function') {
        log(
          'error',
          'Esta versión de whatsapp-web.js no dispone de getContactLidAndPhone(). Actualiza la dependencia.'
        );

        return { phoneNumber: null, contact: null };
      }

      const results = await client.getContactLidAndPhone([senderId]);

      log('log', 'Resultado de resolución LID:', results);

      const match = Array.isArray(results)
        ? results.find((item) =>
            item.lid === senderId ||
            item.lid === senderId.replace('@lid', '')
          ) || results[0]
        : null;

      const phoneNumber = normalizeWhatsAppPhone(
        match?.pn || match?.phoneNumber || match?.phone
      );

      let contact = null;

      try {
        contact = await message.getContact();
      } catch (error) {
        log('warn', 'No se pudo obtener el contacto del mensaje:', error.message);
      }

      if (phoneNumber) {
        log('log', 'Número real resuelto:', phoneNumber);
        return { phoneNumber, contact };
      }

      log(
        'warn',
        'WhatsApp no ha devuelto un número de teléfono para este LID:',
        senderId
      );

      return { phoneNumber: null, contact };
    } catch (error) {
      log('error', 'Error resolviendo el LID:', error?.stack || error);
      return { phoneNumber: null, contact: null };
    }
  }

  log('warn', 'Formato de remitente no reconocido:', senderId);
  return { phoneNumber: null, contact: null };
}

function createBot() {
  const client = new Client({
    authStrategy: new LocalAuth({
      dataPath: AUTH_DIRECTORY,
    }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    },
  });

  client.on('qr', (qr) => {
    log('log', 'Escanea el código QR para conectar:');
    log('log', `[QR_CODE_DATA] ${qr}`);
    qrcode.generate(qr, { small: true });
  });

  client.on('authenticated', () => {
    log('log', 'Autenticación correcta.');
  });

  client.on('auth_failure', (error) => {
    log('error', 'Error de autenticación:', error);
  });

  client.on('ready', () => {
    log('log', 'Cliente conectado y listo.');
    log('log', `Contactos autorizados: ${Object.keys(allowedNumbers).length}`);
    log('log', 'Esperando mensajes entrantes...');
  });

  client.on('disconnected', (reason) => {
    log('error', 'Cliente desconectado:', reason);
  });

  client.on('change_state', (state) => {
    log('log', 'Estado de WhatsApp:', state);
  });

  client.on('message', async (message) => {
    log('log', 'Mensaje recibido:', {
      from: message.from,
      type: message.type,
      hasMedia: message.hasMedia,
      body: message.body || '',
    });

    try {
      if (message.fromMe) {
        log('log', 'Mensaje propio ignorado.');
        return;
      }

      if (message.from?.endsWith('@g.us')) {
        log('log', 'Mensaje de grupo ignorado.');
        return;
      }

      const { phoneNumber } = await resolveSender(client, message);

      if (!phoneNumber) {
        log(
          'warn',
          'No se pudo resolver el teléfono. Mensaje no procesado por seguridad.'
        );
        return;
      }

      const contactName = allowedNumbers[phoneNumber];

      if (!contactName) {
        log('warn', 'Número no autorizado:', phoneNumber);
        return;
      }

      log('log', 'Contacto autorizado:', contactName);

      if (!message.hasMedia) {
        log('log', 'Mensaje sin multimedia; no hay acción configurada.');
        return;
      }

      if (!['image', 'document'].includes(message.type)) {
        log('log', 'Tipo de multimedia ignorado:', message.type);
        return;
      }

      log('log', 'ID completo del mensaje:', message.id);
      log('log', 'ID serializado:', message.id?._serialized);
      log('log', 'ID alternativo $1:', message.id?.$1);

      // Verificar que el adjunto sea una imagen antes de guardarlo.
      const media = await message.downloadMedia();

      if (!media?.data) {
        throw new Error('WhatsApp no ha devuelto datos multimedia.');
      }

      const mimeType = String(media.mimetype || '').toLowerCase();

      if (!mimeType.startsWith('image/')) {
        log('warn', 'El adjunto no es una imagen:', mimeType);
        return;
      }

      // La función de almacenamiento descarga de nuevo el mensaje.
      const saved = await saveImageMessage(message, contactName);

      log('log', 'Imagen guardada:', saved.filePath);

      await sendText(
        client,
        phoneNumber,
        `Gracias ${contactName}, tu foto ${saved.fileName} se ha guardado correctamente.`
      );

      log('log', 'Confirmación enviada.');
    } catch (error) {
      log('error', 'Error procesando el mensaje:', error?.stack || error);
    }
  });

  client.on('error', (error) => {
    log('error', 'Error del cliente de WhatsApp:', error?.stack || error);
  });

  return client;
}

if (require.main === module) {
  const client = createBot();

  client.initialize().catch((error) => {
    log('error', 'Error inicializando el cliente:', error?.stack || error);
  });
}

process.on('unhandledRejection', (reason) => {
  log('error', 'Promesa rechazada sin gestionar:', reason);
});

process.on('uncaughtException', (error) => {
  log('error', 'Excepción no capturada:', error?.stack || error);
  process.exit(1);
});

module.exports = {
  loadEmployees,
  refreshAllowedNumbers,
  getEmployees: () => employees,
  getAllowedNumbers: () => allowedNumbers,
  normalizeWhatsAppPhone,
  log,
  EMPLOYEES_FILE_PATH,
  createBot
};
