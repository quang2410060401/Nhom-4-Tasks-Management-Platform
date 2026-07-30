import {
  type INestApplication,
  Logger,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

function parseAllowedOrigins(configService: ConfigService): {
  exactOrigins: Set<string>;
  allowVercelPreviewOrigins: boolean;
} {
  const exactOrigins = new Set<string>();
  const singleOrigin = configService.get<string>('FRONTEND_URL');
  const multipleOrigins = configService.get<string>('FRONTEND_URLS');

  if (singleOrigin?.trim()) {
    exactOrigins.add(singleOrigin.trim());
  }

  if (multipleOrigins?.trim()) {
    multipleOrigins
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
      .forEach((origin) => exactOrigins.add(origin));
  }

  return {
    exactOrigins,
    allowVercelPreviewOrigins:
      configService.get<string>('ALLOW_VERCEL_PREVIEW_ORIGINS') === 'true',
  };
}

export async function configureNestApplication(
  app: INestApplication,
): Promise<{
  port: number;
  swaggerEnabled: boolean;
}> {
  const configService = app.get(ConfigService);
  const port = Number(configService.get<string>('PORT') ?? 3000);
  const swaggerEnabled =
    configService.get<string>('SWAGGER_ENABLED') !== 'false';
  const { exactOrigins, allowVercelPreviewOrigins } =
    parseAllowedOrigins(configService);

  app.setGlobalPrefix('api');

  app.enableCors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (exactOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      if (
        allowVercelPreviewOrigins &&
        /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.vercel\.app$/i.test(origin)
      ) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Tasks Management Platform API')
      .setDescription('Backend API documentation')
      .setVersion('1.0.0')
      .addBearerAuth()
      .build();

    const swaggerApp = app as unknown as Parameters<
      typeof SwaggerModule.createDocument
    >[0];

    const document = SwaggerModule.createDocument(swaggerApp, swaggerConfig);
    SwaggerModule.setup('api/docs', swaggerApp, document);
  }

  return {
    port,
    swaggerEnabled,
  };
}

export function logBootSummary(port: number, swaggerEnabled: boolean): void {
  const logger = new Logger('Bootstrap');
  logger.log(`Backend running on http://localhost:${port}`);
  if (swaggerEnabled) {
    logger.log(`Swagger docs available at http://localhost:${port}/api/docs`);
  }
}
