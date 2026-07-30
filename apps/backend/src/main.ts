import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  configureNestApplication,
  logBootSummary,
} from './app.bootstrap';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const { port, swaggerEnabled } = await configureNestApplication(app);

  await app.listen(port);
  logBootSummary(port, swaggerEnabled);
}

void bootstrap();
