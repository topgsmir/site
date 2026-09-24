import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AdminHomepageController, PublicHomepageController } from "./homepage.controller";
import { HomepageService } from "./homepage.service";
import { HomepageImagesService } from "./homepage-images.service";

@Module({ imports: [AuthModule], controllers: [PublicHomepageController, AdminHomepageController], providers: [HomepageService, HomepageImagesService] })
export class HomepageModule {}
