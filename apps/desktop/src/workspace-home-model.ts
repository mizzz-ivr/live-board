export function sortRecentWorkspaceDocuments(
  documents: readonly PublicDocumentRecord[],
): PublicDocumentRecord[] {
  return [...documents].sort((left, right) => {
    if (left.favorite !== right.favorite) return left.favorite ? -1 : 1;

    const timestampDifference =
      normalizedTimestamp(right.lastOpenedAt) - normalizedTimestamp(left.lastOpenedAt);
    if (timestampDifference !== 0) return timestampDifference;

    const nameDifference = left.displayName.localeCompare(right.displayName, 'ja-JP');
    if (nameDifference !== 0) return nameDifference;
    return left.documentId.localeCompare(right.documentId);
  });
}

export function formatHomeTimestamp(value: string): string {
  const timestamp = normalizedTimestamp(value);
  return timestamp === 0 ? '日時不明' : new Date(timestamp).toLocaleString('ja-JP');
}

function normalizedTimestamp(value: string): number {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : 0;
}
