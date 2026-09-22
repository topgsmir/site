import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { mkdir } from "node:fs/promises";
import { isAbsolute, resolve, sep } from "node:path";

@Injectable()
export class BackupPathsService {
  readonly root: string;
  readonly mediaRoot: string;
  readonly archives: string;
  readonly staging: string;
  readonly state: string;

  constructor(config: ConfigService) {
    this.root = this.resolveConfigured(config.get<string>("BACKUP_ROOT")?.trim() || "var/backups");
    this.mediaRoot = this.resolveConfigured(config.get<string>("MEDIA_ROOT")?.trim() || "var/media");
    this.archives = resolve(this.root, "archives");
    this.staging = resolve(this.root, "staging");
    this.state = resolve(this.root, "state");
  }

  async ensure() {
    await Promise.all([
      mkdir(this.archives, { recursive: true }),
      mkdir(this.staging, { recursive: true }),
      mkdir(this.state, { recursive: true }),
      mkdir(this.mediaRoot, { recursive: true })
    ]);
  }

  archivePath(name: string) {
    if (!/^topgsm-[0-9]{8}T[0-9]{6}Z-[0-9a-f-]{36}[.]topgsm-backup$/i.test(name)) {
      throw new BadRequestException("Backup archive name is invalid");
    }
    return this.safeChild(this.archives, name);
  }

  stagingPath(id: string, suffix: string) {
    if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[a-z0-9.-]{1,40}$/i.test(suffix)) throw new BadRequestException("Backup staging path is invalid");
    return this.safeChild(this.staging, `${id}.${suffix}`);
  }

  statePath(name: string) {
    if (!/^[a-z0-9.-]{1,80}$/i.test(name)) throw new BadRequestException("Backup state path is invalid");
    return this.safeChild(this.state, name);
  }

  private resolveConfigured(value: string) {
    return isAbsolute(value) ? resolve(value) : resolve(process.cwd(), value);
  }

  private safeChild(root: string, relative: string) {
    const target = resolve(root, relative);
    if (target !== root && !target.startsWith(`${root}${sep}`)) throw new BadRequestException("Backup path is invalid");
    return target;
  }
}
