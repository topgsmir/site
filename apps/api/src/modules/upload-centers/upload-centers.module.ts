import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AdminUploadCentersController, UploadCentersController } from "./upload-centers.controller";
import { UploadCentersService } from "./upload-centers.service";

@Module({ imports: [AuthModule], controllers: [UploadCentersController, AdminUploadCentersController], providers: [UploadCentersService] })
export class UploadCentersModule {}
