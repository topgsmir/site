import { Body, Controller, Delete, Get, Ip, Param, ParseUUIDPipe, Post, Req, Res, UseGuards } from "@nestjs/common";
import { AuthRateLimitService } from "../auth/auth-rate-limit.service";
import { BrowserSessionMutation } from "../auth/browser-session-mutation.decorator";
import { PlatformAdminGuard, type AuthenticatedRequest } from "../auth/platform-admin.guard";
import { DataAssistantService } from "./data-assistant.service";
import { AskDataAssistantDto, CreateConversationDto, SubmitAdminToolResultDto } from "./dto/data-assistant.dto";

type StreamResponse = { setHeader(name: string, value: string): void; write(value: string): void; end(): void };

@Controller("ai/data") @UseGuards(PlatformAdminGuard)
export class DataAssistantController {
  constructor(private readonly assistant: DataAssistantService, private readonly limits: AuthRateLimitService) {}
  @Get("tools") listTools() { return this.assistant.listTools(); }
  @Get("conversations") list(@Req() req: AuthenticatedRequest) { return this.assistant.listConversations(req.authenticatedUser!.id); }
  @Post("conversations") @BrowserSessionMutation() async create(@Req() req: AuthenticatedRequest, @Ip() ip: string, @Body() body: CreateConversationDto) { await this.limits.consumeAiRun(req.authenticatedUser!.id, ip); return this.assistant.createConversation(body, req.authenticatedUser!.id); }
  @Get("conversations/:id") get(@Req() req: AuthenticatedRequest, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string) { return this.assistant.conversation(id, req.authenticatedUser!.id); }
  @Delete("conversations/:id") @BrowserSessionMutation() async remove(@Req() req: AuthenticatedRequest, @Ip() ip: string, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string) { await this.limits.consumeAiRun(req.authenticatedUser!.id, ip); return this.assistant.removeConversation(id, req.authenticatedUser!.id); }
  @Post("conversations/:id/messages") @BrowserSessionMutation() async ask(@Req() req: AuthenticatedRequest, @Ip() ip: string, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Body() body: AskDataAssistantDto, @Res() response: StreamResponse) {
    await this.limits.consumeAiRun(req.authenticatedUser!.id, ip); this.streamHeaders(response); const emit = (event: string, data: unknown) => response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); await this.assistant.ask(id, body, req.authenticatedUser!.id, emit); response.end();
  }
  @Post("query-executions/:id/approve") @BrowserSessionMutation() async approve(@Req() req: AuthenticatedRequest, @Ip() ip: string, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Res() response: StreamResponse) {
    await this.limits.consumeAiRun(req.authenticatedUser!.id, ip); this.streamHeaders(response); const emit = (event: string, data: unknown) => response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); await this.assistant.approve(id, req.authenticatedUser!.id, emit); response.end();
  }
  @Post("query-executions/:id/reject") @BrowserSessionMutation() async reject(@Req() req: AuthenticatedRequest, @Ip() ip: string, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string) { await this.limits.consumeAiRun(req.authenticatedUser!.id, ip); return this.assistant.reject(id, req.authenticatedUser!.id); }
  @Post("query-executions/:id/result") @BrowserSessionMutation() async submitToolResult(@Req() req: AuthenticatedRequest, @Ip() ip: string, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Body() body: SubmitAdminToolResultDto, @Res() response: StreamResponse) {
    await this.limits.consumeAiRun(req.authenticatedUser!.id, ip); this.streamHeaders(response); const emit = (event: string, data: unknown) => response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); await this.assistant.submitAdminToolResult(id, body, req.authenticatedUser!.id, emit); response.end();
  }
  private streamHeaders(response: StreamResponse) { response.setHeader("Content-Type", "text/event-stream; charset=utf-8"); response.setHeader("Cache-Control", "no-cache, no-transform"); response.setHeader("X-Accel-Buffering", "no"); }
}
