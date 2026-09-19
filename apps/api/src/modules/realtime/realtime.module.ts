import { Module } from "@nestjs/common";
import { RealtimeGateway } from "./realtime.gateway";
import { AuthModule } from "../auth/auth.module";
import { OutboxPublisherService } from "./outbox-publisher.service";
import { CommentsModule } from "../comments/comments.module";

@Module({
  imports: [AuthModule, CommentsModule],
  providers: [RealtimeGateway, OutboxPublisherService],
  exports: [RealtimeGateway]
})
export class RealtimeModule {}
