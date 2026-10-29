const fs = require('node:fs');
const path = require('node:path');

/**
 * Guarda la imagen enviada en un mensaje de WhatsApp.
 * Crea las carpetas necesarias organizadas por contacto y por mes.
 */
async function saveImageMessage(message, contactName) {
  if (!message.hasMedia) {
    throw new Error('El mensaje no tiene contenido multimedia.');
  }

  const media = await message.downloadMedia();
  if (!media || !media.data) {
    throw new Error('WhatsApp no ha devuelto datos multimedia.');
  }

  const mimeType = String(media.mimetype || '').toLowerCase();
  let extension = 'jpg';
  if (mimeType.includes('png')) extension = 'png';
  else if (mimeType.includes('webp')) extension = 'webp';
  else if (mimeType.includes('gif')) extension = 'gif';

  const date = new Date();
  const month = date.toLocaleString('es-ES', { month: 'long' }).toLowerCase();
  const dateFormatted = date.toLocaleDateString('es-ES').replace(/\//g, '-');
  const timeFormatted = date.toLocaleTimeString('es-ES', { hour12: false }).replace(/:/g, '-');
  const uniqueId = Math.random().toString(36).substring(2, 8);
  const fileName = `${dateFormatted}_${timeFormatted}_${uniqueId}.${extension}`;

  const safeContact = String(contactName || 'contacto').replace(/[^a-zA-Z0-9_\-\s]/g, '').trim() || 'contacto';
  const targetDir = path.resolve(process.cwd(), 'public', 'imagenes', safeContact, month);

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const filePath = path.join(targetDir, fileName);
  const buffer = Buffer.from(media.data, 'base64');
  fs.writeFileSync(filePath, buffer);

  const relativePath = `/imagenes/${safeContact}/${month}/${fileName}`;

  return {
    fileName,
    filePath: relativePath,
    fullPath: filePath
  };
}

module.exports = {
  saveImageMessage
};
