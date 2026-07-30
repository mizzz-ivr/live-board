import { describe, expect, it, vi } from 'vitest';
import {
  createPage,
  createProject,
  createProjectAssetLibrary,
  createWorkspace,
  selectWorkspaceProject,
} from '@live-board/domain';
import type { BroadcastSnapshotDescriptor } from '@live-board/obs-protocol';
import { publishActiveProjectBroadcastSnapshot } from '../src/project-broadcast-sync';

const TIMESTAMP = '2026-07-29T00:00:00.000Z';

function project(projectId: string, pageId: string) {
  return createProject({
    id: projectId,
    workspaceId: 'workspace-1',
    name: projectId,
    pages: [
      createPage({
        id: pageId,
        projectId,
        name: pageId,
        createdAt: TIMESTAMP,
      }),
    ],
    activeBroadcastPageId: pageId,
    createdAt: TIMESTAMP,
  });
}

describe('active project broadcast sync', () => {
  it('選択Projectの配信PageをIPC Snapshotとしてpublishする', async () => {
    const workspace = selectWorkspaceProject(
      createWorkspace({
        id: 'workspace-1',
        name: 'Workspace',
        projects: [
          project('project-1', 'page-1'),
          project('project-2', 'page-2'),
        ],
        activeProjectId: 'project-1',
        createdAt: TIMESTAMP,
      }),
      'project-2',
      TIMESTAMP,
    );
    const published: BroadcastSnapshotDescriptor[] = [];
    const api = {
      registerBroadcastAssets: vi.fn(async (requestId: string) => ({
        requestId,
        registeredSha256: [],
      })),
      publishBroadcastSnapshot: vi.fn(
        async (requestId: string, snapshot: BroadcastSnapshotDescriptor) => {
          published.push(snapshot);
          return { requestId, acceptedRevision: snapshot.revision };
        },
      ),
    };

    await publishActiveProjectBroadcastSnapshot({
      api,
      requestId: 'request-1',
      workspace,
      revision: 7,
      generatedAt: TIMESTAMP,
      assetLibrary: createProjectAssetLibrary(),
      registeredSha256: new Set(),
    });

    expect(published).toHaveLength(1);
    expect(published[0]).toMatchObject({
      projectId: 'project-2',
      pageId: 'page-2',
      revision: 7,
    });
  });
});
