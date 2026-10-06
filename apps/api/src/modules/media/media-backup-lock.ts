// Writers/cleanup use shared transaction locks. Backups acquire the exclusive
// session lock before starting their snapshot and retain it through file packing.
export const MEDIA_BACKUP_LOCK = 8_204_211_947;
