import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { Prisma } from "../../prisma/client";
import type {
  AppUser,
  PlatformPermission,
  Role,
  VendorPermission
} from "@topgsm/shared-types";
import {
  createHash,
  randomBytes,
  scrypt as nodeScrypt,
  timingSafeEqual
} from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import type { LoginDto } from "./dto/login.dto";
import type { RegisterDto } from "./dto/register.dto";

const SCRYPT_COST = 16_384;
const SCRYPT_BLOCK_SIZE = 8;
const SCRYPT_PARALLELISM = 1;
const HASH_LENGTH = 64;
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const DUMMY_HASH = `scrypt$${SCRYPT_COST}$${SCRYPT_BLOCK_SIZE}$${SCRYPT_PARALLELISM}$AAAAAAAAAAAAAAAAAAAAAA==$${Buffer.alloc(HASH_LENGTH).toString("base64")}`;

type StoredUser = {
  id: string;
  full_name: string;
  email: string;
  role:
    | "platform_admin"
    | "platform_staff"
    | "seller_admin"
    | "seller_staff"
    | "buyer";
  sellers?: Array<{
    permissions: Array<{ permission: VendorPermission }>;
  }>;
  platform_permissions?: Array<{ permission: PlatformPermission }>;
  seller_memberships?: Array<{
    active: boolean;
    seller: { permissions: Array<{ permission: VendorPermission }> };
  }>;
};

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async register(input: RegisterDto) {
    const email = this.normalizeEmail(input.email);
    const fullName = input.fullName.trim();
    if (fullName.length < 2) {
      throw new BadRequestException("Full name must contain at least 2 characters");
    }
    const passwordHash = await this.createPasswordHash(input.password);

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const user = await transaction.users.create({
          data: {
            full_name: fullName,
            email,
            password_hash: passwordHash,
            role: "buyer"
          }
        });
        return this.createSession(transaction, user);
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("An account with this email already exists");
      }
      throw error;
    }
  }

  async login(input: LoginDto) {
    const identifier = input.identifier.trim().toLowerCase();
    const user = identifier.includes("@")
      ? await this.prisma.users.findUnique({
          where: { email: identifier },
          include: {
            sellers: { include: { permissions: true } },
            platform_permissions: true,
            seller_memberships: { include: { seller: { include: { permissions: true } } } }
          }
        })
      : await this.prisma.users.findUnique({
          where: { username: identifier },
          include: {
            sellers: { include: { permissions: true } },
            platform_permissions: true,
            seller_memberships: { include: { seller: { include: { permissions: true } } } }
          }
        });
    const passwordMatches = await this.verifyPassword(
      input.password,
      user?.password_hash ?? DUMMY_HASH
    );

    if (!user || !user.password_hash || !passwordMatches) {
      throw new UnauthorizedException(
        "Email, username, or password is incorrect"
      );
    }

    return this.createSession(this.prisma, user);
  }

  async getUserFromToken(token: string | undefined): Promise<AppUser> {
    const tokenHash = this.tokenHash(token);
    const session = await this.prisma.auth_sessions.findFirst({
      where: {
        token_hash: tokenHash,
        revoked_at: null,
        expires_at: { gt: new Date() }
      },
      select: {
        user: {
          select: {
            id: true,
            full_name: true,
            email: true,
            role: true,
            sellers: {
              select: { permissions: { select: { permission: true } } }
            },
            platform_permissions: { select: { permission: true } },
            seller_memberships: {
              where: { active: true },
              select: {
                active: true,
                seller: { select: { permissions: { select: { permission: true } } } }
              }
            }
          }
        }
      }
    });

    if (!session) {
      throw new UnauthorizedException("Session is no longer valid");
    }

    return this.toPublicUser(session.user);
  }

  async revokeSession(token: string | undefined) {
    if (!token || !this.isValidTokenShape(token)) return;
    await this.prisma.auth_sessions.updateMany({
      where: { token_hash: this.hashToken(token), revoked_at: null },
      data: { revoked_at: new Date() }
    });
  }

  async revokeAllUserSessions(userId: string) {
    await this.prisma.auth_sessions.updateMany({
      where: { user_id: userId, revoked_at: null },
      data: { revoked_at: new Date() }
    });
  }

  get sessionTtlSeconds() {
    return SESSION_TTL_SECONDS;
  }

  createPasswordHash(password: string) {
    return this.hashPassword(password);
  }

  async createSessionForUser(userId: string) {
    const user = await this.prisma.users.findUnique({
      where: { id: userId },
      include: {
        sellers: { include: { permissions: true } },
        platform_permissions: true,
        seller_memberships: {
          include: { seller: { include: { permissions: true } } }
        }
      }
    });
    if (!user) throw new UnauthorizedException("Account was not found");
    return this.createSession(this.prisma, user);
  }

  private async createSession(
    database: Pick<Prisma.TransactionClient, "auth_sessions">,
    user: StoredUser
  ) {
    const token = randomBytes(32).toString("base64url");
    await database.auth_sessions.create({
      data: {
        token_hash: this.hashToken(token),
        user_id: user.id,
        expires_at: new Date(Date.now() + SESSION_TTL_SECONDS * 1000)
      }
    });

    return { token, user: this.toPublicUser(user) };
  }

  private tokenHash(token: string | undefined) {
    if (!token) throw new UnauthorizedException("Authentication is required");
    if (!this.isValidTokenShape(token)) {
      throw new UnauthorizedException("Session is invalid");
    }
    return this.hashToken(token);
  }

  private isValidTokenShape(token: string) {
    return /^[A-Za-z0-9_-]{43}$/.test(token);
  }

  private hashToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private toPublicUser(user: StoredUser): AppUser {
    const publicUser: AppUser = {
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      role: user.role.replaceAll("_", "-") as Role
    };
    const permissionRecords =
      user.seller_memberships?.find((item) => item.active)?.seller.permissions ??
      user.sellers?.[0]?.permissions;
    const permissions = permissionRecords?.map(
      (item) => item.permission
    );
    if (permissions) publicUser.permissions = permissions;
    publicUser.isPlatformOwner = user.role === "platform_admin";
    publicUser.platformPermissions =
      user.role === "platform_admin"
        ? [
            "vendors_manage",
            "catalog_view",
            "orders_manage",
            "payouts_manage",
            "blog_manage"
          ]
        : (user.platform_permissions?.map((item) => item.permission) ?? []);
    return publicUser;
  }

  private async hashPassword(password: string) {
    const salt = randomBytes(16);
    const derivedKey = await this.scrypt(password, salt, HASH_LENGTH);
    return [
      "scrypt",
      SCRYPT_COST,
      SCRYPT_BLOCK_SIZE,
      SCRYPT_PARALLELISM,
      salt.toString("base64"),
      derivedKey.toString("base64")
    ].join("$");
  }

  private async verifyPassword(password: string, storedHash: string) {
    const [algorithm, cost, blockSize, parallelism, salt, hash] =
      storedHash.split("$");
    const expected = Buffer.from(hash ?? "", "base64");

    if (
      algorithm !== "scrypt" ||
      !salt ||
      expected.length !== HASH_LENGTH ||
      Number(cost) !== SCRYPT_COST ||
      Number(blockSize) !== SCRYPT_BLOCK_SIZE ||
      Number(parallelism) !== SCRYPT_PARALLELISM
    ) {
      return false;
    }

    const actual = await this.scrypt(
      password,
      Buffer.from(salt, "base64"),
      expected.length
    );
    return timingSafeEqual(actual, expected);
  }

  private scrypt(password: string, salt: Buffer, keyLength: number) {
    return new Promise<Buffer>((resolve, reject) => {
      nodeScrypt(
        password,
        salt,
        keyLength,
        {
          N: SCRYPT_COST,
          r: SCRYPT_BLOCK_SIZE,
          p: SCRYPT_PARALLELISM,
          maxmem: 64 * 1024 * 1024
        },
        (error, derivedKey) => {
          if (error) reject(error);
          else resolve(derivedKey);
        }
      );
    });
  }
}
