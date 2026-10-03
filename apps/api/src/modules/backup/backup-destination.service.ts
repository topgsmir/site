import { BadRequestException, ConflictException, Injectable, NotFoundException, RequestTimeoutException, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AdminBackupDestination, AdminRemoteBackupArchive, BackupProtocol } from "@topgsm/shared-types";
import { Client as FtpClient } from "basic-ftp";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { basename, dirname, posix } from "node:path";
import { Readable, Transform } from "node:stream";
import { createWriteStream } from "node:fs";
import { rm } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import SftpClient from "ssh2-sftp-client";
import { CredentialCryptoService } from "../../common/security/credential-crypto.service";
import { PrismaService } from "../../prisma/prisma.service";
import type { CreateBackupDestinationDto, UpdateBackupDestinationDto } from "./dto/backup.dto";
import { assertStagingFreeSpace, backupMinFreeBytes } from "./backup-staging-space";

type StoredDestination = Awaited<ReturnType<PrismaService["backup_destinations"]["findUniqueOrThrow"]>>;
const SPACE_CHECK_BYTES = 16 * 1024 ** 2;

@Injectable()
export class BackupDestinationService {
  private readonly allowedCidrs: string[];
  private readonly maxArchiveBytes: number;
  private readonly maxDownloadMs: number;
  private readonly minFreeBytes: number;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly crypto: CredentialCryptoService
  ) {
    this.allowedCidrs = (config.get<string>("BACKUP_DESTINATION_ALLOWED_CIDRS") ?? "").split(",").map((item) => item.trim()).filter(Boolean);
    const configuredLimit = Number(config.get<string>("BACKUP_MAX_ARCHIVE_BYTES"));
    this.maxArchiveBytes = Number.isSafeInteger(configuredLimit) && configuredLimit > 0 ? configuredLimit : 25 * 1024 ** 3;
    const configuredTimeout = Number(config.get<string>("BACKUP_DOWNLOAD_TIMEOUT_MS"));
    this.maxDownloadMs = Number.isSafeInteger(configuredTimeout) && configuredTimeout > 0 && configuredTimeout <= 24 * 60 * 60_000
      ? configuredTimeout : 2 * 60 * 60_000;
    this.minFreeBytes = backupMinFreeBytes(config);
  }

  async list(): Promise<AdminBackupDestination[]> {
    const rows = await this.prisma.backup_destinations.findMany({ orderBy: [{ name: "asc" }, { id: "asc" }] });
    return rows.map((row) => this.map(row));
  }

  async create(input: CreateBackupDestinationDto, actorUserId: string) {
    this.assertSafeCommandValue(input.username, input.remotePath, input.password, input.privateKeyPassphrase);
    this.validateProtocol(input.protocol, input.allowInsecure, input.hostKeyFingerprint, input.password, input.privateKey);
    const id = randomUUID();
    const secrets = this.encryptSecrets(id, input.password, input.privateKey, input.privateKeyPassphrase);
    const row = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.backup_destinations.create({ data: {
        id, name: input.name.trim(), protocol: input.protocol, host: input.host.toLowerCase(), port: input.port,
        username: input.username.trim(), remote_path: this.normalizeRemotePath(input.remotePath), retention_count: input.retentionCount,
        allow_insecure: input.protocol === "ftp" && input.allowInsecure,
        host_key_fingerprint: input.protocol === "sftp" ? input.hostKeyFingerprint : null,
        ...secrets
      } });
      await transaction.backup_destination_events.create({ data: {
        destination_id: id, actor_user_id: actorUserId, action: "created",
        changed_fields: ["name", "protocol", "host", "port", "username", "remotePath", "retentionCount", "credentials"]
      } });
      return created;
    });
    return this.map(row);
  }

  async update(id: string, input: UpdateBackupDestinationDto, actorUserId: string) {
    this.assertSafeCommandValue(input.username, input.remotePath, input.password, input.privateKeyPassphrase);
    const current = await this.getStored(id);
    const protocol = input.protocol ?? current.protocol as BackupProtocol;
    const allowInsecure = input.allowInsecure ?? current.allow_insecure;
    const fingerprint = input.hostKeyFingerprint ?? current.host_key_fingerprint ?? undefined;
    const passwordConfigured = input.password !== undefined ? Boolean(input.password) : Boolean(current.encrypted_password);
    const privateKeyConfigured = protocol === "sftp" && (input.privateKey !== undefined ? Boolean(input.privateKey) : Boolean(current.encrypted_private_key));
    this.validateProtocol(protocol, allowInsecure, fingerprint, passwordConfigured ? "configured" : undefined, privateKeyConfigured ? "configured" : undefined);
    const critical = ["protocol", "host", "port", "username", "remotePath", "allowInsecure", "hostKeyFingerprint", "password", "privateKey", "privateKeyPassphrase"]
      .filter((field) => input[field as keyof UpdateBackupDestinationDto] !== undefined);
    if (input.enabled && (critical.length > 0 || !current.verified_at)) throw new ConflictException("Test the destination successfully before enabling it");
    const secretUpdates = {
      ...this.updateSecrets(id, current, input),
      ...(protocol !== "sftp" ? { encrypted_private_key: null, encrypted_key_passphrase: null } : {})
    };
    const row = await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.backup_destinations.update({ where: { id }, data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.protocol !== undefined ? { protocol: input.protocol } : {}),
        ...(input.host !== undefined ? { host: input.host.toLowerCase() } : {}),
        ...(input.port !== undefined ? { port: input.port } : {}),
        ...(input.username !== undefined ? { username: input.username.trim() } : {}),
        ...(input.remotePath !== undefined ? { remote_path: this.normalizeRemotePath(input.remotePath) } : {}),
        ...(input.retentionCount !== undefined ? { retention_count: input.retentionCount } : {}),
        ...(input.allowInsecure !== undefined ? { allow_insecure: protocol === "ftp" && input.allowInsecure } : {}),
        ...(input.hostKeyFingerprint !== undefined ? { host_key_fingerprint: protocol === "sftp" ? input.hostKeyFingerprint : null } : {}),
        ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
        ...secretUpdates,
        ...(critical.length ? { verified_at: null, last_test_status: "never", last_error_code: null, enabled: false } : {})
      } });
      await transaction.backup_destination_events.create({ data: {
        destination_id: id, actor_user_id: actorUserId, action: input.enabled === true ? "enabled" : input.enabled === false ? "disabled" : "updated",
        changed_fields: [...new Set([...Object.keys(input).filter((key) => !["password", "privateKey", "privateKeyPassphrase"].includes(key)), ...(critical.some((key) => ["password", "privateKey", "privateKeyPassphrase"].includes(key)) ? ["credentials"] : [])])]
      } });
      return updated;
    });
    return this.map(row);
  }

  async remove(id: string, actorUserId: string) {
    await this.getStored(id);
    await this.prisma.$transaction(async (transaction) => {
      await transaction.backup_destination_events.create({ data: { destination_id: id, actor_user_id: actorUserId, action: "deleted", changed_fields: ["deleted"] } });
      await transaction.backup_destinations.delete({ where: { id } });
    });
    return { deleted: true };
  }

  async test(id: string, actorUserId: string) {
    const destination = await this.getStored(id);
    let errorCode: string | null = null;
    try {
      await this.withConnection(destination, async (connection) => {
        const probe = `.topgsm-probe-${randomUUID()}`;
        if (connection.kind === "sftp") {
          await connection.client.mkdir(destination.remote_path, true);
          const path = posix.join(destination.remote_path, probe);
          await connection.client.put(randomBytes(32), path);
          await connection.client.delete(path);
        } else {
          await connection.client.ensureDir(destination.remote_path);
          await connection.client.uploadFrom(Readable.from(randomBytes(32)), probe);
          await connection.client.remove(probe);
        }
      });
    } catch (error) {
      errorCode = this.errorCode(error);
    }
    const row = await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.backup_destinations.update({ where: { id }, data: {
        verified_at: errorCode ? null : new Date(), last_test_status: errorCode ? "failed" : "success", last_error_code: errorCode,
        ...(errorCode ? { enabled: false } : {})
      } });
      await transaction.backup_destination_events.create({ data: {
        destination_id: id, actor_user_id: actorUserId, action: "tested", changed_fields: ["verifiedAt", "lastTestStatus"], metadata: { ok: !errorCode, errorCode }
      } });
      return updated;
    });
    if (errorCode) throw new ServiceUnavailableException(`Destination test failed: ${errorCode}`);
    return this.map(row);
  }

  async upload(destination: StoredDestination, localPath: string, archiveName: string) {
    if (!/^topgsm-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.]topgsm-backup$/i.test(archiveName) || basename(archiveName) !== archiveName) throw new BadRequestException("Archive name is invalid");
    const remotePath = posix.join(destination.remote_path, archiveName);
    await this.withConnection(destination, async (connection) => {
      if (connection.kind === "sftp") {
        await connection.client.mkdir(destination.remote_path, true);
        await connection.client.fastPut(localPath, remotePath);
      } else {
        await connection.client.ensureDir(destination.remote_path);
        await connection.client.uploadFrom(localPath, archiveName);
      }
    });
    await this.applyRetention(destination);
    return remotePath;
  }

  async download(destination: StoredDestination, remoteName: string, localPath: string) {
    if (!/^topgsm-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.]topgsm-backup$/i.test(remoteName)) throw new BadRequestException("Remote archive name is invalid");
    await assertStagingFreeSpace(dirname(localPath), SPACE_CHECK_BYTES, this.minFreeBytes);
    await this.withConnection(destination, async (connection) => {
      let bytes = 0;
      let nextSpaceCheck = 0;
      const bounded = new Transform({
        transform: (chunk: Buffer, _encoding, callback) => {
          bytes += chunk.length;
          if (bytes > this.maxArchiveBytes) {
            callback(new BadRequestException("Remote backup package is too large"));
            return;
          }
          if (bytes < nextSpaceCheck) {
            callback(null, chunk);
            return;
          }
          nextSpaceCheck = bytes + SPACE_CHECK_BYTES;
          void assertStagingFreeSpace(dirname(localPath), Math.max(SPACE_CHECK_BYTES, chunk.length), this.minFreeBytes)
            .then(() => callback(null, chunk), (error: unknown) => callback(error instanceof Error ? error : new Error("Backup staging space check failed")));
        }
      });
      const writing = pipeline(bounded, createWriteStream(localPath, { flags: "wx", mode: 0o600 }));
      void writing.catch(() => undefined);
      let deadline: NodeJS.Timeout | undefined;
      const timeout = new Promise<never>((_resolve, reject) => {
        deadline = setTimeout(() => {
          bounded.destroy(new Error("backup_download_timeout"));
          if (connection.kind === "sftp") void connection.client.end().catch(() => undefined);
          else connection.client.close();
          reject(new RequestTimeoutException("Remote backup download timed out"));
        }, this.maxDownloadMs);
      });
      try {
        const transfer = connection.kind === "sftp"
          ? connection.client.get(posix.join(destination.remote_path, remoteName), bounded)
          : (async () => { await connection.client.cd(destination.remote_path); await connection.client.downloadTo(bounded, remoteName); })();
        await Promise.race([transfer, timeout]);
        bounded.end();
        await writing;
      } catch (error) {
        bounded.destroy(error instanceof Error ? error : new Error("Backup download failed"));
        await writing.catch(() => undefined);
        await rm(localPath, { force: true });
        throw error;
      } finally {
        if (deadline) clearTimeout(deadline);
      }
    });
  }

  async listArchives(id: string): Promise<AdminRemoteBackupArchive[]> {
    const destination = await this.getStored(id);
    if (!destination.verified_at) throw new ConflictException("Test the destination successfully before refreshing its backup catalog");
    const values = await this.withConnection(destination, async (connection) => {
      if (connection.kind === "sftp") return (await connection.client.list(destination.remote_path)).flatMap((entry) => {
        if (entry.type !== "-" || !/^topgsm-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.]topgsm-backup$/i.test(entry.name)) return [];
        return [this.remoteArchive(destination, entry.name, entry.size, entry.modifyTime > 0 ? new Date(entry.modifyTime) : null)];
      });
      return (await connection.client.list(destination.remote_path)).flatMap((entry) => {
        if (!entry.isFile || !/^topgsm-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.]topgsm-backup$/i.test(entry.name)) return [];
        return [this.remoteArchive(destination, entry.name, entry.size, entry.modifiedAt ?? null)];
      });
    });
    return values.sort((left, right) => right.name.localeCompare(left.name)).slice(0, 1_000);
  }

  private remoteArchive(destination: StoredDestination, name: string, bytes: number, modified: Date | null): AdminRemoteBackupArchive {
    return {
      destinationId: destination.id, destinationName: destination.name, protocol: destination.protocol as BackupProtocol,
      name, bytes: Number.isSafeInteger(bytes) && bytes >= 0 ? bytes : null,
      modifiedAt: modified && !Number.isNaN(modified.getTime()) ? modified.toISOString() : null
    };
  }

  async getStored(id: string) {
    const row = await this.prisma.backup_destinations.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Backup destination was not found");
    return row;
  }

  map(row: StoredDestination): AdminBackupDestination {
    return {
      id: row.id, name: row.name, protocol: row.protocol as BackupProtocol, host: row.host, port: row.port,
      username: row.username, remotePath: row.remote_path, retentionCount: row.retention_count, enabled: row.enabled,
      verifiedAt: row.verified_at?.toISOString() ?? null, lastTestStatus: row.last_test_status as AdminBackupDestination["lastTestStatus"],
      lastErrorCode: row.last_error_code, credentialConfigured: Boolean(row.encrypted_password), privateKeyConfigured: Boolean(row.encrypted_private_key),
      hostKeyFingerprint: row.host_key_fingerprint, allowInsecure: row.allow_insecure,
      createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString()
    };
  }

  private async applyRetention(destination: StoredDestination) {
    await this.withConnection(destination, async (connection) => {
      const entries = connection.kind === "sftp"
        ? (await connection.client.list(destination.remote_path)).filter((item) => item.type === "-").map((item) => item.name)
        : (await connection.client.list(destination.remote_path)).filter((item) => item.isFile).map((item) => item.name);
      const archives = entries.filter((name) => /^topgsm-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}[.]topgsm-backup$/i.test(name)).sort().reverse();
      if (connection.kind === "ftp") await connection.client.cd(destination.remote_path);
      for (const name of archives.slice(destination.retention_count)) {
        if (connection.kind === "sftp") await connection.client.delete(posix.join(destination.remote_path, name));
        else await connection.client.remove(name);
      }
    });
  }

  private async withConnection<T>(destination: StoredDestination, operation: (connection: { kind: "sftp"; client: SftpClient } | { kind: "ftp"; client: FtpClient }) => Promise<T>): Promise<T> {
    this.assertSafeCommandValue(destination.username, destination.remote_path);
    const address = await this.resolveSafeAddress(destination.host);
    const password = destination.encrypted_password && destination.encryption_key_id
      ? this.crypto.decrypt(destination.encrypted_password, destination.encryption_key_id, `backup-destination:${destination.id}:password`, "BACKUP_DESTINATION") : undefined;
    this.assertSafeCommandValue(password);
    if (destination.protocol === "sftp") {
      const client = new SftpClient(`topgsm-backup-${destination.id}`);
      const privateKey = destination.encrypted_private_key && destination.encryption_key_id
        ? this.crypto.decrypt(destination.encrypted_private_key, destination.encryption_key_id, `backup-destination:${destination.id}:private-key`, "BACKUP_DESTINATION") : undefined;
      const passphrase = destination.encrypted_key_passphrase && destination.encryption_key_id
        ? this.crypto.decrypt(destination.encrypted_key_passphrase, destination.encryption_key_id, `backup-destination:${destination.id}:passphrase`, "BACKUP_DESTINATION") : undefined;
      try {
        await client.connect({
          host: address, port: destination.port, username: destination.username, password, privateKey, passphrase,
          readyTimeout: 10_000,
          hostVerifier: (key: Buffer) => `SHA256:${createHash("sha256").update(key).digest("base64").replace(/=+$/, "")}` === destination.host_key_fingerprint
        });
        return await operation({ kind: "sftp", client });
      } finally { await client.end().catch(() => undefined); }
    }
    const client = new FtpClient(60_000);
    client.ftp.verbose = false;
    try {
      await client.access({
        host: address, port: destination.port, user: destination.username, password: password ?? "",
        secure: destination.protocol === "ftps",
        secureOptions: destination.protocol === "ftps" ? { rejectUnauthorized: true, servername: destination.host } : undefined
      });
      return await operation({ kind: "ftp", client });
    } finally { client.close(); }
  }

  private encryptSecrets(id: string, password?: string, privateKey?: string, passphrase?: string) {
    const values = [
      password ? ["encrypted_password", password, "password"] as const : null,
      privateKey ? ["encrypted_private_key", privateKey, "private-key"] as const : null,
      passphrase ? ["encrypted_key_passphrase", passphrase, "passphrase"] as const : null
    ].filter(Boolean) as Array<readonly ["encrypted_password" | "encrypted_private_key" | "encrypted_key_passphrase", string, string]>;
    const result: Record<string, string | null> = { encrypted_password: null, encrypted_private_key: null, encrypted_key_passphrase: null, encryption_key_id: null, credential_hint: null };
    for (const [field, value, purpose] of values) {
      const encrypted = this.crypto.encrypt(value, `backup-destination:${id}:${purpose}`, "BACKUP_DESTINATION");
      result[field] = encrypted.ciphertext;
      result.encryption_key_id = encrypted.keyId;
    }
    const hintValue = password || passphrase;
    result.credential_hint = hintValue ? Array.from(hintValue).slice(-4).join("") : null;
    return result;
  }

  private updateSecrets(id: string, current: StoredDestination, input: UpdateBackupDestinationDto) {
    if (input.password === undefined && input.privateKey === undefined && input.privateKeyPassphrase === undefined) return {};
    const decryptedPassword = input.password !== undefined ? input.password : this.decryptCurrent(current, "encrypted_password", "password");
    const decryptedKey = input.privateKey !== undefined ? input.privateKey : this.decryptCurrent(current, "encrypted_private_key", "private-key");
    const decryptedPassphrase = input.privateKeyPassphrase !== undefined ? input.privateKeyPassphrase : this.decryptCurrent(current, "encrypted_key_passphrase", "passphrase");
    return this.encryptSecrets(id, decryptedPassword || undefined, decryptedKey || undefined, decryptedPassphrase || undefined);
  }

  private decryptCurrent(current: StoredDestination, field: "encrypted_password" | "encrypted_private_key" | "encrypted_key_passphrase", purpose: string) {
    const value = current[field];
    return value && current.encryption_key_id ? this.crypto.decrypt(value, current.encryption_key_id, `backup-destination:${current.id}:${purpose}`, "BACKUP_DESTINATION") : "";
  }

  private validateProtocol(protocol: BackupProtocol, allowInsecure: boolean, fingerprint?: string, password?: string, privateKey?: string) {
    if (protocol === "ftp" && !allowInsecure) throw new BadRequestException("Plain FTP requires explicit insecure-mode confirmation");
    if (protocol !== "ftp" && allowInsecure) throw new BadRequestException("Insecure mode applies only to plain FTP");
    if (protocol === "sftp" && !fingerprint) throw new BadRequestException("SFTP host-key fingerprint is required");
    if (protocol === "sftp" && !password && !privateKey) throw new BadRequestException("SFTP requires a password or private key");
    if (protocol !== "sftp" && (!password || privateKey)) throw new BadRequestException("FTP and FTPS require a password and do not accept private keys");
  }

  private normalizeRemotePath(value: string) {
    this.assertSafeCommandValue(value);
    const normalized = posix.normalize(value.trim().replaceAll("\\", "/"));
    if (!normalized || normalized === "." || normalized === "/" || normalized.includes("\0") || normalized === ".." || normalized.startsWith("../")) {
      throw new BadRequestException("Use a dedicated non-root remote backup directory");
    }
    return normalized;
  }

  private async resolveSafeAddress(host: string) {
    const addresses = await lookup(host, { all: true, verbatim: true });
    if (!addresses.length) throw new ServiceUnavailableException("Backup destination did not resolve");
    for (const { address } of addresses) {
      if (!this.isForbiddenAddress(address) || this.allowedCidrs.some((cidr) => this.matchesCidr(address, cidr))) return address;
    }
    throw new BadRequestException("Backup destination resolves only to blocked private or local addresses");
  }

  private isForbiddenAddress(address: string): boolean {
    const mapped = this.mappedIpv4(address);
    if (mapped) return this.isForbiddenAddress(mapped);
    if (isIP(address) === 4) {
      const [a, b] = address.split(".").map(Number);
      return a === 0 || a === 10 || a === 127 || a >= 224 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168 || a === 100 && b >= 64 && b <= 127;
    }
    const value = address.toLowerCase();
    return value === "::1" || value === "::" || value.startsWith("fe80:") || value.startsWith("fc") || value.startsWith("fd") || value.startsWith("ff");
  }

  private matchesCidr(address: string, cidr: string) {
    address = this.mappedIpv4(address) ?? address;
    cidr = this.mappedIpv4(cidr) ?? cidr;
    if (!cidr.includes("/")) return address === cidr;
    if (isIP(address) !== 4) return false;
    const [base, bitsText] = cidr.split("/");
    if (isIP(base) !== 4) return false;
    const bits = Number(bitsText);
    if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false;
    const toInt = (value: string) => value.split(".").reduce((result, item) => (result << 8) | Number(item), 0) >>> 0;
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return (toInt(address) & mask) === (toInt(base) & mask);
  }

  private errorCode(error: unknown) {
    const source = error instanceof Error ? `${error.name}:${error.message}` : "UNKNOWN";
    return source.replace(/[^A-Za-z0-9:_-]/g, "_").slice(0, 64).toUpperCase();
  }

  private mappedIpv4(address: string): string | null {
    if (isIP(address) !== 6) return null;
    // WHATWG URL parsing expands mixed IPv4 notation and compresses all equivalent IPv6 spellings.
    const canonical = new URL(`http://[${address}]/`).hostname.slice(1, -1);
    const words = /^::ffff:(?:0:)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(canonical);
    if (!words) return null;
    const high = Number.parseInt(words[1]!, 16);
    const low = Number.parseInt(words[2]!, 16);
    return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
  }

  private assertSafeCommandValue(...values: Array<string | undefined>) {
    if (values.some((value) => value !== undefined && /[\r\n\0]/.test(value))) {
      throw new BadRequestException("Backup destination credentials and paths cannot contain control characters");
    }
  }
}
