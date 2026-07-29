import { describe, expect, it } from 'vitest';
import {
  canRedoWorkspace,
  canUndoWorkspace,
  createAddProjectCommand,
  createPage,
  createProject,
  createSelectProjectCommand,
  createWorkspace,
  createWorkspaceCommandState,
  dispatchWorkspaceCommand,
  findProject,
  getWorkspaceHistory,
  getWorkspaceHistoryBytes,
  redoWorkspaceCommand,
  replaceProject,
  trimWorkspaceRedoHistoryForExternalProjectBytes,
  undoWorkspaceCommand,
} from '../src/index.js';

const TIMESTAMP = '2026-07-29T00:00:00.000Z';

function project(projectId: string) {
  return createProject({
    id: projectId,
    workspaceId: 'workspace-1',
    name: projectId,
    pages: [
      createPage({
        id: `${projectId}:page:1`,
        projectId,
        name: 'ページ 1',
        createdAt: TIMESTAMP,
      }),
    ],
    createdAt: TIMESTAMP,
  });
}

function workspace() {
  return createWorkspace({
    id: 'workspace-1',
    name: 'Workspace',
    projects: [project('project-1')],
    createdAt: TIMESTAMP,
  });
}

describe('workspace command history', () => {
  it('Project追加だけをUndoし、既存Projectの後続編集を維持する', () => {
    const added = dispatchWorkspaceCommand(
      createWorkspaceCommandState(workspace()),
      createAddProjectCommand('workspace-1', project('project-2'), {
        commandId: 'command-1',
        createdAt: TIMESTAMP,
      }),
    );
    const existing = findProject(added.workspace, 'project-1');
    const editedState = {
      ...added,
      workspace: replaceProject(
        added.workspace,
        { ...existing, name: '既存Projectの後続編集' },
        TIMESTAMP,
      ),
    };

    const undone = undoWorkspaceCommand(editedState);
    expect(undone.workspace.projects.map((candidate) => candidate.id)).toEqual([
      'project-1',
    ]);
    expect(findProject(undone.workspace, 'project-1').name).toBe(
      '既存Projectの後続編集',
    );
    expect(canRedoWorkspace(undone)).toBe(true);
  });

  it('追加Projectの現在内容をUndo時に退避し、Redoで復元する', () => {
    const added = dispatchWorkspaceCommand(
      createWorkspaceCommandState(workspace()),
      createAddProjectCommand('workspace-1', project('project-2'), {
        commandId: 'command-1',
        createdAt: TIMESTAMP,
      }),
    );
    const addedProject = findProject(added.workspace, 'project-2');
    const editedState = {
      ...added,
      workspace: replaceProject(
        added.workspace,
        { ...addedProject, name: '編集済みProject' },
        TIMESTAMP,
      ),
    };

    const redone = redoWorkspaceCommand(undoWorkspaceCommand(editedState));
    expect(findProject(redone.workspace, 'project-2').name).toBe('編集済みProject');
  });

  it('Project選択をUndo・Redoできる', () => {
    const initial = dispatchWorkspaceCommand(
      createWorkspaceCommandState(workspace()),
      createAddProjectCommand('workspace-1', project('project-2'), {
        commandId: 'command-add',
        createdAt: TIMESTAMP,
      }),
    );
    const selected = dispatchWorkspaceCommand(
      initial,
      createSelectProjectCommand('workspace-1', 'project-1', {
        commandId: 'command-select',
        createdAt: TIMESTAMP,
      }),
    );
    expect(selected.workspace.activeProjectId).toBe('project-1');
    expect(undoWorkspaceCommand(selected).workspace.activeProjectId).toBe('project-2');
    expect(
      redoWorkspaceCommand(undoWorkspaceCommand(selected)).workspace.activeProjectId,
    ).toBe('project-1');
  });

  it('Redo用Projectの外部Asset容量も履歴上限へ含める', () => {
    const added = dispatchWorkspaceCommand(
      createWorkspaceCommandState(workspace(), 100, 2_000),
      createAddProjectCommand('workspace-1', project('project-2'), {
        commandId: 'command-add',
        createdAt: TIMESTAMP,
      }),
    );
    const undone = undoWorkspaceCommand(added);
    expect(canRedoWorkspace(undone)).toBe(true);

    const trimmed = trimWorkspaceRedoHistoryForExternalProjectBytes(undone, {
      'project-2': 4_000,
    });
    expect(canRedoWorkspace(trimmed)).toBe(false);
    expect(trimmed.histories.workspace.future).toEqual([]);
  });

  it('Workspace履歴を推定バイト数上限内へ切り詰める', () => {
    let state = dispatchWorkspaceCommand(
      createWorkspaceCommandState(workspace(), 100, 2_000),
      createAddProjectCommand('workspace-1', project('project-2'), {
        commandId: 'command-add',
        createdAt: TIMESTAMP,
      }),
    );
    for (let index = 0; index < 30; index += 1) {
      state = dispatchWorkspaceCommand(
        state,
        createSelectProjectCommand(
          'workspace-1',
          index % 2 === 0 ? 'project-1' : 'project-2',
          { commandId: `command-select-${index}`, createdAt: TIMESTAMP },
        ),
      );
    }
    expect(getWorkspaceHistoryBytes(state)).toBeLessThanOrEqual(2_000);
    expect(getWorkspaceHistory(state).past.length).toBeLessThan(31);
    expect(canUndoWorkspace(state)).toBe(true);
  });
});
