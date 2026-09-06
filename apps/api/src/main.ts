import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { AppModule } from "./app.module";
import { ConfigService } from "@nestjs/config";
import {
  getAllowedWebOrigins,
  validateSecurityConfig
} from "./modules/auth/security-config";
import { SecureSocketIoAdapter } from "./modules/realtime/secure-socket-io.adapter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  const config = app.get(ConfigService);
  const port = Number(config.get("API_PORT") || 4000);
  const environment = config.get<string>("NODE_ENV") ?? "development";
  const host =
    config.get<string>("API_HOST")?.trim() ||
    (environment === "production" ? "0.0.0.0" : "127.0.0.1");
  const { trustProxyHops } = validateSecurityConfig(config);
  const allowedOrigins = getAllowedWebOrigins(config);
  if (trustProxyHops > 0) {
    app.getHttpAdapter().getInstance().set("trust proxy", trustProxyHops);
  }
  app.enableCors({ origin: allowedOrigins, credentials: true });
  app.useWebSocketAdapter(new SecureSocketIoAdapter(app, allowedOrigins));
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })
  );
  app.setGlobalPrefix("api");
  await app.listen(port, host);
}

bootstrap();
