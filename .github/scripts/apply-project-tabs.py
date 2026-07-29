from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    content = file_path.read_text(encoding="utf-8")
    if old not in content:
        raise RuntimeError(f"replacement anchor not found: {path}\n{old[:120]}")
    file_path.write_text(content.replace(old, new, 1), encoding="utf-8")


def write(path: str, content: str) -> None:
    file_path = Path(path)
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text(content, encoding="utf-8")


write(
    "packages/domain/src/workspace-projects.ts",
    """import {
  DomainError,
  assertWorkspaceIntegrity,
  cloneProject,
  findProject,
  type Project,
  type ProjectId,
  type Workspace,
} from './model.js';

export function appendWorkspaceProject(
  workspace: Workspace,
  project: Project,
  updatedAt = new Date().toISOString(),
): Workspace {
  if (project.workspaceId !== workspace.id) {
    throw new DomainError(
      'PROJECT_NOT_FOUND',
      `Project ${project.id} does not belong to workspace ${workspace.id}`,
    );
  }
  if (workspace.projects.some((candidate) => candidate.id === project.id)) {
    throw new DomainError(
      'DUPLICATE_PROJECT_ID',
      `Duplicate project id: ${project.id}`,
    );
  }

  const nextWorkspace: Workspace = {
    ...workspace,
    projects: [...workspace.projects, cloneProject(project)],
    activeProjectId: project.id,
    updatedAt,
  };
  assertWorkspaceIntegrity(nextWorkspace);
  return nextWorkspace;
}

export function selectWorkspaceProject(
  workspace: Workspace,
  projectId: ProjectId,
  updatedAt = new Date().toISOString(),
): Workspace {
  findProject(workspace, projectId);
  if (workspace.activeProjectId === projectId) return workspace;

  const nextWorkspace: Workspace = {
    ...workspace,
    activeProjectId: projectId,
    updatedAt,
  };
  assertWorkspaceIntegrity(nextWorkspace);
  return nextWorkspace;
}
""",
)

replace_once(
    "packages/domain/src/index.ts",
    "export * from './model.js';\nexport * from './commands.js';",
    "export * from './model.js';\nexport * from './workspace-projects.js';\nexport * from './commands.js';",
)

write(
    "packages/domain/test/workspace-projects.test.ts",
    """import { describe, expect, it } from 'vitest';

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
""",
)

write(
    "apps/desktop/src/project-tabs-model.ts",
    """const RECENTLY_CLOSED_LIMIT = 10;

export interface ProjectTabsState {
  workspaceId: string;
  openProjectIds: string[];
  recentlyClosedProjectIds: string[];
}

export function createProjectTabsState(
  workspaceId: string,
  projectIds: readonly string[],
): ProjectTabsState {
  return {
    workspaceId,
    openProjectIds: [...projectIds],
    recentlyClosedProjectIds: [],
  };
}

export function synchronizeProjectTabsState(
  state: ProjectTabsState,
  workspaceId: string,
  projectIds: readonly string[],
  activeProjectId: string,
): ProjectTabsState {
  if (state.workspaceId !== workspaceId) {
    return createProjectTabsState(workspaceId, projectIds);
  }

  const availableIds = new Set(projectIds);
  const knownIds = new Set([
    ...state.openProjectIds,
    ...state.recentlyClosedProjectIds,
  ]);
  const openProjectIds = state.openProjectIds.filter((id) => availableIds.has(id));
  for (const projectId of projectIds) {
    if (!knownIds.has(projectId)) openProjectIds.push(projectId);
  }
  if (availableIds.has(activeProjectId) && !openProjectIds.includes(activeProjectId)) {
    openProjectIds.push(activeProjectId);
  }

  const openSet = new Set(openProjectIds);
  return {
    workspaceId,
    openProjectIds: sortByProjectOrder(openProjectIds, projectIds),
    recentlyClosedProjectIds: state.recentlyClosedProjectIds.filter(
      (id) => availableIds.has(id) && !openSet.has(id),
    ),
  };
}

export function closeProjectTab(
  state: ProjectTabsState,
  projectId: string,
  activeProjectId: string,
): { state: ProjectTabsState; nextActiveProjectId: string } {
  const closeIndex = state.openProjectIds.indexOf(projectId);
  if (closeIndex < 0 || state.openProjectIds.length <= 1) {
    return { state, nextActiveProjectId: activeProjectId };
  }

  const openProjectIds = state.openProjectIds.filter((id) => id !== projectId);
  const nextActiveProjectId = activeProjectId === projectId
    ? openProjectIds[Math.min(closeIndex, openProjectIds.length - 1)]!
    : activeProjectId;

  return {
    state: {
      ...state,
      openProjectIds,
      recentlyClosedProjectIds: [
        projectId,
        ...state.recentlyClosedProjectIds.filter((id) => id !== projectId),
      ].slice(0, RECENTLY_CLOSED_LIMIT),
    },
    nextActiveProjectId,
  };
}

export function reopenLastProjectTab(
  state: ProjectTabsState,
  projectIds: readonly string[],
): { state: ProjectTabsState; reopenedProjectId: string | null } {
  const availableIds = new Set(projectIds);
  const reopenedProjectId = state.recentlyClosedProjectIds.find(
    (id) => availableIds.has(id) && !state.openProjectIds.includes(id),
  );
  if (reopenedProjectId === undefined) {
    return { state, reopenedProjectId: null };
  }

  return {
    state: {
      ...state,
      openProjectIds: sortByProjectOrder(
        [...state.openProjectIds, reopenedProjectId],
        projectIds,
      ),
      recentlyClosedProjectIds: state.recentlyClosedProjectIds.filter(
        (id) => id !== reopenedProjectId,
      ),
    },
    reopenedProjectId,
  };
}

export function resolveProjectTabNavigation(
  openProjectIds: readonly string[],
  activeProjectId: string,
  key: 'ArrowLeft' | 'ArrowRight' | 'Home' | 'End',
): string {
  if (openProjectIds.length === 0) return activeProjectId;
  if (key === 'Home') return openProjectIds[0]!;
  if (key === 'End') return openProjectIds.at(-1)!;

  const currentIndex = Math.max(0, openProjectIds.indexOf(activeProjectId));
  const offset = key === 'ArrowLeft' ? -1 : 1;
  const nextIndex = (currentIndex + offset + openProjectIds.length) % openProjectIds.length;
  return openProjectIds[nextIndex]!;
}

function sortByProjectOrder(
  ids: readonly string[],
  projectIds: readonly string[],
): string[] {
  const idSet = new Set(ids);
  return projectIds.filter((id) => idSet.has(id));
}
""",
)

write(
    "apps/desktop/test/project-tabs-model.test.ts",
    """import { describe, expect, it } from 'vitest';
import {
  closeProjectTab,
  createProjectTabsState,
  reopenLastProjectTab,
  resolveProjectTabNavigation,
  synchronizeProjectTabsState,
} from '../src/project-tabs-model';

describe('project tabs model', () => {
  it('Workspace切り替え時は全Projectを開く', () => {
    const state = createProjectTabsState('workspace-1', ['p1', 'p2']);
    const next = synchronizeProjectTabsState(state, 'workspace-2', ['p3', 'p4'], 'p3');
    expect(next).toEqual({
      workspaceId: 'workspace-2',
      openProjectIds: ['p3', 'p4'],
      recentlyClosedProjectIds: [],
    });
  });

  it('新規Projectを自動的に開く', () => {
    const state = createProjectTabsState('workspace-1', ['p1']);
    const next = synchronizeProjectTabsState(state, 'workspace-1', ['p1', 'p2'], 'p2');
    expect(next.openProjectIds).toEqual(['p1', 'p2']);
  });

  it('アクティブタブを閉じると右隣、末尾では左隣を選ぶ', () => {
    const state = createProjectTabsState('workspace-1', ['p1', 'p2', 'p3']);
    const middle = closeProjectTab(state, 'p2', 'p2');
    expect(middle.state.openProjectIds).toEqual(['p1', 'p3']);
    expect(middle.nextActiveProjectId).toBe('p3');

    const last = closeProjectTab(state, 'p3', 'p3');
    expect(last.nextActiveProjectId).toBe('p2');
  });

  it('非アクティブタブを閉じても選択を維持する', () => {
    const state = createProjectTabsState('workspace-1', ['p1', 'p2']);
    expect(closeProjectTab(state, 'p2', 'p1').nextActiveProjectId).toBe('p1');
  });

  it('最後の1タブは閉じない', () => {
    const state = createProjectTabsState('workspace-1', ['p1']);
    expect(closeProjectTab(state, 'p1', 'p1')).toEqual({
      state,
      nextActiveProjectId: 'p1',
    });
  });

  it('直近に閉じたタブをLIFOで元のProject順へ復元する', () => {
    let state = createProjectTabsState('workspace-1', ['p1', 'p2', 'p3']);
    state = closeProjectTab(state, 'p2', 'p1').state;
    state = closeProjectTab(state, 'p3', 'p1').state;

    const first = reopenLastProjectTab(state, ['p1', 'p2', 'p3']);
    expect(first.reopenedProjectId).toBe('p3');
    expect(first.state.openProjectIds).toEqual(['p1', 'p3']);

    const second = reopenLastProjectTab(first.state, ['p1', 'p2', 'p3']);
    expect(second.reopenedProjectId).toBe('p2');
    expect(second.state.openProjectIds).toEqual(['p1', 'p2', 'p3']);
  });

  it('左右キーは循環し、HomeとEndで端へ移動する', () => {
    const ids = ['p1', 'p2', 'p3'];
    expect(resolveProjectTabNavigation(ids, 'p1', 'ArrowLeft')).toBe('p3');
    expect(resolveProjectTabNavigation(ids, 'p3', 'ArrowRight')).toBe('p1');
    expect(resolveProjectTabNavigation(ids, 'p2', 'Home')).toBe('p1');
    expect(resolveProjectTabNavigation(ids, 'p2', 'End')).toBe('p3');
  });
});
""",
)

write(
    "apps/desktop/src/ProjectTabs.tsx",
    """import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { Project } from '@live-board/domain';
import {
  closeProjectTab,
  createProjectTabsState,
  reopenLastProjectTab,
  resolveProjectTabNavigation,
  synchronizeProjectTabsState,
} from './project-tabs-model';
import './project-tabs.css';

export interface ProjectTabsProps {
  workspaceId: string;
  projects: readonly Project[];
  activeProjectId: string;
  hasUnsavedChanges: boolean;
  onSelect(projectId: string): void;
  onCreate(): void;
}

export function ProjectTabs({
  workspaceId,
  projects,
  activeProjectId,
  hasUnsavedChanges,
  onSelect,
  onCreate,
}: ProjectTabsProps) {
  const projectIds = useMemo(() => projects.map((project) => project.id), [projects]);
  const projectIdsSignature = projectIds.join('|');
  const [tabs, setTabs] = useState(() => createProjectTabsState(workspaceId, projectIds));
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());

  useEffect(() => {
    setTabs((current) =>
      synchronizeProjectTabsState(current, workspaceId, projectIds, activeProjectId),
    );
  }, [workspaceId, projectIdsSignature, activeProjectId]);

  const openProjects = projects.filter((project) => tabs.openProjectIds.includes(project.id));
  const canReopen = tabs.recentlyClosedProjectIds.length > 0;

  function selectAndFocus(projectId: string): void {
    onSelect(projectId);
    window.requestAnimationFrame(() => tabRefs.current.get(projectId)?.focus());
  }

  function close(projectId: string): void {
    const result = closeProjectTab(tabs, projectId, activeProjectId);
    setTabs(result.state);
    if (result.nextActiveProjectId !== activeProjectId) {
      selectAndFocus(result.nextActiveProjectId);
    }
  }

  function reopen(): void {
    const result = reopenLastProjectTab(tabs, projectIds);
    setTabs(result.state);
    if (result.reopenedProjectId !== null) selectAndFocus(result.reopenedProjectId);
  }

  function navigate(event: KeyboardEvent<HTMLButtonElement>): void {
    if (!isNavigationKey(event.key)) return;
    event.preventDefault();
    selectAndFocus(
      resolveProjectTabNavigation(tabs.openProjectIds, activeProjectId, event.key),
    );
  }

  return (
    <div className="project-tabs-shell">
      <div className="document-tabs" role="tablist" aria-label="プロジェクト">
        {openProjects.map((project) => {
          const active = project.id === activeProjectId;
          return (
            <div className="project-tab-item" key={project.id}>
              <button
                ref={(element) => {
                  if (element === null) tabRefs.current.delete(project.id);
                  else tabRefs.current.set(project.id, element);
                }}
                type="button"
                role="tab"
                className="project-tab-select"
                aria-selected={active}
                tabIndex={active ? 0 : -1}
                data-unsaved={active && hasUnsavedChanges ? 'true' : 'false'}
                onClick={() => onSelect(project.id)}
                onKeyDown={navigate}
              >
                <span>{project.name}</span>
                {active && hasUnsavedChanges ? (
                  <span className="project-tab-dirty" aria-label="未保存の変更あり">●</span>
                ) : null}
              </button>
              <button
                type="button"
                className="project-tab-close"
                aria-label={`${project.name}のタブを閉じる`}
                disabled={tabs.openProjectIds.length <= 1}
                onClick={() => close(project.id)}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
      <div className="project-tab-actions">
        <span className="project-tabs-save-status" role="status">
          {hasUnsavedChanges
            ? 'ワークスペースに未保存の変更あり'
            : 'ワークスペース保存済み'}
        </span>
        <button type="button" onClick={reopen} disabled={!canReopen}>
          閉じたタブを復元
        </button>
        <button type="button" onClick={onCreate} aria-label="プロジェクトを追加">
          ＋
        </button>
      </div>
    </div>
  );
}

function isNavigationKey(
  key: string,
): key is 'ArrowLeft' | 'ArrowRight' | 'Home' | 'End' {
  return key === 'ArrowLeft' || key === 'ArrowRight' || key === 'Home' || key === 'End';
}
""",
)

write(
    "apps/desktop/src/project-tabs.css",
    """.project-tabs-shell {
  display: flex;
  min-width: 0;
  align-items: stretch;
  justify-content: space-between;
  gap: 8px;
  border-bottom: 1px solid #374151;
  background: #182234;
}

.project-tabs-shell .document-tabs {
  min-width: 0;
  overflow-x: auto;
  border-bottom: 0;
  padding-right: 0;
}

.project-tab-item {
  display: flex;
  flex: 0 0 auto;
  align-items: stretch;
  border: 1px solid #4b5563;
  border-bottom: 0;
  border-radius: 8px 8px 0 0;
  background: #111827;
}

.project-tab-item:has(.project-tab-select[aria-selected='true']) {
  border-color: #60a5fa;
  background: #273449;
}

.project-tabs-shell .project-tab-select,
.project-tabs-shell .project-tab-close,
.project-tab-actions button {
  min-height: 36px;
  border: 0;
  border-radius: 0;
  background: transparent;
  padding: 7px 10px;
}

.project-tabs-shell .project-tab-select {
  display: flex;
  max-width: 220px;
  align-items: center;
  gap: 6px;
}

.project-tab-select > span:first-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-tab-dirty {
  color: #fbbf24;
  font-size: 8px;
}

.project-tabs-shell .project-tab-close {
  border-left: 1px solid #374151;
  padding-inline: 8px;
  color: #9ca3af;
}

.project-tabs-shell .project-tab-close:not(:disabled):hover,
.project-tab-actions button:not(:disabled):hover {
  background: #334155;
  color: #fff;
}

.project-tab-actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 6px;
  padding: 4px 8px 0 0;
}

.project-tabs-save-status {
  max-width: 210px;
  color: #9ca3af;
  font-size: 10px;
  white-space: nowrap;
}

.project-tab-actions button {
  border: 1px solid #4b5563;
  border-radius: 7px;
  background: #273449;
  cursor: pointer;
  font-size: 11px;
}

@media (max-width: 900px) {
  .project-tabs-save-status {
    display: none;
  }
}
""",
)

replace_once(
    "apps/desktop/src/AppV2.tsx",
    "  AssetValidationError,\n  DomainError,",
    "  AssetValidationError,\n  DomainError,\n  appendWorkspaceProject,",
)
replace_once(
    "apps/desktop/src/AppV2.tsx",
    "  createPage,\n  createPageRenderSnapshot,\n  createProjectAssetLibrary,",
    "  createPage,\n  createPageRenderSnapshot,\n  createProject,\n  createProjectAssetLibrary,",
)
replace_once(
    "apps/desktop/src/AppV2.tsx",
    "  redoProjectCommandWithCanvasHistory,\n  undoCanvasCommand,",
    "  redoProjectCommandWithCanvasHistory,\n  selectWorkspaceProject,\n  undoCanvasCommand,",
)
replace_once(
    "apps/desktop/src/AppV2.tsx",
    "import { PageThumbnail } from './PageThumbnail';\nimport { RichLayerInspector } from './RichLayerInspector';",
    "import { PageThumbnail } from './PageThumbnail';\nimport { ProjectTabs } from './ProjectTabs';\nimport { RichLayerInspector } from './RichLayerInspector';",
)
replace_once(
    "apps/desktop/src/AppV2.tsx",
    """  function addPage(): void {
    const page = createPage({
      id: createEntityId('page'),
      projectId: project.id,
      name: `ページ ${project.pages.length + 1}`,
    });
    executeCommand(
      createAddPageCommand(
        project.id,
        page,
        createCommandMetadata('page-add'),
      ),
    );
  }
""",
    """  function addPage(): void {
    const page = createPage({
      id: createEntityId('page'),
      projectId: project.id,
      name: `ページ ${project.pages.length + 1}`,
    });
    executeCommand(
      createAddPageCommand(
        project.id,
        page,
        createCommandMetadata('page-add'),
      ),
    );
  }

  function selectProject(projectId: string): void {
    try {
      setCommandState((current) => ({
        ...current,
        workspace: selectWorkspaceProject(current.workspace, projectId),
      }));
      setSelection(null);
      setSelectionMode(null);
      setViewport(DEFAULT_CANVAS_VIEWPORT);
      setAssetError(null);
      setDomainError(null);
    } catch (error: unknown) {
      setDomainError(
        error instanceof DomainError ? error.message : 'Projectの切り替えに失敗しました',
      );
    }
  }

  function createProjectTab(): void {
    const timestamp = new Date().toISOString();
    const projectId = createEntityId('project');
    const page = createPage({
      id: createEntityId('page'),
      projectId,
      name: 'ページ 1',
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    const nextProject = createProject({
      id: projectId,
      workspaceId: workspace.id,
      name: `プロジェクト ${workspace.projects.length + 1}`,
      pages: [page],
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    try {
      setCommandState((current) => ({
        ...current,
        workspace: appendWorkspaceProject(current.workspace, nextProject, timestamp),
      }));
      setSelection(null);
      setSelectionMode(null);
      setViewport(DEFAULT_CANVAS_VIEWPORT);
      setAssetError(null);
      setDomainError(null);
    } catch (error: unknown) {
      setDomainError(
        error instanceof DomainError ? error.message : 'Projectの追加に失敗しました',
      );
    }
  }
""",
)
replace_once(
    "apps/desktop/src/AppV2.tsx",
    """        <div className="document-tabs" role="tablist" aria-label="プロジェクト">
          {workspace.projects.map((candidate) => (
            <button
              key={candidate.id}
              type="button"
              role="tab"
              aria-selected={candidate.id === project.id}
            >
              {candidate.name}
            </button>
          ))}
        </div>
""",
    """        <ProjectTabs
          workspaceId={workspace.id}
          projects={workspace.projects}
          activeProjectId={project.id}
          hasUnsavedChanges={persistence.hasUnsavedChanges}
          onSelect={selectProject}
          onCreate={createProjectTab}
        />
""",
)

write(
    "tests/e2e/project-tabs-desktop.spec.ts",
    """import { expect, test } from '@playwright/test';

test('Projectタブを追加・切り替え・閉じる・復元できる', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('canvas-surface')).toBeVisible();

  const tablist = page.getByRole('tablist', { name: 'プロジェクト' });
  await expect(tablist.getByRole('tab')).toHaveCount(1);
  await page.getByRole('button', { name: 'プロジェクトを追加' }).click();

  await expect(tablist.getByRole('tab')).toHaveCount(2);
  const firstTab = tablist.getByRole('tab', { name: /新しいプロジェクト/ });
  const secondTab = tablist.getByRole('tab', { name: /プロジェクト 2/ });
  await expect(secondTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('ワークスペースに未保存の変更あり')).toBeVisible();

  await firstTab.click();
  await expect(firstTab).toHaveAttribute('aria-selected', 'true');

  await page.getByRole('button', { name: '新しいプロジェクトのタブを閉じる' }).click();
  await expect(tablist.getByRole('tab')).toHaveCount(1);
  await expect(
    page.getByRole('button', { name: 'プロジェクト 2のタブを閉じる' }),
  ).toBeDisabled();

  await page.getByRole('button', { name: '閉じたタブを復元' }).click();
  await expect(tablist.getByRole('tab')).toHaveCount(2);
  await expect(firstTab).toHaveAttribute('aria-selected', 'true');

  await firstTab.focus();
  await firstTab.press('ArrowRight');
  await expect(secondTab).toHaveAttribute('aria-selected', 'true');
});
""",
)

write(
    "docs/project-tabs.md",
    """# Projectタブ設計

## 目的

Workspace内の複数ProjectをEditorで切り替え、作業対象を明確にします。タブを閉じる操作は表示セッションの整理であり、Projectデータの削除ではありません。

## 永続化される状態

`.liveboard`へ保存される正本は既存Workspaceモデルです。

- `projects`
- `activeProjectId`
- 各ProjectのPage・Layer・配信設定
- Project単位のAsset Library

Project追加とProject選択はWorkspaceを変更するため、既存のrevision検知、自動保存、明示保存へ合流します。保存形式とIPCは変更しません。

## Rendererセッションだけの状態

次は同一Rendererプロセス内だけで保持します。

- 開いているProjectタブ
- 直近に閉じたProjectタブ（最大10件）

タブを閉じても`workspace.projects`、Page、Layer、Asset、Undo / Redo履歴を削除しません。Workspaceを開き直すと全Projectをタブとして表示します。

## 操作

- `＋`: 初期Pageを持つProjectを追加して選択
- タブクリック: `activeProjectId`を変更
- `ArrowLeft` / `ArrowRight`: 開いているタブを循環
- `Home` / `End`: 先頭・末尾タブへ移動
- `×`: タブを閉じる。最後の1件は閉じられない
- `閉じたタブを復元`: 直近に閉じたタブをLIFOで復元して選択

## 未保存表示

保存単位はWorkspace全体です。Project単位の保存済み状態は持たないため、タブ領域にはWorkspace全体の未保存状態を表示し、アクティブタブへ同じ状態のマーカーを付けます。

## OBS同期

Project選択で`activeProjectId`が変わると、既存のOBS同期effectが選択Projectの配信Pageを新しいSnapshotとして送信します。Projectごとの`activeBroadcastPageId`と配信ロック状態は維持されます。

## エラー境界

Domain層で次を拒否します。

- 存在しないProjectの選択
- 重複Project IDの追加
- 別Workspaceに属するProjectの追加
- Workspace整合性を壊す更新

## 対象外

- Project本体の削除、名前変更、複製
- タブのピン留め、ドラッグ並び替え
- 閉じたタブ状態の永続化
- 別ウィンドウへの分離
- 複数Workspaceの同時編集
""",
)

replace_once(
    "README.md",
    "M3「保存・復旧・性能・配信操作性」に加え、画像Asset分離配信、Renderer–Main／OBS OverlayのLayer差分転送、Windows向け未署名RCパッケージ生成、起動時のWorkspaceホームまで実装しています。",
    "M3「保存・復旧・性能・配信操作性」に加え、画像Asset分離配信、Renderer–Main／OBS OverlayのLayer差分転送、Windows向け未署名RCパッケージ生成、起動時のWorkspaceホーム、Projectタブ操作まで実装しています。",
)
replace_once(
    "README.md",
    "- 起動直後のWorkspaceホーム、新規作成、最近使用、お気に入り、クラッシュ復元\n- 最近使用、お気に入り、複製、インポート",
    "- 起動直後のWorkspaceホーム、新規作成、最近使用、お気に入り、クラッシュ復元\n- Project追加、タブ切り替え、タブを閉じる、直近タブの復元、Workspace単位の未保存表示\n- 最近使用、お気に入り、複製、インポート",
)
replace_once(
    "README.md",
    """ホーム表示中は配信ショートカットとRendererからMainへのOBS同期を停止し、Editorへ戻った時点で最新状態を再同期します。詳細は[ワークスペースホーム設計](docs/workspace-home.md)を参照してください。

### Windows配布パッケージ
""",
    """ホーム表示中は配信ショートカットとRendererからMainへのOBS同期を停止し、Editorへ戻った時点で最新状態を再同期します。詳細は[ワークスペースホーム設計](docs/workspace-home.md)を参照してください。

### Projectタブ

Workspace内のProjectはEditor上部のタブで切り替えます。

- 初期Page付きProjectを追加
- クリック、左右キー、Home / Endで切り替え
- タブを閉じてもProject本体・Page・Layer・Asset・履歴は削除しない
- 直近に閉じたタブを同一セッション内で復元
- 保存単位に合わせてWorkspace全体の未保存状態を表示
- Project切り替え後は選択Projectの配信PageをOBSへ再同期

詳細は[Projectタブ設計](docs/project-tabs.md)を参照してください。

### Windows配布パッケージ
""",
)

Path('.github/workflows/apply-project-tabs.yml').unlink(missing_ok=True)
Path('.github/scripts/apply-project-tabs.py').unlink(missing_ok=True)
