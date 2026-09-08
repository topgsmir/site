# Media storage operations

Blog media is stored beneath `MEDIA_ROOT` in UUID-sharded directories. The API writes temporary files on the same filesystem and atomically renames them after Sharp has decoded, stripped metadata, and re-encoded the image as WebP.

Docker Compose mounts the named volume `topgsm-media-data` at `/var/lib/topgsm/media`. Back up the PostgreSQL database and this volume in the same maintenance window so asset rows and files remain consistent.

To back up the volume, stop writes, then archive `/var/lib/topgsm/media` from a temporary container that mounts `topgsm-media-data` read-only. To restore, restore the database snapshot first and then restore the matching media archive into an empty `topgsm-media-data` volume before starting the API.

This filesystem backend supports a single API server. Do not run multiple API replicas against independent disks. Horizontal scaling requires moving the media service to shared or object storage while preserving the stable `/media/{assetId}/{variant}.webp` URL contract.
