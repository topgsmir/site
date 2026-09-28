import { Controller, Get, Header, Module, Query } from "@nestjs/common";
import { SeoService } from "./seo.service";
import { SitemapFeedDto } from "./seo.dto";
import { AuthModule } from "../auth/auth.module";
import { SeoSettingsService } from "./seo-settings.service";
import { AdminSeoSettingsController, PublicSeoSettingsController } from "./seo-settings.controller";

@Controller("seo/sitemap")
export class SeoController {
  constructor(private readonly seo: SeoService) {}

  @Get("manifest")
  @Header("Cache-Control", "public, max-age=300")
  manifest() { return this.seo.manifest(); }

  @Get()
  @Header("Cache-Control", "public, max-age=300")
  feed(@Query() query: SitemapFeedDto) { return this.seo.feed(query); }
}

@Module({ imports: [AuthModule], controllers: [SeoController, AdminSeoSettingsController, PublicSeoSettingsController], providers: [SeoService, SeoSettingsService] })
export class SeoModule {}
