BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';

ALTER TABLE blog_categories ADD COLUMN position integer NOT NULL DEFAULT 0;
ALTER TABLE blog_tags ADD COLUMN position integer NOT NULL DEFAULT 0;
ALTER TABLE blog_category_translations
  ADD COLUMN description varchar(4000),
  ADD COLUMN meta_title varchar(160),
  ADD COLUMN meta_description varchar(320);
ALTER TABLE blog_tag_translations
  ADD COLUMN description varchar(4000),
  ADD COLUMN meta_title varchar(160),
  ADD COLUMN meta_description varchar(320);

CREATE INDEX blog_categories_position_created_at_id_idx ON blog_categories(position, created_at, id);
CREATE INDEX blog_tags_position_created_at_id_idx ON blog_tags(position, created_at, id);

COMMIT;
