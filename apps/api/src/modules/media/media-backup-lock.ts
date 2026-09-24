// Media writers and backup snapshots share this transaction-scoped lock so a
// backup never observes database metadata for a file that is being replaced.
export const MEDIA_BACKUP_LOCK = 8_204_211_947;
