import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import RedisStore from 'connect-redis';
import session from 'express-session';
import { createClient } from 'redis';
import { AppModule } from './app.module';
import { readSessionConfig } from './config/session.config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);
  const sessionConfig = readSessionConfig(config);
  const redis = createClient({
    socket: { host: config.get<string>('REDIS_HOST', 'localhost'), port: config.get<number>('REDIS_PORT', 6379) },
    password: config.get<string>('REDIS_PASSWORD') || undefined,
  });
  redis.on('error', (error) => console.error('Redis session store error', error));
  await redis.connect();

  if (config.get<string>('TRUST_PROXY', 'false') === 'true') app.set('trust proxy', 1);
  app.use(session({
    name: sessionConfig.cookieName,
    secret: sessionConfig.secret,
    store: new RedisStore({ client: redis, prefix: 'jivatax:sess:', ttl: sessionConfig.ttlSeconds }),
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: { httpOnly: true, secure: sessionConfig.secure, sameSite: sessionConfig.sameSite, maxAge: sessionConfig.ttlSeconds * 1000, path: '/' },
  }));
  app.use((_request, response, next) => { response.setHeader('Cache-Control', 'no-store'); next(); });

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: config.get<string>('WEB_ORIGIN', 'http://localhost:3000'),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = config.get<number>('API_PORT', 3001);
  await app.listen(port);
  console.log(`🚀 API running at http://localhost:${port}/api`);
}

void bootstrap();
