/**
 * Merges a newly fetched batch of historical messages into the existing messages array.
 * Filters out any messages that already exist (by message ID) to prevent duplicates.
 * Prepends the new historical messages chronologically at the beginning of the list.
 */
export function mergeHistoryBatch(existingMessages, newBatch) {
  const existing = Array.isArray(existingMessages) ? existingMessages : [];
  const batch = Array.isArray(newBatch) ? newBatch : [];
  
  const existingIds = new Set(existing.map(m => m.id).filter(Boolean));
  
  const deduped = batch.filter(m => {
    if (!m.id) return true; // keep unsaved messages (usually local temp messages)
    return !existingIds.has(m.id);
  });
  
  return [...deduped, ...existing];
}
