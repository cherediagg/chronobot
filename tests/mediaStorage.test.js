const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { saveImageMessage } = require('../lib/mediaStorage');

async function run() {
  const rootDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'chronobot-media-'));
  const imageBytes = Buffer.from('imagen de prueba');
  let downloadCount = 0;

  try {
    const saved = await saveImageMessage({
      timestamp: 1_798_000_000,
      id: { _serialized: 'message-123' },
      downloadMedia: async () => {
        downloadCount += 1;
        return {
          mimetype: 'image/png',
          data: imageBytes.toString('base64')
        };
      }
    }, 'Ana Pérez', { rootDirectory });

    assert.equal(downloadCount, 1, 'Debe descargar el adjunto una sola vez.');
    assert.equal(path.extname(saved.filePath), '.png', 'Debe conservar la extensión del MIME.');
    assert.deepEqual(fs.readFileSync(saved.filePath), imageBytes, 'Debe guardar los bytes recibidos.');
    console.log('mediaStorage OK');
  } finally {
    fs.rmSync(rootDirectory, { recursive: true, force: true });
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
