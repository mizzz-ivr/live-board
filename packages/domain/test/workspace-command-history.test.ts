import { describe, expect, it } from 'vitest';
import {
  canRedoWorkspace,
  canUndoWorkspace,
  createAddProjectCommand,
  createPage,
  createProject,
  createWorkspace,
  createWorkspaceCommandState,
  dispatchWorkspaceCommand,
  findProject,
  redoWorkspaceCommand,
  replaceProject,
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

describe('workspace command history', () => {
  it('Project追加をUndo・Redoできる', () => {
    const initial = createWorkspace({
      id: 'workspace-1',
      name: 'Workspace',
      projects: [project('project-1')],
      createdAt: TIMESTAMP,
    });
    const added = dispatchWorkspaceCommand(
      createWorkspaceCommandState(initial),
      createAddProjectCommand('workspace-1', project('project-2'), {
        commandId: 'command-1',
        createdAt: TIMESTAMP,
      }),
    );

    expect(added.workspace.projects.map((candidate) => candidate.id)).toEqual([
      'project-1',
      'project-2',
    ]);
    expect(canUndoWorkspace(added)).toBe(true);

    const undone = undoWorkspaceCommand(added);
    expect(undone.workspace.projects.map((candidate) => candidate.id)).toEqual([
      'project-1',
    ]);
    expect(canRedoWorkspace(undone)).toBe(true);

    const redone = redoWorkspaceCommand(undone);
    expect(redone.workspace.projects.map((candidate) => candidate.id)).toEqual([
      'project-1',
      'project-2',
    ]);
  });

  it('追加Projectの現在内容をUndo時に退避し、Redoで復元する', () => {
    const initial = createWorkspace({
      id: 'workspace-1',
      name: 'Workspace',
      projects: [project('project-1')],
      createdAt: TIMESTAMP,
    });
    const added = dispatchWorkspaceCommand(
      createWorkspaceCommandState(initial),
      createAddProjectCommand('workspace-1', project('project-2'), {
        commandId: 'command-1',
        createdAt: TIMESTAMP,
      }),
    );
    const currentProject = findProject(added.workspace, 'project-2');
    const editedState = {
      ...added,
      workspace: replaceProject(
        added.workspace,
        { ...currentProject, name: '編集済みProject' },
        TIMESTAMP,
      ),
    };

    const redone = redoWorkspaceCommand(undoWorkspaceCommand(editedState));
    expect(findProject(redone.workspace, 'project-2').name).toBe('編集済みProject');
  });
});
