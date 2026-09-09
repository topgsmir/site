import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./client";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString) {
      throw new Error("DATABASE_URL is required to initialize Prisma");
    }

    super({
      adapter: new PrismaPg({ connectionString, connectionTimeoutMillis: 5_000 })
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
