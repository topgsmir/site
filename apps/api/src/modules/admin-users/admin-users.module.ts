import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AdminUsersController } from "./admin-users.controller";
import { AdminUsersService } from "./admin-users.service";
import { UserLifecycleService } from "./user-lifecycle.service";
import { UserDeletionService } from "./user-deletion.service";
import { UserTransferWorker } from "./user-transfer.worker";
import { UserLifecycleController } from "./user-lifecycle.controller";
import { AdminUserNotesController } from "./admin-user-notes.controller";
import { AdminUserNotesService } from "./admin-user-notes.service";

@Module({
  imports: [AuthModule],
  controllers: [AdminUsersController, UserLifecycleController, AdminUserNotesController],
  providers: [AdminUsersService, UserLifecycleService, UserDeletionService, UserTransferWorker, AdminUserNotesService]
})
export class AdminUsersModule {}
