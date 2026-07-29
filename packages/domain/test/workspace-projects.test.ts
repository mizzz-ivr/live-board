import { describe, expect, it } from 'vitest';

import {
  DomainError,
  appendWorkspaceProject,
  createPage,
  createProject,
  createWorkspace,
  selectWorkspaceProject,
} from '../src/index.js';

const TIMESTAMP = '2026-07-29T00:00:00.000Z';

function project(projectId: string, workspaceId = 'workspace-1') {
  return createProject({
    id: projectId,
    workspaceId,
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
    projects: [project('project-1'), project('project-2')],
    activeProjectId: 'project-1',
    createdAt: TIMESTAMP,
  });
}

describe('workspace projects', () => {
  it('Projectを追加してアクティブにする', () => {
    const current = workspace();
    const next = appendWorkspaceProject(current, project('project-3'), TIMESTAMP);

    expect(next).not.toBe(current);
    expect(next.projects.map((candidate) => candidate.id)).toEqual([
      'project-1',
      'project-2',
      'project-3',
    ]);
    expect(next.activeProjectId).toBe('project-3');
    expect(current.projects).toHaveLength(2);
    expect(next.projects[2]).not.toBe(project('project-3'));
  });

  it('既存Projectを選択し、他Projectを変更しない', () => {
    const current = workspace();
    const next = selectWorkspaceProject(current, 'project-2', TIMESTAMP);

    expect(next.activeProjectId).toBe('project-2');
    expect(next.projects).toBe(current.projects);
    expect(current.activeProjectId).toBe('project-1');
  });

  it('選択済みProjectの再選択は同じWorkspaceを返す', () => {
    const current = workspace();
    expect(selectWorkspaceProject(current, 'project-1', TIMESTAMP)).toBe(current);
  });

  it('存在しないProjectを拒否する', () => {
    expect(() => selectWorkspaceProject(workspace(), 'missing', TIMESTAMP)).toThrowError(
      DomainError,
    );
  });

  it('重複Project IDを拒否する', () => {
    expect(() => appendWorkspaceProject(workspace(), project('project-1'), TIMESTAMP)).toThrow(
      'Duplicate project id: project-1',
    );
  });

  it('別Workspaceに属するProjectを拒否する', () => {
    expect(() =>
      appendWorkspaceProject(workspace(), project('project-3', 'workspace-2'), TIMESTAMP),
    ).toThrow('does not belong to workspace workspace-1');
  });
});
