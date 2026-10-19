SET lock_timeout = '5s';

ALTER TABLE club_settings
  ALTER COLUMN points_per_1000_toman TYPE NUMERIC(20, 4)
    USING points_per_1000_toman::numeric(20, 4),
  ALTER COLUMN toman_per_point TYPE NUMERIC(20, 4)
    USING toman_per_point::numeric(20, 4);

ALTER TABLE club_rule_versions
  ALTER COLUMN points_per_1000_toman TYPE NUMERIC(20, 4)
    USING points_per_1000_toman::numeric(20, 4);
