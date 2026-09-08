-- Run after the transaction which adds products_publish to seller_permission.
-- Existing product managers retain their previous ability to publish until an
-- administrator explicitly removes the new permission.
INSERT INTO "seller_permissions" ("seller_id", "permission", "granted_by_id")
SELECT "seller_id", 'products_publish'::"seller_permission", "granted_by_id"
FROM "seller_permissions"
WHERE "permission" = 'products_manage'
ON CONFLICT DO NOTHING;
