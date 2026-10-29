import { Request, Response } from 'express';
import { chronoBotSingleton } from '../../chronobot-engine';

export class MediaController {
  public static getImages(req: Request, res: Response): void {
    res.json({ images: chronoBotSingleton.getSavedImages() });
  }

  public static deleteImage(req: Request, res: Response): void {
    const id = String(req.params['id']);
    const image = chronoBotSingleton.deleteImage(id);
    res.json({ success: Boolean(image), image, logs: chronoBotSingleton.getLogs(10) });
  }
}
