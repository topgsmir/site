# Numeric order identifiers

Orders have one identifier: `orders.id`, containing only decimal digits. The same
value is used by foreign keys, HTTP routes, JSON bodies, cursors, CSV exports and
the UI. There is no separate display-number column. IDs stay digit strings in
Prisma and JSON to avoid JavaScript integer rounding; PostgreSQL validates the
numeric format and signed-bigint range and generates them using `orders_id_seq`.

`20261020160000_unified_numeric_order_ids` converts existing order IDs in one
transaction. Foreign keys cascade the conversion, and operational outbox and
wallet/club reference keys are remapped. Journal write-protection triggers are
temporarily disabled within that transaction for identity-only repair and are
re-enabled before commit. Amounts, ownership and business statuses are unchanged.

Apply during maintenance with all application instances on the matching code.
Old application versions and UUID order URLs are incompatible with the new IDs.
Take a full database backup before applying. Rollback requires restoring that
backup together with the prior application version; do not recreate UUID IDs
from scratch or restore only the orders table.

The local migration was tested against a complete disposable database copy,
checking preserved order count, cascading references, a newly generated numeric
ID, rejection of non-numeric IDs, removal of the duplicate column and re-enabled
journal protections. A separate test verified sequence uniqueness under twelve
concurrent inserts.
