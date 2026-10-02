import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import * as path from 'path';

/** Shared by main.ts and the tests so both run with the same middleware. */
export function configureApp(app: NestExpressApplication) {
  app.use(cookieParser());
  // Uploaded product photos. File names are random UUIDs, so they can be cached forever.
  app.useStaticAssets(path.resolve(process.env.UPLOAD_DIR ?? 'uploads'), {
    prefix: '/uploads',
    index: false,
    dotfiles: 'deny',
    maxAge: '30d',
    immutable: true,
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'); // the web app is a different origin
    },
  });
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000', credentials: true });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
}
