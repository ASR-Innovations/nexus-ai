import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { WsAdapter } from '@nestjs/platform-ws';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { validateEnvironment } from './config/env.validation';
import { AllExceptionsFilter } from './shared/filters/all-exceptions.filter';

async function bootstrap() {
  // Validate environment variables before starting the application
  console.log('Validating environment configuration...');
  const envConfig = validateEnvironment();
  console.log('✅ Environment validation passed');
  
  const app = await NestFactory.create(AppModule);
  
  // Configure WebSocket adapter
  app.useWebSocketAdapter(new WsAdapter(app));
  
  // Security middleware
  app.use(helmet());
  
  // Global exception filter
  app.useGlobalFilters(new AllExceptionsFilter());
  
  // Global API prefix
  app.setGlobalPrefix('api');
  
  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));
  
  // CORS configuration
  const corsOrigins = envConfig.CORS_ORIGINS.split(',').map(origin => origin.trim());
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });
  
  const port = envConfig.PORT;
  const host = envConfig.HOST;
  
  await app.listen(port, host);
  
  console.log(`🚀 NexusAI Backend running on http://${host}:${port}`);
  console.log(`🔌 WebSocket server available at ws://${host}:${port}/ws`);
  console.log(`📊 Environment: ${envConfig.NODE_ENV}`);
  console.log(`🔗 Polkadot Hub RPC: ${envConfig.POLKADOT_HUB_RPC_URL}`);
  console.log(`💾 Database: ${envConfig.DB_HOST}:${envConfig.DB_PORT}/${envConfig.DB_NAME}`);
  console.log(`🔴 Redis: ${envConfig.REDIS_HOST}:${envConfig.REDIS_PORT}`);
  
  if (envConfig.NODE_ENV === 'development') {
    console.log(`📚 API Documentation: http://${host}:${port}/api/docs`);
  }
}

bootstrap().catch(error => {
  console.error('❌ Failed to start NexusAI Backend:', error);
  process.exit(1);
});