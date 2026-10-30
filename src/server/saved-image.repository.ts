import fs from 'node:fs';
import path from 'node:path';

export interface ChronoSavedImage {
  id: string;
  senderName: string;
  senderPhone: string;
  dateFormatted: string;
  timeFormatted: string;
  filename: string;
  path: string;
  imageUrl: string;
  size: string;
  dimensions: string;
  category?: string;
}

export class SavedImageRepository {
  constructor(private readonly rootDirectory = path.resolve(process.cwd(), 'public', 'imagenes')) {}

  scan(phoneForContact: (name: string) => string): ChronoSavedImage[] {
    const results: ChronoSavedImage[] = [];

    try {
      if (!fs.existsSync(this.rootDirectory)) {
        fs.mkdirSync(this.rootDirectory, { recursive: true });
        return results;
      }

      const contactDirectories = fs.readdirSync(this.rootDirectory, { withFileTypes: true });
      for (const contactDirectory of contactDirectories) {
        if (!contactDirectory.isDirectory()) continue;
        const contactPath = path.join(this.rootDirectory, contactDirectory.name);
        const monthDirectories = fs.readdirSync(contactPath, { withFileTypes: true });
        for (const monthDirectory of monthDirectories) {
          if (!monthDirectory.isDirectory()) continue;
          const monthPath = path.join(contactPath, monthDirectory.name);
          const files = fs.readdirSync(monthPath, { withFileTypes: true });
          for (const file of files) {
            if (!file.isFile()) continue;
            const fullPath = path.join(monthPath, file.name);
            const stat = fs.statSync(fullPath);
            const sizeKb = (stat.size / 1024).toFixed(1);
            const sizeMb = (stat.size / (1024 * 1024)).toFixed(2);
            const contactName = contactDirectory.name.replace(/_/g, ' ');
            const relativeWebPath = `/imagenes/${contactDirectory.name}/${monthDirectory.name}/${file.name}`;

            results.push({
              id: `img-${stat.mtimeMs}-${file.name}`,
              senderName: contactName,
              senderPhone: phoneForContact(contactName),
              dateFormatted: stat.mtime.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }),
              timeFormatted: stat.mtime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
              filename: file.name,
              path: relativeWebPath,
              imageUrl: relativeWebPath,
              size: stat.size >= 1024 * 1024 ? `${sizeMb} MB` : `${sizeKb} KB`,
              dimensions: 'Nativo',
              category: monthDirectory.name
            });
          }
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[SavedImageRepository] Error escaneando ${this.rootDirectory}: ${message}`);
    }

    return results.sort((a, b) => b.id.localeCompare(a.id));
  }

  delete(image: ChronoSavedImage) {
    const relativePath = image.path.replace(/^\/imagenes\//, '');
    const fullPath = path.resolve(this.rootDirectory, relativePath);
    const rootPrefix = `${path.resolve(this.rootDirectory)}${path.sep}`;
    if (!fullPath.startsWith(rootPrefix)) {
      throw new Error('La ruta de imagen está fuera del directorio permitido.');
    }
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  }
}
