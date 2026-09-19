import { AuthService } from "../modules/auth/auth.service";
import { AuthLoginSettingsService } from "../modules/auth/auth-login-settings.service";
import { PrismaService } from "./prisma.service";

type AdminSeedConfig = {
  email: string;
  fullName: string;
  password: string;
  username: string;
};

const prisma = new PrismaService();
const auth = new AuthService(prisma, new AuthLoginSettingsService(prisma));

function readAdminConfig(): AdminSeedConfig | null {
  const values = {
    email: process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase(),
    fullName: process.env.BOOTSTRAP_ADMIN_FULL_NAME?.trim(),
    password: process.env.BOOTSTRAP_ADMIN_PASSWORD,
    username: process.env.BOOTSTRAP_ADMIN_USERNAME?.trim().toLowerCase()
  };
  const configuredValues = Object.values(values).filter(Boolean).length;

  if (configuredValues === 0) return null;
  if (configuredValues !== Object.keys(values).length) {
    throw new Error("All BOOTSTRAP_ADMIN_* values must be configured together");
  }
  if (values.password!.length < 12) {
    throw new Error("BOOTSTRAP_ADMIN_PASSWORD must contain at least 12 characters");
  }

  return values as AdminSeedConfig;
}

async function seedAdmin(config: AdminSeedConfig) {
  const [byEmail, byUsername] = await Promise.all([
    prisma.users.findUnique({ where: { email: config.email } }),
    prisma.users.findUnique({ where: { username: config.username } })
  ]);

  if (byEmail && byUsername && byEmail.id !== byUsername.id) {
    throw new Error("Bootstrap admin email and username belong to different users");
  }

  const existing = byEmail ?? byUsername;
  const passwordHash = existing?.password_hash
    ? undefined
    : await auth.createPasswordHash(config.password);

  if (existing) {
    await prisma.users.update({
      where: { id: existing.id },
      data: {
        email: config.email,
        full_name: config.fullName,
        password_hash: passwordHash,
        role: "platform_admin",
        username: config.username
      }
    });
    return "updated";
  }

  await prisma.users.create({
    data: {
      email: config.email,
      full_name: config.fullName,
      password_hash: await auth.createPasswordHash(config.password),
      role: "platform_admin",
      username: config.username
    }
  });
  return "created";
}

async function seedDevelopmentPaymentMethods() {
  if (!process.argv.includes("--development")) return;
  if (process.env.NODE_ENV === "production") {
    throw new Error("Development payment methods cannot be seeded in production");
  }

  await prisma.payment_method_configs.upsert({
    where: { provider_code: "local-country-gateway" },
    create: { provider_code: "local-country-gateway", enabled: true },
    update: { enabled: true }
  });
  console.log("Development payment method enabled: local-country-gateway");
}

async function main() {
  await seedDevelopmentPaymentMethods();

  const config = readAdminConfig();
  if (!config) {
    console.log("Admin seed skipped: BOOTSTRAP_ADMIN_* is not configured");
    return;
  }

  const result = await seedAdmin(config);
  console.log(`Admin seed ${result}: ${config.username}`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Admin seed failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
