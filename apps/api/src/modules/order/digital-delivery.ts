/** Legacy rows remain readable during rollout; new writes snapshot every file. */
export function digitalFileReferences(digital: { file_reference: string; file_references?: string[] }) {
  return digital.file_references?.length ? digital.file_references : [digital.file_reference];
}

export function mapDigitalDeliveries(orderId: string, itemId: string, files: Array<{
  file_index: number; delivery_url: string; max_downloads: number; download_count: number;
}> | null) {
  return (files ?? []).map((file) => ({
    downloadUrl: `/orders/${orderId}/items/${itemId}/download?fileIndex=${file.file_index}`,
    destinationHost: new URL(file.delivery_url).hostname,
    maxDownloads: file.max_downloads,
    downloadCount: file.download_count
  }));
}
