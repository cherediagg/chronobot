const fs = require('node:fs');
const { createConnection } = require('node:net');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const qrcodeTerminal = require('qrcode-terminal');

const {
  buildAllowedNumbers,
  loadEmployees,
  normalizePhoneNumber,
  EMPLOYEES_FILE_PATH
} = require('./lib/contacts');
const { downloadMediaSafely, saveImageMessage } = require('./lib/mediaStorage');

const AUTH_DIRECTORY = path.resolve(__dirname, '.wwebjs_auth');
const SESSION_LOCK_PATH = path.join(AUTH_DIRECTORY, 'chronobot.lock');
const RUNTIME_STATUS_PATH = path.join(AUTH_DIRECTORY, 'chronobot-runtime.json');
const RUNTIME_LOG_PATH = path.join(AUTH_DIRECTORY, 'chronobot-runtime.jsonl');
const RUNTIME_COMMAND_PATH = path.join(AUTH_DIRECTORY, 'chronobot-command.json');
const IMAGES_DIRECTORY = path.resolve(__dirname, 'public', 'imagenes');
const EMBEDDED = process.env.CHRONOBOT_EMBEDDED === '1';

let employees = loadEmployees();
let allowedNumbers = buildAllowedNumbers(employees);
let runtimeStatus = 'connecting';
let connectedPhone = '';
let runtimeStartedAt = Date.now();
let runtimeSequence = 0;
let runtimeSessionLock = null;
let runtimeQrData = { raw: '', dataUrl: '', generatedAt: 0, expiresInSeconds: 20 };

function writeRuntimeStatus() {
  if (EMBEDDED || !runtimeSessionLock) return;
  fs.writeFileSync(RUNTIME_STATUS_PATH, JSON.stringify({
    pid: process.pid,
    token: runtimeSessionLock.token,
    status: runtimeStatus,
    connectedPhone,
    qrData: runtimeQrData,
    startedAt: runtimeStartedAt,
    updatedAt: Date.now()
  }));
}

function persistRuntimeEvent(event) {
  if (EMBEDDED || !runtimeSessionLock || event.type === 'qr') return;

  fs.mkdirSync(AUTH_DIRECTORY, { recursive: true });
  let contents = '';
  try {
    contents = fs.readFileSync(RUNTIME_LOG_PATH, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const lines = contents.split(/\r?\n/).filter(Boolean);
  if (Buffer.byteLength(contents) > 512 * 1024) {
    fs.writeFileSync(RUNTIME_LOG_PATH, `${lines.slice(-500).join('\n')}\n`);
  }

  fs.appendFileSync(RUNTIME_LOG_PATH, `${JSON.stringify({
    id: `${process.pid}-${++runtimeSequence}`,
    event,
    emittedAt: Date.now()
  })}\n`);
}

function emit(event) {
  if (event.type === 'ready') {
    runtimeStatus = 'active';
    connectedPhone = event.connectedPhone || '';
    runtimeQrData = { raw: '', dataUrl: '', generatedAt: 0, expiresInSeconds: 20 };
  } else if (event.type === 'qr') {
    runtimeStatus = 'waiting_qr';
    connectedPhone = '';
    runtimeQrData = {
      raw: event.raw || '',
      dataUrl: event.dataUrl || '',
      generatedAt: event.generatedAt || Date.now(),
      expiresInSeconds: event.expiresInSeconds || 20
    };
  } else if (event.type === 'status' && event.status) {
    runtimeStatus = event.status;
    if (event.status === 'disconnected' || event.status === 'connecting') {
      connectedPhone = '';
      runtimeQrData = { raw: '', dataUrl: '', generatedAt: 0, expiresInSeconds: 20 };
    }
  } else if (event.type === 'session_conflict') {
    runtimeStatus = 'disconnected';
    connectedPhone = '';
  }

  if (EMBEDDED) {
    process.stdout.write(`${JSON.stringify(event)}\n`);
    return;
  }

  persistRuntimeEvent(event);
  writeRuntimeStatus();

  if (event.type === 'log') {
    const method = event.level === 'error' ? 'error' : event.level === 'warn' ? 'warn' : 'log';
    console[method](`[${new Date().toLocaleString('es-ES')}] ${event.message}`, event.details ?? '');
  }
}

function log(level, message, details) {
  emit({ type: 'log', level, message, details });
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code !== 'ESRCH';
  }
}

function acquireSessionLock() {
  fs.mkdirSync(AUTH_DIRECTORY, { recursive: true });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const lock = { pid: process.pid, token: randomUUID(), startedAt: Date.now() };
    try {
      const fd = fs.openSync(SESSION_LOCK_PATH, 'wx');
      fs.writeFileSync(fd, JSON.stringify(lock));
      fs.closeSync(fd);
      return lock;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;

      let existingLock;
      try {
        existingLock = JSON.parse(fs.readFileSync(SESSION_LOCK_PATH, 'utf8'));
      } catch {
        log('error', `No se puede verificar el bloqueo de WhatsApp en ${SESSION_LOCK_PATH}. No se iniciará un segundo cliente.`);
        return null;
      }

      const ownerPid = Number(existingLock.pid);
      if (!Number.isInteger(ownerPid) || ownerPid <= 0 || isProcessAlive(ownerPid)) {
        emit({
          type: 'session_conflict',
          ownerPid: Number.isInteger(ownerPid) && ownerPid > 0 ? ownerPid : undefined
        });
        log('warn', `Ya hay una sesión de ChronoBot abierta${ownerPid ? ` (PID ${ownerPid})` : ''}. No se iniciará otro cliente.`);
        return null;
      }

      fs.unlinkSync(SESSION_LOCK_PATH);
    }
  }

  return null;
}

function releaseSessionLock(lock) {
  try {
    const currentLock = JSON.parse(fs.readFileSync(SESSION_LOCK_PATH, 'utf8'));
    if (currentLock.token === lock.token) {
      fs.unlinkSync(SESSION_LOCK_PATH);
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      log('warn', 'No se pudo liberar el bloqueo de sesión de ChronoBot:', error.message);
    }
  }
}

function isBrowserAlreadyOpen() {
  const activePortPath = path.join(AUTH_DIRECTORY, 'session', 'DevToolsActivePort');
  if (!fs.existsSync(activePortPath)) return Promise.resolve(false);

  const port = Number(fs.readFileSync(activePortPath, 'utf8').split(/\r?\n/, 1)[0]);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return Promise.resolve(false);

  return new Promise(resolve => {
    const socket = createConnection({ host: '127.0.0.1', port });
    const finish = isOpen => {
      socket.destroy();
      resolve(isOpen);
    };
    socket.setTimeout(1000);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

function refreshAllowedNumbers() {
  employees = loadEmployees();
  allowedNumbers = buildAllowedNumbers(employees);
  log('log', `Contactos autorizados recargados desde ${EMPLOYEES_FILE_PATH}: ${Object.keys(allowedNumbers).length}`);
  return allowedNumbers;
}

function normalizeWhatsAppPhone(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const trimmed = value.trim();
  if (/@(lid|g\.us)$/i.test(trimmed)) return null;
  const withoutServer = trimmed.replace(/@(c\.us|s\.whatsapp\.net)$/i, '');
  return normalizePhoneNumber(withoutServer) || null;
}

function sendText(client, phoneNumber, text) {
  const normalized = normalizeWhatsAppPhone(phoneNumber);
  if (!normalized) return Promise.reject(new Error('Número de teléfono no válido.'));
  return client.sendMessage(`${normalized}@c.us`, text, { sendSeen: false });
}

async function resolveSender(client, message) {
  const senderId = message.author || message.from;
  if (!senderId || senderId.endsWith('@g.us')) {
    return { phoneNumber: null, contact: null };
  }

  if (senderId.endsWith('@c.us') || senderId.endsWith('@s.whatsapp.net')) {
    let contact = null;
    try {
      contact = await message.getContact();
    } catch (error) {
      log('warn', 'No se pudo consultar el contacto:', error.message);
    }

    return {
      phoneNumber: normalizeWhatsAppPhone(contact?.number || contact?.id?.user || senderId),
      contact
    };
  }

  if (senderId.endsWith('@lid')) {
    log('log', 'Resolviendo LID:', senderId);
    try {
      if (typeof client.getContactLidAndPhone !== 'function') {
        log('error', 'Esta versión de whatsapp-web.js no dispone de getContactLidAndPhone(). Actualiza la dependencia.');
        return { phoneNumber: null, contact: null };
      }

      const results = await client.getContactLidAndPhone([senderId]);
      const match = Array.isArray(results)
        ? results.find(item => item.lid === senderId || item.lid === senderId.replace('@lid', '')) || results[0]
        : null;
      const phoneNumber = normalizeWhatsAppPhone(match?.pn || match?.phoneNumber || match?.phone);

      let contact = null;
      try {
        contact = await message.getContact();
      } catch (error) {
        log('warn', 'No se pudo obtener el contacto del mensaje:', error.message);
      }

      if (phoneNumber) {
        log('log', 'Número real resuelto:', phoneNumber);
      } else {
        log('warn', 'WhatsApp no ha devuelto un número de teléfono para este LID:', senderId);
      }
      return { phoneNumber, contact };
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
    authStrategy: new LocalAuth({ dataPath: AUTH_DIRECTORY }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  });
  let stopping = false;
  const stopClient = async action => {
    if (stopping) return;
    stopping = true;
    try {
      if (action === 'logout') {
        await client.logout();
        log('log', 'Sesión de WhatsApp cerrada.');
      } else {
        await client.destroy();
        log('log', 'Cliente de WhatsApp detenido.');
      }
    } catch (error) {
      log('error', `No se pudo ${action === 'logout' ? 'cerrar la sesión' : 'detener el cliente'} de WhatsApp:`, error?.stack || error);
    } finally {
      runtimeStatus = 'stopped';
      writeRuntimeStatus();
      process.exit(0);
    }
  };

  client.on('qr', async qr => {
    try {
      const dataUrl = await QRCode.toDataURL(qr, {
        width: 340,
        margin: 2,
        color: { dark: '#031c13', light: '#ffffff' }
      });
      emit({ type: 'qr', raw: qr, dataUrl, generatedAt: Date.now(), expiresInSeconds: 20 });
      if (!EMBEDDED) {
        if (process.stdout.isTTY) {
          qrcodeTerminal.generate(qr, { small: true });
        }
        log('log', 'Escanea el código QR de WhatsApp Web para conectar:');
      }
    } catch (error) {
      log('error', 'No se pudo generar la imagen del código QR:', error?.stack || error);
    }
  });

  client.on('authenticated', () => {
    emit({ type: 'status', status: 'connecting' });
    log('log', 'Autenticación correcta.');
  });

  client.on('auth_failure', error => {
    emit({ type: 'status', status: 'disconnected' });
    log('error', 'Error de autenticación:', error);
  });

  client.on('ready', () => {
    const connectedPhone = client.info?.wid?.user ? `+${client.info.wid.user}` : '';
    emit({ type: 'ready', connectedPhone });
    log('log', 'Cliente conectado y listo.');
    log('log', `Contactos autorizados: ${Object.keys(buildAllowedNumbers(loadEmployees())).length}`);
    log('log', 'Esperando mensajes entrantes...');
  });

  client.on('disconnected', reason => {
    emit({ type: 'status', status: 'disconnected' });
    log('error', 'Cliente desconectado:', reason);
  });

  client.on('change_state', state => log('log', 'Estado de WhatsApp:', state));

  client.on('message', async message => {
    log('log', `Mensaje recibido de ${message.from}: ${message.body || '(sin texto)'}`, {
      from: message.from,
      type: message.type,
      hasMedia: message.hasMedia,
      body: message.body || ''
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
        log('warn', 'No se pudo resolver el teléfono. Mensaje no procesado por seguridad.');
        return;
      }

      const currentAllowedNumbers = buildAllowedNumbers(loadEmployees());
      const contactName = currentAllowedNumbers[phoneNumber];
      if (!contactName) {
        log('warn', 'Número no autorizado:', phoneNumber);
        emit({ type: 'unauthorized', phoneNumber });
        return;
      }

      allowedNumbers = currentAllowedNumbers;
      log('log', 'Contacto autorizado:', contactName);

      if (!message.hasMedia) {
        log('log', 'Mensaje sin multimedia; no hay acción configurada.');
        emit({ type: 'message_received', contactName, phoneNumber, body: message.body || '' });
        return;
      }

      if (!['image', 'document'].includes(message.type)) {
        log('log', 'Tipo de multimedia ignorado:', message.type);
        return;
      }

      const media = await downloadMediaSafely(message);
      if (!media?.data) {
        throw new Error('WhatsApp no ha devuelto datos multimedia.');
      }
      if (!String(media.mimetype || '').toLowerCase().startsWith('image/')) {
        log('warn', 'El adjunto no es una imagen:', media.mimetype || 'tipo desconocido');
        return;
      }

      log('log', 'Descarga de imagen 1/1');
      const saved = await saveImageMessage(message, contactName, {
        media,
        rootDirectory: IMAGES_DIRECTORY
      });
      const relativePath = `/${path.relative(path.resolve(__dirname, 'public'), saved.filePath).split(path.sep).join('/')}`;
      log('log', 'Imagen guardada:', relativePath);
      emit({ type: 'image_saved', contactName, phoneNumber, fileName: saved.fileName, filePath: relativePath });

      const replyText = `Gracias ${contactName}, tu foto ${saved.fileName} se ha guardado correctamente.`;
      await sendText(client, phoneNumber, replyText);
      log('log', 'Confirmación enviada.');
    } catch (error) {
      log('error', 'Error procesando el mensaje:', error?.stack || error);
    }
  });

  client.on('error', error => log('error', 'Error del cliente de WhatsApp:', error?.stack || error));

  process.stdin.setEncoding('utf8');
  let commandBuffer = '';
  process.stdin.on('data', async data => {
    commandBuffer += data;
    const lines = commandBuffer.split(/\r?\n/);
    commandBuffer = lines.pop() || '';
    for (const line of lines.filter(Boolean)) {
      let command;
      try {
        command = JSON.parse(line);
      } catch (error) {
        log('error', 'Comando interno no válido:', error.message);
        continue;
      }

      if (command.action === 'logout' || command.action === 'stop') {
        await stopClient(command.action);
      }
    }
  });

  const commandPoll = setInterval(() => {
    if (EMBEDDED || !runtimeSessionLock || stopping) return;
    try {
      const command = JSON.parse(fs.readFileSync(RUNTIME_COMMAND_PATH, 'utf8'));
      if (command.token !== runtimeSessionLock.token || !['stop', 'logout'].includes(command.action)) return;
      fs.unlinkSync(RUNTIME_COMMAND_PATH);
      void stopClient(command.action);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        log('error', 'No se pudo leer el comando de control:', error.message);
      }
    }
  }, 500);
  commandPoll.unref();

  const heartbeat = setInterval(() => {
    if (EMBEDDED) {
      emit({ type: 'heartbeat', status: runtimeStatus, connectedPhone });
    } else {
      writeRuntimeStatus();
    }
  }, 5_000);
  heartbeat.unref();

  const activityEcho = setInterval(() => {
    if (runtimeStatus === 'active') {
      log('log', 'ChronoBot activo; esperando mensajes de WhatsApp.');
    }
  }, 60_000);
  activityEcho.unref();

  return client;
}

if (require.main === module) {
  (async () => {
    if (await isBrowserAlreadyOpen()) {
      emit({ type: 'session_conflict' });
      log('warn', 'Ya hay un navegador de WhatsApp Web abierto con este perfil. No se iniciará un segundo cliente.');
      process.stdin.pause();
      process.exitCode = 1;
      return;
    }

    let sessionLock;
    try {
      sessionLock = acquireSessionLock();
    } catch (error) {
      log('error', 'No se pudo reservar la sesión de WhatsApp:', error?.stack || error);
      process.exitCode = 1;
    }

    if (!sessionLock) {
      process.stdin.pause();
      process.exitCode = 1;
      return;
    }

    process.once('exit', () => releaseSessionLock(sessionLock));
    runtimeSessionLock = sessionLock;
    runtimeStatus = 'connecting';
    runtimeStartedAt = Date.now();
    fs.writeFileSync(RUNTIME_LOG_PATH, '');
    writeRuntimeStatus();

    const client = createBot();

    client.initialize().catch(error => {
      emit({ type: 'status', status: 'disconnected' });
      log('error', `Error inicializando el cliente: ${error?.message || error}`, error?.stack);
      client.destroy().catch(destroyError => {
        log('error', 'Error cerrando el cliente tras un fallo de inicialización:', destroyError?.stack || destroyError);
      }).finally(() => {
        process.stdin.pause();
        process.exitCode = 1;
      });
    });

    process.on('unhandledRejection', reason => log('error', 'Promesa rechazada sin gestionar:', reason));
    process.on('uncaughtException', error => {
      log('error', 'Excepción no capturada:', error?.stack || error);
      process.exit(1);
    });
  })().catch(error => {
    log('error', 'No se pudo comprobar el estado del navegador WhatsApp:', error?.stack || error);
    process.exitCode = 1;
  });
}

module.exports = {
  loadEmployees,
  refreshAllowedNumbers,
  getEmployees: () => employees,
  getAllowedNumbers: () => allowedNumbers,
  normalizeWhatsAppPhone,
  log,
  EMPLOYEES_FILE_PATH
};
