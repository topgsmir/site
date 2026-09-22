import { Controller, Get, Header, Module, Query } from "@nestjs/common";
import { SeoService } from "./seo.service";
import { SitemapFeedDto } from "./seo.dto";

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

@Module({ controllers: [SeoController], providers: [SeoService] })
export class SeoModule {}
