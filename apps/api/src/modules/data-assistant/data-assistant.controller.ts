import { Body, Controller, Delete, Get, Ip, Param, ParseUUIDPipe, Post, Req, Res, UseGuards } from "@nestjs/common";
import { AuthRateLimitService } from "../auth/auth-rate-limit.service";
import { BrowserSessionMutation } from "../auth/browser-session-mutation.decorator";
import { PlatformAdminGuard, type AuthenticatedRequest } from "../auth/platform-admin.guard";
import { DataAssistantService } from "./data-assistant.service";
import { AskDataAssistantDto, CreateConversationDto } from "./dto/data-assistant.dto";

type StreamResponse = { setHeader(name: string, value: string): void; write(value: string): void; end(): void };

@Controller("ai/data") @UseGuards(PlatformAdminGuard)
export class DataAssistantController {
  constructor(private readonly assistant: DataAssistantService, private readonly limits: AuthRateLimitService) {}
  @Get("conversations") list(@Req() req: AuthenticatedRequest) { return this.assistant.listConversations(req.authenticatedUser!.id); }
  @Post("conversations") @BrowserSessionMutation() create(@Req() req: AuthenticatedRequest, @Body() body: CreateConversationDto) { return this.assistant.createConversation(body, req.authenticatedUser!.id); }
  @Get("conversations/:id") get(@Req() req: AuthenticatedRequest, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string) { return this.assistant.conversation(id, req.authenticatedUser!.id); }
  @Delete("conversations/:id") @BrowserSessionMutation() remove(@Req() req: AuthenticatedRequest, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string) { return this.assistant.removeConversation(id, req.authenticatedUser!.id); }
  @Post("conversations/:id/messages") @BrowserSessionMutation() async ask(@Req() req: AuthenticatedRequest, @Ip() ip: string, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Body() body: AskDataAssistantDto, @Res() response: StreamResponse) {
    await this.limits.consumeAiRun(req.authenticatedUser!.id, ip); this.streamHeaders(response); const emit = (event: string, data: unknown) => response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); await this.assistant.ask(id, body, req.authenticatedUser!.id, emit); response.end();
  }
  @Post("query-executions/:id/approve") @BrowserSessionMutation() async approve(@Req() req: AuthenticatedRequest, @Ip() ip: string, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Res() response: StreamResponse) {
    await this.limits.consumeAiRun(req.authenticatedUser!.id, ip); this.streamHeaders(response); const emit = (event: string, data: unknown) => response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); await this.assistant.approve(id, req.authenticatedUser!.id, emit); response.end();
  }
  @Post("query-executions/:id/reject") @BrowserSessionMutation() reject(@Req() req: AuthenticatedRequest, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string) { return this.assistant.reject(id, req.authenticatedUser!.id); }
  private streamHeaders(response: StreamResponse) { response.setHeader("Content-Type", "text/event-stream; charset=utf-8"); response.setHeader("Cache-Control", "no-cache, no-transform"); response.setHeader("X-Accel-Buffering", "no"); }
}
