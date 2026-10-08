import assert from "node:assert/strict";
import { it } from "node:test";
import { randomUUID } from "node:crypto";
import { ConflictException } from "@nestjs/common";
import { defaultTemplateConfiguration } from "@topgsm/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { assertDedicatedTestDatabase } from "../../test/test-database";
import { TemplateSettingsService } from "./template.service";
assertDedicatedTestDatabase();
it("persists template settings with locale isolation and one winner per version", async () => {
  const prisma = new PrismaService(); await prisma.$connect();
  const actor = await prisma.users.create({ data: { full_name: "Template test admin", email: "template-" + randomUUID() + "@example.test", role: "platform_admin" } });
  const service = new TemplateSettingsService(prisma);
  const configuration = defaultTemplateConfiguration("fa");
  try {
    const creates = await Promise.allSettled([service.save("fa", {version:0, configuration}, actor.id), service.save("fa", {version:0, configuration}, actor.id)]);
    assert.equal(creates.filter((result)=>result.status==="fulfilled").length,1);
    assert.ok(creates.some((result)=>result.status==="rejected" && result.reason instanceof ConflictException));
    const updates = await Promise.allSettled([service.save("fa", {version:1, configuration}, actor.id),service.save("fa", {version:1, configuration}, actor.id)]);
    assert.equal(updates.filter((result)=>result.status==="fulfilled").length,1);
    assert.ok(updates.some((result)=>result.status==="rejected" && result.reason instanceof ConflictException));
    const saved = await service.get("fa"); assert.equal(saved.version,2); assert.deepEqual(saved.configuration,configuration);
    assert.equal((await service.get("en")).version,0);
    const english = defaultTemplateConfiguration("en"); english.banner.text="English banner";
    await service.save("en",{version:0,configuration:english},actor.id);
    assert.equal((await service.get("en")).configuration.banner.text,"English banner");
    assert.equal((await service.get("fa")).configuration.banner.text,configuration.banner.text);
    assert.equal((await prisma.template_settings.findUniqueOrThrow({where:{locale:"fa"}})).updated_by_id,actor.id);
    await assert.rejects(prisma.$executeRaw`UPDATE template_settings SET version=0 WHERE locale='fa'`);
    await assert.rejects(prisma.$executeRaw`UPDATE template_settings SET configuration='[]'::jsonb WHERE locale='fa'`);
    await assert.rejects(prisma.$executeRaw`UPDATE template_settings SET locale='zz' WHERE locale='fa'`);
    await assert.rejects(prisma.$executeRaw`UPDATE template_settings SET updated_by_id='missing' WHERE locale='fa'`);
  } finally {
    await prisma.template_settings.deleteMany({where:{updated_by_id:actor.id}}); await prisma.users.delete({where:{id:actor.id}}); await prisma.$disconnect();
  }
});
