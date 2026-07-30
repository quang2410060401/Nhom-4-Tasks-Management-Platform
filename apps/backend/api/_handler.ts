import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module';
import { configureNestApplication } from '../src/app.bootstrap';

export type VercelRequestHandler = (
  req: unknown,
  res: unknown,
) => void | Promise<void>;

let cachedHandler: VercelRequestHandler | null = null;

async function getHandler(): Promise<VercelRequestHandler> {
  if (cachedHandler) {
    return cachedHandler;
  }

  const adapter = new ExpressAdapter();
  const nestApp = await NestFactory.create(AppModule, adapter, {
    bufferLogs: true,
  });

  await configureNestApplication(nestApp);
  await nestApp.init();

  cachedHandler = adapter.getInstance() as VercelRequestHandler;
  return cachedHandler;
}

export const config = {
  api: {
    bodyParser: false,
  },
};

export async function forwardToNest(
  req: Parameters<VercelRequestHandler>[0],
  res: Parameters<VercelRequestHandler>[1],
): Promise<void> {
  const appHandler = await getHandler();
  await appHandler(req, res);
}
