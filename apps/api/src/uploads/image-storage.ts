import { Injectable, Logger, UnsupportedMediaTypeException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

type Kind = { ext: 'jpg' | 'png' | 'webp' };

/**
 * Decide the real image type from the file's first bytes. The client-supplied mimetype and filename are
 * ignored, so a script or SVG renamed to ".jpg" is rejected.
 */
export function detectImage(buf: Buffer): Kind | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: 'jpg' };
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { ext: 'png' };
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return { ext: 'webp' };
  return null;
}

/**
 * Where uploaded images live. Local disk today; swap this class for S3/Cloudinary in production
 * (hosts with ephemeral disks lose local files on redeploy). Callers only see public paths.
 */
@Injectable()
export class ImageStorage {
  private readonly log = new Logger(ImageStorage.name);
  readonly dir = path.resolve(process.env.UPLOAD_DIR ?? 'uploads');
  private static readonly PATH = /^\/uploads\/([0-9a-f-]{36}\.(?:jpg|png|webp))$/;

  /** Validates and stores the image, returning its public path ("/uploads/<uuid>.<ext>"). */
  async save(buf: Buffer): Promise<string> {
    const kind = detectImage(buf);
    if (!kind) throw new UnsupportedMediaTypeException('Only JPEG, PNG or WebP images are allowed');
    await fs.mkdir(this.dir, { recursive: true });
    const name = `${randomUUID()}.${kind.ext}`;
    await fs.writeFile(path.join(this.dir, name), buf, { flag: 'wx' });
    return `/uploads/${name}`;
  }

  /** Removes a stored file. Ignores external URLs and anything that isn't one of our generated names. */
  async remove(publicPath: string): Promise<void> {
    const m = ImageStorage.PATH.exec(publicPath);
    if (!m) return;
    try {
      await fs.unlink(path.join(this.dir, m[1]));
    } catch (e: any) {
      if (e?.code !== 'ENOENT') this.log.warn(`Could not delete ${m[1]}: ${e?.message}`);
    }
  }
}
