
const fs = require('node:fs');
const path = require('node:path');

const ROOT_IMAGE_DIRECTORY = path.resolve(__dirname, '..', 'imagenes');
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1500;

const MIME_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

function normalizeBase64Data(data) {
  if (typeof data !== 'string') return '';

  const trimmed = data.trim();
  if (!trimmed) return '';

  const match = trimmed.match(
    /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/is
  );

  return (match ? match[2] : trimmed).replace(/\s+/g, '');
}

function ensureDirectoryExists(dirPath) {
  if (!dirPath) {
    throw new Error('La ruta del directorio no es válida.');
  }

  fs.mkdirSync(dirPath, { recursive: true });
}

function getMimeExtension(mimeType = 'image/jpeg') {
  const mime = String(mimeType)
    .split(';')[0]
    .trim()
    .toLowerCase();

  return MIME_EXTENSIONS[mime] || null;
}

function sanitizeName(value) {
  return String(value || 'sin_contacto')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 80) || 'sin_contacto';
}

function buildImageTargetPath({
  contactName,
  timestamp,
  mimeType,
  rootDirectory = ROOT_IMAGE_DIRECTORY,
  messageId,
}) {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    throw new Error('La fecha de la imagen no es válida.');
  }

  const extension = getMimeExtension(mimeType);

  if (!extension) {
    throw new Error(`Formato de imagen no admitido: ${mimeType}`);
  }

  const month = date
    .toLocaleString('es-ES', { month: 'long' })
    .toLowerCase();

  const dateFormatted = date
    .toLocaleDateString('es-ES')
    .replace(/\//g, '-');

  const timeFormatted = date
    .toLocaleTimeString('es-ES', { hour12: false })
    .replace(/:/g, '-');

  const uniqueId = sanitizeName(
    messageId || `${date.getTime()}_${process.hrtime.bigint()}`
  );

  const directory = path.join(
    rootDirectory,
    sanitizeName(contactName),
    month
  );

  const fileName =
    `${dateFormatted}_${timeFormatted}_${uniqueId}.${extension}`;

  return {
    directory,
    filePath: path.join(directory, fileName),
    fileName,
  };
}

function validateMedia(media) {
  if (!media || typeof media.data !== 'string') {
    throw new Error('WhatsApp no ha devuelto datos de imagen.');
  }

  const extension = getMimeExtension(media.mimetype);

  if (!extension) {
    throw new Error(`Formato multimedia no admitido: ${media.mimetype}`);
  }

  const base64 = normalizeBase64Data(media.data);

  if (
    !base64 ||
    base64.length % 4 === 1 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)
  ) {
    throw new Error('Los datos Base64 no son válidos.');
  }

  const buffer = Buffer.from(base64, 'base64');

  if (buffer.length === 0) {
    throw new Error('La imagen descargada está vacía.');
  }

  return buffer;
}

function writeMediaToDisk(rawMedia, filePath) {
  if (!filePath) {
    throw new Error('La ruta de destino no es válida.');
  }

  const buffer = Buffer.isBuffer(rawMedia)
    ? rawMedia
    : Buffer.from(normalizeBase64Data(rawMedia), 'base64');

  if (buffer.length === 0) {
    throw new Error('No hay datos para guardar.');
  }

  ensureDirectoryExists(path.dirname(filePath));

  // Evita sobrescribir accidentalmente una imagen anterior.
  fs.writeFileSync(filePath, buffer, { flag: 'wx' });

  const stats = fs.statSync(filePath);

  if (!stats.isFile() || stats.size !== buffer.length) {
    throw new Error('No se pudo verificar el archivo guardado.');
  }

  return true;
}

async function downloadMediaSafely(message, retries = MAX_ATTEMPTS) {
  const attempts = Math.max(1, Number(retries) || 1);
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      console.log(`[MEDIA] Descarga ${attempt}/${attempts}`);

      const media = await message.downloadMedia();

      if (!media || !media.data) {
        throw new Error('WhatsApp no ha devuelto datos multimedia.');
      }

      // Comprueba que la descarga contiene datos utilizables.
      validateMedia(media);

      return media;
    } catch (error) {
      lastError = error;

      console.error(
        `[MEDIA] Fallo en intento ${attempt}:`,
        error.message || error
      );

      if (attempt < attempts) {
        await new Promise((resolve) =>
          setTimeout(resolve, RETRY_DELAY_MS)
        );
      }
    }
  }

  throw lastError || new Error('No se pudo descargar la imagen.');
}

async function saveImageMessage(
  message,
  contactName,
  options = {}
) {
  const media = await downloadMediaSafely(message);
  const buffer = validateMedia(media);

  const timestamp = Number(message.timestamp) > 0
    ? Number(message.timestamp) * 1000
    : Date.now();

  const target = buildImageTargetPath({
    contactName,
    timestamp,
    mimeType: media.mimetype,
    rootDirectory: options.rootDirectory || ROOT_IMAGE_DIRECTORY,
    messageId: message.id?._serialized,
  });

  writeMediaToDisk(buffer, target.filePath);

  console.log('[MEDIA] Imagen guardada:', {
    path: target.filePath,
    bytes: buffer.length,
  });

  return {
    ...target,
    size: buffer.length,
  };
}

module.exports = {
  normalizeBase64Data,
  ensureDirectoryExists,
  getMimeExtension,
  buildImageTargetPath,
  writeMediaToDisk,
  downloadMediaSafely,
  saveImageMessage,
};
