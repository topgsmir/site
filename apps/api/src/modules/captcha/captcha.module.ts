import { Module } from "@nestjs/common";
import { CaptchaController } from "./captcha.controller";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [CaptchaController],
  providers: []
})
export class CaptchaModule {}
