import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ConfigService } from "@nestjs/config";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  const config = app.get(ConfigService);
  const port = Number(config.get("API_PORT") || 4000);
  app.setGlobalPrefix("api");
  await app.listen(port);
}

bootstrap();

