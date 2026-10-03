import { ServiceUnavailableException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { statfs } from "node:fs/promises";

const DEFAULT_MIN_FREE_BYTES = 1024 ** 3;

export function backupMinFreeBytes(config: ConfigService): number {
  const configured = Number(config.get<string>("BACKUP_MIN_FREE_BYTES"));
  return Number.isSafeInteger(configured) && configured >= 64 * 1024 ** 2 ? configured : DEFAULT_MIN_FREE_BYTES;
}

export async function assertStagingFreeSpace(directory: string, incomingBytes: number, minFreeBytes: number): Promise<void> {
  const volume = await statfs(directory);
  const available = BigInt(volume.bavail) * BigInt(volume.bsize);
  if (available < BigInt(incomingBytes) + BigInt(minFreeBytes)) {
    throw new ServiceUnavailableException("Backup staging volume does not have enough free space");
  }
}
