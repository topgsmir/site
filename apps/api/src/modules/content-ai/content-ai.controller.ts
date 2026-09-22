import { Body, Controller, Get, Ip, Param, Post, Req, UseGuards } from "@nestjs/common";
import { AuthenticatedGuard } from "../auth/authenticated.guard";
import { BrowserSessionMutation } from "../auth/browser-session-mutation.decorator";
import type { AuthenticatedRequest } from "../auth/platform-admin.guard";
import { ContentAiDraftDto, ContentAiKindDto } from "./content-ai.dto";
import { ContentAiService } from "./content-ai.service";

@Controller("ai/authoring")
@UseGuards(AuthenticatedGuard)
export class ContentAiController {
  constructor(private readonly authoring: ContentAiService) {}

  @Get(":kind")
  availability(@Req() request: AuthenticatedRequest, @Param() params: ContentAiKindDto) {
    return this.authoring.availability(request.authenticatedUser!, params.kind);
  }

  @Post(":kind")
  @BrowserSessionMutation()
  generate(@Req() request: AuthenticatedRequest, @Param() params: ContentAiKindDto, @Body() body: ContentAiDraftDto, @Ip() ip: string) {
    return this.authoring.generate(request.authenticatedUser!, params.kind, body, ip);
  }
}
