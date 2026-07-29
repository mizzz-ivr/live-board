import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
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
