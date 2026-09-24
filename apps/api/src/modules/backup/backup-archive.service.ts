import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, open, rm, stat } from "node:fs/promises";
import { dirname, posix, resolve, sep } from "node:path";
import { pipeline } from "node:stream/promises";
import { createGunzip, createGzip } from "node:zlib";
import * as tar from "tar-stream";
import { CredentialCryptoService } from "../../common/security/credential-crypto.service";

const MAGIC = Buffer.from("TGBK0001", "ascii");
const CHUNK_BYTES = 4 * 1024 * 1024;
const MAX_HEADER_BYTES = 32 * 1024;

export type BackupArchiveManifest = {
  formatVersion: 1;
  archiveId: string;
  createdAt: string;
  appVersion: string;
  migrationId: string | null;
  postgresMajor: number;
  components: Array<"database" | "uploads">;
  database: { bytes: number; sha256: string } | null;
  uploads: Array<{ path: string; bytes: number; sha256: string }>;
  uploadsBytes: number;
  platformOwnerCount: number;
};

type EnvelopeHeader = {
  version: 1;
  archiveId: string;
  keyId: string;
  wrappedKey: string;
  noncePrefix: string;
  chunkBytes: number;
  plaintextBytes: number;
  chunkCount: number;
};

@Injectable()
export class BackupArchiveService {
  private readonly maxArchiveBytes: number;

  constructor(
    config: ConfigService,
    private readonly crypto: CredentialCryptoService
  ) {
    this.maxArchiveBytes = this.positiveInteger(config.get<string>("BACKUP_MAX_ARCHIVE_BYTES"), 25 * 1024 ** 3);
  }

  async packPlainArchive(
    outputPath: string,
    manifest: BackupArchiveManifest,
    databasePath: string | null,
    uploadsRoot: string,
    uploads: BackupArchiveManifest["uploads"]
  ) {
    await mkdir(dirname(outputPath), { recursive: true });
    const pack = tar.pack();
    const writing = pipeline(pack, createGzip({ level: 6 }), createWriteStream(outputPath, { flags: "wx", mode: 0o600 }));
    pack.entry({ name: "manifest.json", type: "file", mode: 0o600 }, JSON.stringify(manifest));
    if (databasePath) await this.addFile(pack, databasePath, "database.dump");
    for (const upload of uploads) {
      const source = this.safeChild(uploadsRoot, upload.path);
      await this.addFile(pack, source, `uploads/${upload.path.replaceAll("\\", "/")}`);
    }
    pack.finalize();
    await writing;
  }

  async encrypt(plainPath: string, encryptedPath: string, archiveId: string) {
    const sourceStat = await stat(plainPath);
    if (!sourceStat.isFile() || sourceStat.size <= 0 || sourceStat.size > this.maxArchiveBytes) {
      throw new BadRequestException("Backup archive size is invalid");
    }
    const dataKey = randomBytes(32);
    const noncePrefix = randomBytes(8);
    const wrapped = this.crypto.encrypt(dataKey.toString("base64"), `backup-archive:${archiveId}`, "BACKUP_ARCHIVE");
    const header: EnvelopeHeader = {
      version: 1,
      archiveId,
      keyId: wrapped.keyId,
      wrappedKey: wrapped.ciphertext,
      noncePrefix: noncePrefix.toString("base64url"),
      chunkBytes: CHUNK_BYTES,
      plaintextBytes: sourceStat.size,
      chunkCount: Math.ceil(sourceStat.size / CHUNK_BYTES)
    };
    const encodedHeader = Buffer.from(JSON.stringify(header), "utf8");
    if (encodedHeader.length > MAX_HEADER_BYTES) throw new ServiceUnavailableException("Backup envelope header is too large");
    const input = await open(plainPath, "r");
    const output = await open(encryptedPath, "wx", 0o600);
    const digest = createHash("sha256");
    let position = 0;
    try {
      const prefix = Buffer.alloc(MAGIC.length + 4);
      MAGIC.copy(prefix, 0);
      prefix.writeUInt32BE(encodedHeader.length, MAGIC.length);
      await output.write(prefix);
      await output.write(encodedHeader);
      digest.update(prefix).update(encodedHeader);
      for (let index = 0; index < header.chunkCount; index += 1) {
        const remaining = sourceStat.size - position;
        const plain = Buffer.allocUnsafe(Math.min(CHUNK_BYTES, remaining));
        const result = await input.read(plain, 0, plain.length, position);
        if (result.bytesRead !== plain.length) throw new ServiceUnavailableException("Backup archive changed while encrypting");
        const nonce = this.chunkNonce(noncePrefix, index);
        const cipher = createCipheriv("aes-256-gcm", dataKey, nonce);
        cipher.setAAD(this.chunkAad(archiveId, index, plain.length));
        const ciphertext = Buffer.concat([cipher.update(plain), cipher.final(), cipher.getAuthTag()]);
        const length = Buffer.alloc(4);
        length.writeUInt32BE(ciphertext.length);
        await output.write(length);
        await output.write(ciphertext);
        digest.update(length).update(ciphertext);
        position += plain.length;
      }
      await output.sync();
      return { bytes: (await output.stat()).size, sha256: digest.digest("hex") };
    } catch (error) {
      await output.close().catch(() => undefined);
      await rm(encryptedPath, { force: true });
      throw error;
    } finally {
      await input.close().catch(() => undefined);
      await output.close().catch(() => undefined);
      dataKey.fill(0);
    }
  }

  async decrypt(encryptedPath: string, plainPath: string) {
    const input = await open(encryptedPath, "r");
    const output = await open(plainPath, "wx", 0o600);
    try {
      const prefix = Buffer.alloc(MAGIC.length + 4);
      if ((await input.read(prefix, 0, prefix.length, 0)).bytesRead !== prefix.length || !prefix.subarray(0, MAGIC.length).equals(MAGIC)) {
        throw new BadRequestException("Backup package format is invalid");
      }
      const headerLength = prefix.readUInt32BE(MAGIC.length);
      if (headerLength < 2 || headerLength > MAX_HEADER_BYTES) throw new BadRequestException("Backup package header is invalid");
      const encodedHeader = Buffer.alloc(headerLength);
      if ((await input.read(encodedHeader, 0, headerLength, prefix.length)).bytesRead !== headerLength) throw new BadRequestException("Backup package is truncated");
      const header = this.parseHeader(encodedHeader);
      const decodedKey = this.crypto.decrypt(header.wrappedKey, header.keyId, `backup-archive:${header.archiveId}`, "BACKUP_ARCHIVE");
      const dataKey = Buffer.from(decodedKey, "base64");
      if (dataKey.length !== 32) throw new BadRequestException("Backup package key is invalid");
      const noncePrefix = Buffer.from(header.noncePrefix, "base64url");
      let inputPosition = prefix.length + headerLength;
      let written = 0;
      try {
        for (let index = 0; index < header.chunkCount; index += 1) {
          const lengthBuffer = Buffer.alloc(4);
          if ((await input.read(lengthBuffer, 0, 4, inputPosition)).bytesRead !== 4) throw new BadRequestException("Backup package is truncated");
          inputPosition += 4;
          const encryptedLength = lengthBuffer.readUInt32BE();
          if (encryptedLength < 17 || encryptedLength > CHUNK_BYTES + 16) throw new BadRequestException("Backup package chunk is invalid");
          const encrypted = Buffer.alloc(encryptedLength);
          if ((await input.read(encrypted, 0, encryptedLength, inputPosition)).bytesRead !== encryptedLength) throw new BadRequestException("Backup package is truncated");
          inputPosition += encryptedLength;
          const expectedPlainLength = Math.min(header.chunkBytes, header.plaintextBytes - written);
          const decipher = createDecipheriv("aes-256-gcm", dataKey, this.chunkNonce(noncePrefix, index));
          decipher.setAAD(this.chunkAad(header.archiveId, index, expectedPlainLength));
          decipher.setAuthTag(encrypted.subarray(encrypted.length - 16));
          let plain: Buffer;
          try {
            plain = Buffer.concat([decipher.update(encrypted.subarray(0, -16)), decipher.final()]);
          } catch {
            throw new BadRequestException("Backup package authentication failed");
          }
          if (plain.length !== expectedPlainLength) throw new BadRequestException("Backup package chunk length is invalid");
          await output.write(plain);
          written += plain.length;
        }
      } finally {
        dataKey.fill(0);
      }
      const encryptedStat = await input.stat();
      if (written !== header.plaintextBytes || inputPosition !== encryptedStat.size) throw new BadRequestException("Backup package length is invalid");
      await output.sync();
      return header;
    } catch (error) {
      await output.close().catch(() => undefined);
      await rm(plainPath, { force: true });
      throw error;
    } finally {
      await input.close().catch(() => undefined);
      await output.close().catch(() => undefined);
    }
  }

  async extractPlainArchive(plainPath: string, destination: string): Promise<BackupArchiveManifest> {
    await mkdir(destination, { recursive: true });
    const extractor = tar.extract();
    let manifest: BackupArchiveManifest | null = null;
    let totalBytes = 0;
    const entries = new Set<string>();
    extractor.on("entry", (header, stream, next) => {
      void (async () => {
        const name = header.name.replaceAll("\\", "/");
        if (header.type !== "file" || !this.isSafeArchiveName(name)) throw new BadRequestException("Backup archive contains an unsafe entry");
        if (entries.has(name)) throw new BadRequestException("Backup archive contains a duplicate entry");
        entries.add(name);
        const entryBytes = header.size ?? 0;
        if (!Number.isSafeInteger(entryBytes) || entryBytes < 0) throw new BadRequestException("Backup archive entry size is invalid");
        totalBytes += entryBytes;
        if (totalBytes > this.maxArchiveBytes) throw new BadRequestException("Backup archive expands beyond the configured limit");
        if (name === "manifest.json") {
          const chunks: Buffer[] = [];
          let bytes = 0;
          for await (const chunk of stream) {
            const value = Buffer.from(chunk);
            bytes += value.length;
            if (bytes > 1024 * 1024) throw new BadRequestException("Backup manifest is too large");
            chunks.push(value);
          }
          manifest = this.parseManifest(Buffer.concat(chunks));
        } else {
          const target = this.safeChild(destination, name);
          await mkdir(dirname(target), { recursive: true });
          await pipeline(stream, createWriteStream(target, { flags: "wx", mode: 0o600 }));
        }
        next();
      })().catch((error) => extractor.destroy(error as Error));
    });
    await pipeline(createReadStream(plainPath), createGunzip(), extractor);
    if (!manifest) throw new BadRequestException("Backup manifest is missing");
    await this.verifyExtracted(destination, manifest, entries);
    return manifest;
  }

  async sha256(path: string) {
    const hash = createHash("sha256");
    const input = createReadStream(path);
    for await (const chunk of input) hash.update(chunk as Buffer);
    return hash.digest("hex");
  }

  private async addFile(pack: tar.Pack, source: string, name: string) {
    const metadata = await stat(source);
    if (!metadata.isFile()) throw new BadRequestException("Backup input contains a non-file entry");
    const entry = pack.entry({ name, size: metadata.size, type: "file", mode: 0o600 });
    await pipeline(createReadStream(source), entry);
  }

  private async verifyExtracted(destination: string, manifest: BackupArchiveManifest, entries: Set<string>) {
    const expected = new Set(["manifest.json", ...(manifest.database ? ["database.dump"] : []), ...manifest.uploads.map((upload) => `uploads/${upload.path}`)]);
    if (entries.size !== expected.size || [...entries].some((entry) => !expected.has(entry))) {
      throw new BadRequestException("Backup archive contains unexpected or missing files");
    }
    if (manifest.database) {
      const database = this.safeChild(destination, "database.dump");
      const metadata = await stat(database).catch(() => null);
      if (!metadata?.isFile() || metadata.size !== manifest.database.bytes || await this.sha256(database) !== manifest.database.sha256) {
        throw new BadRequestException("Database dump checksum is invalid");
      }
    }
    for (const upload of manifest.uploads) {
      if (!this.isSafeRelativePath(upload.path)) throw new BadRequestException("Backup manifest contains an unsafe upload path");
      const path = this.safeChild(destination, `uploads/${upload.path}`);
      const metadata = await stat(path).catch(() => null);
      if (!metadata?.isFile() || metadata.size !== upload.bytes || await this.sha256(path) !== upload.sha256) {
        throw new BadRequestException("Upload checksum is invalid");
      }
    }
  }

  private parseHeader(value: Buffer): EnvelopeHeader {
    let parsed: Partial<EnvelopeHeader>;
    try { parsed = JSON.parse(value.toString("utf8")) as Partial<EnvelopeHeader>; }
    catch { throw new BadRequestException("Backup package header is invalid"); }
    if (parsed.version !== 1 || typeof parsed.archiveId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(parsed.archiveId) ||
      typeof parsed.keyId !== "string" || typeof parsed.wrappedKey !== "string" || typeof parsed.noncePrefix !== "string" ||
      parsed.chunkBytes !== CHUNK_BYTES || !Number.isSafeInteger(parsed.plaintextBytes) || parsed.plaintextBytes! <= 0 || parsed.plaintextBytes! > this.maxArchiveBytes ||
      !Number.isSafeInteger(parsed.chunkCount) || parsed.chunkCount !== Math.ceil(parsed.plaintextBytes! / CHUNK_BYTES)) {
      throw new BadRequestException("Backup package header is invalid");
    }
    return parsed as EnvelopeHeader;
  }

  private parseManifest(value: Buffer): BackupArchiveManifest {
    let parsed: Partial<BackupArchiveManifest>;
    try { parsed = JSON.parse(value.toString("utf8")) as Partial<BackupArchiveManifest>; }
    catch { throw new BadRequestException("Backup manifest is invalid"); }
    if (parsed.formatVersion !== 1 || typeof parsed.archiveId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(parsed.archiveId) ||
      typeof parsed.createdAt !== "string" || Number.isNaN(Date.parse(parsed.createdAt)) || typeof parsed.appVersion !== "string" || parsed.appVersion.length > 100 ||
      !(parsed.migrationId === null || typeof parsed.migrationId === "string" && parsed.migrationId.length <= 200) ||
      !Array.isArray(parsed.components) || parsed.components.length < 1 || parsed.components.length > 2 || new Set(parsed.components).size !== parsed.components.length || parsed.components.some((item) => item !== "database" && item !== "uploads") ||
      !Array.isArray(parsed.uploads) || !Number.isSafeInteger(parsed.uploadsBytes) || parsed.uploadsBytes! < 0 || !Number.isInteger(parsed.postgresMajor) || parsed.postgresMajor! < 12 || parsed.postgresMajor! > 99 ||
      !Number.isInteger(parsed.platformOwnerCount) || parsed.platformOwnerCount! < 1) {
      throw new BadRequestException("Backup manifest is invalid");
    }
    const hasDatabase = parsed.components.includes("database");
    if (hasDatabase !== Boolean(parsed.database) || (!parsed.components.includes("uploads") && (parsed.uploads.length > 0 || parsed.uploadsBytes !== 0))) {
      throw new BadRequestException("Backup manifest component scope is invalid");
    }
    if (parsed.database && (!Number.isSafeInteger(parsed.database.bytes) || parsed.database.bytes <= 0 || !/^[0-9a-f]{64}$/.test(parsed.database.sha256))) {
      throw new BadRequestException("Backup database manifest is invalid");
    }
    const uploadPaths = new Set<string>();
    let uploadBytes = 0;
    for (const upload of parsed.uploads) {
      if (!upload || !this.isSafeRelativePath(upload.path) || uploadPaths.has(upload.path) || !Number.isSafeInteger(upload.bytes) || upload.bytes < 0 || !/^[0-9a-f]{64}$/.test(upload.sha256)) {
        throw new BadRequestException("Backup upload manifest is invalid");
      }
      uploadPaths.add(upload.path);
      uploadBytes += upload.bytes;
    }
    if (!Number.isSafeInteger(uploadBytes) || uploadBytes !== parsed.uploadsBytes) throw new BadRequestException("Backup upload size total is invalid");
    return parsed as BackupArchiveManifest;
  }

  private isSafeArchiveName(value: string) {
    return value === "manifest.json" || value === "database.dump" || value.startsWith("uploads/") && this.isSafeRelativePath(value.slice("uploads/".length));
  }

  private isSafeRelativePath(value: string) {
    const normalized = posix.normalize(value.replaceAll("\\", "/"));
    return Boolean(value) && normalized === value && !normalized.startsWith("/") && normalized !== ".." && !normalized.startsWith("../") && !normalized.includes("\0");
  }

  private safeChild(root: string, relative: string) {
    if (!this.isSafeRelativePath(relative.replaceAll("\\", "/"))) throw new BadRequestException("Backup path is invalid");
    const base = resolve(root);
    const target = resolve(base, relative);
    if (target !== base && !target.startsWith(`${base}${sep}`)) throw new BadRequestException("Backup path is invalid");
    return target;
  }

  private chunkNonce(prefix: Buffer, index: number) {
    if (prefix.length !== 8 || index < 0 || index > 0xffffffff) throw new BadRequestException("Backup package nonce is invalid");
    const nonce = Buffer.alloc(12);
    prefix.copy(nonce, 0);
    nonce.writeUInt32BE(index, 8);
    return nonce;
  }

  private chunkAad(archiveId: string, index: number, bytes: number) {
    return Buffer.from(`TGBK1:${archiveId}:${index}:${bytes}`, "utf8");
  }

  private positiveInteger(value: string | undefined, fallback: number) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
  }
}
