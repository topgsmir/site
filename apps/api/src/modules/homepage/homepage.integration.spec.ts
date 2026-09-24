import { strict as assert } from "node:assert";
import { it } from "node:test";
import { randomUUID } from "node:crypto";
import { ConflictException } from "@nestjs/common";
import type { HomepageContent } from "@topgsm/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { assertDedicatedTestDatabase } from "../../test/test-database";
import { HomepageService } from "./homepage.service";

assertDedicatedTestDatabase();

it("persists localized homepage documents atomically and enforces database constraints", async () => {
  const prisma = new PrismaService();
  await prisma.$connect();
  const actor = await prisma.users.create({ data: { full_name: "Homepage test admin", email: `homepage-${randomUUID()}@example.test`, role: "platform_admin" } });
  const link = { label: "Browse", href: "/en/products" };
  const section = { enabled: true, title: "Test section", description: "Description" };
  const content: HomepageContent = { hero: { eyebrow: "Repair", title: "Repair", accent: "Together", description: "Description", image: "/images/repair-studio.png", imageAlt: "Phone", primary: link, secondary: link }, shortcuts: [], collections: { ...section, items: [] }, offers: { ...section, items: [] }, experts: section, latest: section, about: { ...section, points: ["Expert help"], link }, footer: { description: "Repair", links: [link] } };
  const service = new HomepageService(prisma);
  try {
    assert.equal((await service.get("fa")).version, 0);
    const creates = await Promise.allSettled([service.save("fa", { version: 0, content }, actor.id), service.save("fa", { version: 0, content }, actor.id)]);
    assert.equal(creates.filter((result) => result.status === "fulfilled").length, 1);
    assert.ok(creates.some((result) => result.status === "rejected" && result.reason instanceof ConflictException));
    const updates = await Promise.allSettled([service.save("fa", { version: 1, content }, actor.id), service.save("fa", { version: 1, content }, actor.id)]);
    assert.equal(updates.filter((result) => result.status === "fulfilled").length, 1);
    assert.ok(updates.some((result) => result.status === "rejected" && result.reason instanceof ConflictException));
    assert.equal((await service.get("fa")).version, 2);
    assert.deepEqual((await service.get("fa")).content, content);
    assert.equal((await service.get("en")).content, null);
    await service.save("en", { version: 0, content: { ...content, hero: { ...content.hero, title: "English" } } }, actor.id);
    assert.equal((await service.get("fa")).content?.hero.title, "Repair");
    assert.equal((await service.get("en")).content?.hero.title, "English");
    const stored = await prisma.homepage_content.findUniqueOrThrow({ where: { locale: "fa" } });
    assert.equal(stored.updated_by_id, actor.id);
    await assert.rejects(prisma.$executeRaw`UPDATE homepage_content SET version = 0 WHERE locale = 'fa'`);
    await assert.rejects(prisma.$executeRaw`UPDATE homepage_content SET content = '[]'::jsonb WHERE locale = 'fa'`);
    await assert.rejects(prisma.$executeRaw`UPDATE homepage_content SET locale = 'zz' WHERE locale = 'fa'`);
    await assert.rejects(prisma.$executeRaw`UPDATE homepage_content SET updated_by_id = 'missing' WHERE locale = 'fa'`);
  } finally {
    await prisma.homepage_content.deleteMany({ where: { updated_by_id: actor.id } });
    await prisma.users.delete({ where: { id: actor.id } });
    await prisma.$disconnect();
  }
});
