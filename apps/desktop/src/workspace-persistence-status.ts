export function resolveWorkspacePersistenceIdleStatus(input: {
  hasDocument: boolean;
  revision: number;
  lastExplicitSaveRevision: number | null;
}): string {
  if (!input.hasDocument) return '保存: 未保存';
  if (
    input.lastExplicitSaveRevision !== null &&
    input.revision === input.lastExplicitSaveRevision
  ) {
    return '保存: 明示保存済み';
  }
  return '保存: 変更あり';
}
