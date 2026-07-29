import { describe, expect, it } from 'vitest';
import {
  canRedoWorkspace,
  createAddLayerCommand,
  createAddProjectCommand,
  createAddRasterStrokeCommand,
  createCanvasWorkspaceCommandState,
  createClearRasterCommand,
  createEmptyWorkspace,
  createLayer,
  createPage,
  createProject,
  dispatchCanvasCommand,
  dispatchLayerCommandWithCanvasHistory,
  dispatchWorkspaceCommandWithCanvasHistory,
  getWorkspaceRedoRetainedBytesByProject,
  trimWorkspaceRedoHistoryForExternalProjectBytesWithCanvasHistory,
  undoWorkspaceCommandWithCanvasHistory,
} from '../src/index.js';

const TIMESTAMP = '2026-07-29T00:00:00.000Z';

function metadata(commandId: string) {
  return { commandId, createdAt: TIMESTAMP };
}

describe('workspace redo memory', () => {
  it('Redo用Canvas履歴込みで上限を超えたProjectを履歴ごと回収する', () => {
    const workspace = createEmptyWorkspace('redo-memory');
    const projectId = 'project-redo';
    const pageId = 'page-redo';
    const layerId = 'layer-redo';
    const page = createPage({
      id: pageId,
      projectId,
      name: 'Redo Page',
      createdAt: TIMESTAMP,
    });
    const project = createProject({
      id: projectId,
      workspaceId: workspace.id,
      name: 'Redo Project',
      pages: [page],
      createdAt: TIMESTAMP,
    });
    let state = {
      ...createCanvasWorkspaceCommandState(workspace),
      workspaceHistoryMemoryLimitBytes: 16_000,
    };

    state = dispatchWorkspaceCommandWithCanvasHistory(
      state,
      createAddProjectCommand(workspace.id, project, metadata('project-add')),
    );
    const layer = createLayer({
      id: layerId,
      pageId,
      name: 'Redo Raster',
      type: 'raster',
      createdAt: TIMESTAMP,
    });
    state = dispatchLayerCommandWithCanvasHistory(
      state,
      createAddLayerCommand(
        projectId,
        pageId,
        layer,
        null,
        0,
        metadata('layer-add'),
      ),
    );
    state = dispatchCanvasCommand(
      state,
      createAddRasterStrokeCommand(
        projectId,
        pageId,
        layerId,
        {
          id: 'large-stroke',
          tool: 'pen',
          pointerType: 'pen',
          color: '#FF3366',
          size: 24,
          opacity: 0.8,
          hardness: 0.7,
          spacing: 0.2,
          smoothing: 0.4,
          taperStart: 0.1,
          taperEnd: 0.2,
          pressureSize: true,
          pressureOpacity: true,
          points: Array.from({ length: 5_000 }, (_, index) => ({
            x: index,
            y: index / 2,
            pressure: index % 2,
            tiltX: 0,
            tiltY: 0,
            timestamp: index,
          })),
        },
        metadata('stroke-add'),
      ),
    );
    state = dispatchCanvasCommand(
      state,
      createClearRasterCommand(
        projectId,
        pageId,
        layerId,
        metadata('raster-clear'),
      ),
    );

    const undone = undoWorkspaceCommandWithCanvasHistory(state);
    expect(canRedoWorkspace(undone)).toBe(true);
    expect(undone.canvasHistories[pageId]).toBeDefined();
    expect(undone.layerHistories[pageId]).toBeDefined();

    const retainedBytes = getWorkspaceRedoRetainedBytesByProject(undone, {});
    expect(retainedBytes[projectId]).toBeGreaterThan(
      undone.workspaceHistoryMemoryLimitBytes,
    );

    const trimmed =
      trimWorkspaceRedoHistoryForExternalProjectBytesWithCanvasHistory(
        undone,
        retainedBytes,
      );

    expect(canRedoWorkspace(trimmed)).toBe(false);
    expect(trimmed.canvasHistories[pageId]).toBeUndefined();
    expect(trimmed.layerHistories[pageId]).toBeUndefined();
    expect(trimmed.histories.project[projectId]).toBeUndefined();
    expect(trimmed.histories.page[pageId]).toBeUndefined();
  });
});
