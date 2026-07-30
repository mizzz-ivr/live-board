import { describe, expect, it } from 'vitest';

import {
  DomainError,
  appendWorkspaceProject,
  createPage,
  createProject,
  createWorkspace,
  renameWorkspaceProject,
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
  it('Projectを複製して追加し、アクティブにする', () => {
    const current = workspace();
    const addedProject = project('project-3');
    const next = appendWorkspaceProject(current, addedProject, TIMESTAMP);

    expect(next).not.toBe(current);
    expect(next.projects.map((candidate) => candidate.id)).toEqual([
      'project-1',
      'project-2',
      'project-3',
    ]);
    expect(next.activeProjectId).toBe('project-3');
    expect(current.projects).toHaveLength(2);
    expect(next.projects[2]).not.toBe(addedProject);
    expect(next.projects[2]?.pages[0]).not.toBe(addedProject.pages[0]);
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

  it('Project名を前後空白を除去して変更する', () => {
    const current = workspace();
    const next = renameWorkspaceProject(current, 'project-1', '  配信用ボード  ', TIMESTAMP);

    expect(next).not.toBe(current);
    expect(next.projects[0]?.name).toBe('配信用ボード');
    expect(next.projects[0]?.id).toBe('project-1');
    expect(next.projects[0]?.pages).toEqual(current.projects[0]?.pages);
    expect(next.projects[1]).toBe(current.projects[1]);
    expect(next.activeProjectId).toBe(current.activeProjectId);
  });

  it('同じProject名への変更は同じWorkspaceを返す', () => {
    const current = workspace();
    expect(renameWorkspaceProject(current, 'project-1', ' project-1 ', TIMESTAMP)).toBe(current);
  });

  it('無効なProject名と存在しないProjectを拒否する', () => {
    expect(() => renameWorkspaceProject(workspace(), 'project-1', '   ', TIMESTAMP)).toThrow(
      'Entity name must be 1 to 120 characters',
    );
    expect(() =>
      renameWorkspaceProject(workspace(), 'project-1', 'a'.repeat(121), TIMESTAMP),
    ).toThrow('Entity name must be 1 to 120 characters');
    expect(() => renameWorkspaceProject(workspace(), 'missing', '名前', TIMESTAMP)).toThrow(
      'Project not found: missing',
    );
  });

});
