import { SetMetadata } from "@nestjs/common";
import type { PlatformPermission } from "@topgsm/shared-types";

export const PLATFORM_PERMISSION_KEY = "platform-permission";

export const RequirePlatformPermission = (permission: PlatformPermission) =>
  SetMetadata(PLATFORM_PERMISSION_KEY, permission);
