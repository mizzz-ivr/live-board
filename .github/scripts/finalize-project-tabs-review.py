from pathlib import Path


def write(path: str, content: str) -> None:
    file_path = Path(path)
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text(content, encoding='utf-8')


write(
    'apps/desktop/src/project-tabs-model.ts',
    """const RECENTLY_CLOSED_LIMIT = 10;

export interface ProjectTabsState {
  workspaceId: string;
  sessionRevision: number;
  openProjectIds: string[];
  recentlyClosedProjectIds: string[];
}

export function createProjectTabsState(
  workspaceId: string,
  projectIds: readonly string[],
  sessionRevision = 0,
): ProjectTabsState {
  return {
    workspaceId,
    sessionRevision,
    openProjectIds: [...projectIds],
    recentlyClosedProjectIds: [],
  };
}

export function synchronizeProjectTabsState(
  state: ProjectTabsState,
  workspaceId: string,
  projectIds: readonly string[],
  activeProjectId: string,
  sessionRevision = 0,
): ProjectTabsState {
  if (
    state.workspaceId !== workspaceId ||
    state.sessionRevision !== sessionRevision
  ) {
    return createProjectTabsState(workspaceId, projectIds, sessionRevision);
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
  const nextOpenProjectIds = sortByProjectOrder(openProjectIds, projectIds);
  const nextRecentlyClosedProjectIds = state.recentlyClosedProjectIds.filter(
    (id) => availableIds.has(id) && !openSet.has(id),
  );
  if (
    arraysEqual(state.openProjectIds, nextOpenProjectIds) &&
    arraysEqual(state.recentlyClosedProjectIds, nextRecentlyClosedProjectIds)
  ) {
    return state;
  }

  return {
    workspaceId,
    sessionRevision,
    openProjectIds: nextOpenProjectIds,
    recentlyClosedProjectIds: nextRecentlyClosedProjectIds,
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

function arraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
""",
)

write(
    'apps/desktop/src/ProjectTabs.tsx',
    """import { useMemo, useRef, type Dispatch, type KeyboardEvent, type SetStateAction } from 'react';
import type { Project } from '@live-board/domain';
import {
  closeProjectTab,
  reopenLastProjectTab,
  resolveProjectTabNavigation,
  type ProjectTabsState,
} from './project-tabs-model';
import './project-tabs.css';

export interface ProjectTabsProps {
  tabs: ProjectTabsState;
  projects: readonly Project[];
  activeProjectId: string;
  hasUnsavedChanges: boolean;
  canUndoProjectAdd: boolean;
  canRedoProjectAdd: boolean;
  onTabsChange: Dispatch<SetStateAction<ProjectTabsState>>;
  onSelect(projectId: string): void;
  onCreate(): void;
  onUndoProjectAdd(): void;
  onRedoProjectAdd(): void;
}

export function ProjectTabs({
  tabs,
  projects,
  activeProjectId,
  hasUnsavedChanges,
  canUndoProjectAdd,
  canRedoProjectAdd,
  onTabsChange,
  onSelect,
  onCreate,
  onUndoProjectAdd,
  onRedoProjectAdd,
}: ProjectTabsProps) {
  const projectIds = useMemo(() => projects.map((project) => project.id), [projects]);
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  const openProjects = projects.filter((project) => tabs.openProjectIds.includes(project.id));
  const canReopen = tabs.recentlyClosedProjectIds.length > 0;

  function selectAndFocus(projectId: string): void {
    onSelect(projectId);
    window.requestAnimationFrame(() => tabRefs.current.get(projectId)?.focus());
  }

  function close(projectId: string): void {
    const result = closeProjectTab(tabs, projectId, activeProjectId);
    onTabsChange(result.state);
    if (result.nextActiveProjectId !== activeProjectId) {
      selectAndFocus(result.nextActiveProjectId);
    }
  }

  function reopen(): void {
    const result = reopenLastProjectTab(tabs, projectIds);
    onTabsChange(result.state);
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
        <button
          type="button"
          aria-label="Project追加を元に戻す"
          disabled={!canUndoProjectAdd}
          onClick={onUndoProjectAdd}
        >
          追加を元に戻す
        </button>
        <button
          type="button"
          aria-label="Project追加をやり直す"
          disabled={!canRedoProjectAdd}
          onClick={onRedoProjectAdd}
        >
          追加をやり直す
        </button>
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
    'apps/desktop/test/project-tabs-model.test.ts',
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
      sessionRevision: 0,
      openProjectIds: ['p3', 'p4'],
      recentlyClosedProjectIds: [],
    });
  });

  it('同じWorkspace IDでも読込セッションが変われば全Projectを開き直す', () => {
    const state = closeProjectTab(
      createProjectTabsState('workspace-1', ['p1', 'p2'], 3),
      'p2',
      'p1',
    ).state;
    const next = synchronizeProjectTabsState(
      state,
      'workspace-1',
      ['p1', 'p2'],
      'p1',
      4,
    );
    expect(next).toEqual({
      workspaceId: 'workspace-1',
      sessionRevision: 4,
      openProjectIds: ['p1', 'p2'],
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
    'packages/domain/test/workspace-command-history.test.ts',
    """import { describe, expect, it } from 'vitest';
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
""",
)

write(
    'tests/e2e/project-tabs-desktop.spec.ts',
    """import { expect, test } from '@playwright/test';

test('Projectタブを追加・Undo・切り替え・閉じる・ホーム往復後に復元できる', async ({
  page,
}) => {
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

  await page.getByRole('button', { name: 'Project追加を元に戻す' }).click();
  await expect(tablist.getByRole('tab')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Project追加をやり直す' })).toBeEnabled();
  await page.getByRole('button', { name: 'Project追加をやり直す' }).click();
  await expect(tablist.getByRole('tab')).toHaveCount(2);
  await expect(secondTab).toHaveAttribute('aria-selected', 'true');

  await firstTab.click();
  await expect(firstTab).toHaveAttribute('aria-selected', 'true');

  await page.getByRole('button', { name: '新しいプロジェクトのタブを閉じる' }).click();
  await expect(tablist.getByRole('tab')).toHaveCount(1);
  await expect(
    page.getByRole('button', { name: 'プロジェクト 2のタブを閉じる' }),
  ).toBeDisabled();

  page.once('dialog', async (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'ホーム', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'ワークスペースホーム' }),
  ).toBeVisible();
  await page.getByRole('button', { name: '編集を続ける' }).click();

  await expect(tablist.getByRole('tab')).toHaveCount(1);
  await expect(page.getByRole('button', { name: '閉じたタブを復元' })).toBeEnabled();
  await page.getByRole('button', { name: '閉じたタブを復元' }).click();
  await expect(tablist.getByRole('tab')).toHaveCount(2);
  await expect(firstTab).toHaveAttribute('aria-selected', 'true');

  await firstTab.focus();
  await firstTab.press('ArrowRight');
  await expect(secondTab).toHaveAttribute('aria-selected', 'true');
});
""",
)

Path('.github/workflows/finalize-project-tabs-review.yml').unlink(missing_ok=True)
Path('.github/scripts/finalize-project-tabs-review.py').unlink(missing_ok=True)
