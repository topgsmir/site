import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { GoghdiController } from "./goghdi.controller";
import { GoghdiService } from "./goghdi.service";

@Module({
  imports: [AuthModule],
  controllers: [GoghdiController],
  providers: [GoghdiService]
})
export class GoghdiModule {}
