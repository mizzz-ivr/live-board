import { useMemo, useRef, type Dispatch, type KeyboardEvent, type SetStateAction } from 'react';
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
  canUndoProjectOperation: boolean;
  canRedoProjectOperation: boolean;
  onTabsChange: Dispatch<SetStateAction<ProjectTabsState>>;
  onSelect(projectId: string): void;
  onCreate(): void;
  onUndoProjectOperation(): void;
  onRedoProjectOperation(): void;
}

export function ProjectTabs({
  tabs,
  projects,
  activeProjectId,
  hasUnsavedChanges,
  canUndoProjectOperation,
  canRedoProjectOperation,
  onTabsChange,
  onSelect,
  onCreate,
  onUndoProjectOperation,
  onRedoProjectOperation,
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
          aria-label="Project操作を元に戻す"
          disabled={!canUndoProjectOperation}
          onClick={onUndoProjectOperation}
        >
          操作を元に戻す
        </button>
        <button
          type="button"
          aria-label="Project操作をやり直す"
          disabled={!canRedoProjectOperation}
          onClick={onRedoProjectOperation}
        >
          操作をやり直す
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
