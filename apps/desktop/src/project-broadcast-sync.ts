import {
  createBroadcastSnapshot,
  type ProjectAssetLibrary,
  type Workspace,
} from '@live-board/domain';
import {
  publishBroadcastSnapshotWithAssets,
  type BroadcastIpcApi,
  type BroadcastPublishResponse,
} from './broadcast-ipc';

export function publishActiveProjectBroadcastSnapshot(input: {
  api: BroadcastIpcApi;
  requestId: string;
  workspace: Workspace;
  revision: number;
  generatedAt: string;
  assetLibrary: ProjectAssetLibrary;
  registeredSha256: Set<string>;
}): Promise<BroadcastPublishResponse> {
  const snapshot = createBroadcastSnapshot(
    input.workspace,
    input.workspace.activeProjectId,
    input.revision,
    input.generatedAt,
    input.assetLibrary,
  );
  return publishBroadcastSnapshotWithAssets(
    input.api,
    input.requestId,
    snapshot,
    input.registeredSha256,
  );
}
