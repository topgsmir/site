import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AdminHomepageStoriesController, PublicHomepageStoriesController } from "./homepage-stories.controller";
import { HomepageStoriesService } from "./homepage-stories.service";

@Module({
  imports: [AuthModule],
  controllers: [PublicHomepageStoriesController, AdminHomepageStoriesController],
  providers: [HomepageStoriesService]
})
export class HomepageStoriesModule {}
