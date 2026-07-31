import type { Project } from '@live-board/domain';
import {
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type DragEvent,
  type KeyboardEvent,
  type SetStateAction,
} from 'react';
import {
  canMoveProjectTab,
  closeProjectTab,
  isProjectTabPinned,
  moveProjectTab,
  moveProjectTabByOffset,
  reopenLastProjectTab,
  resolveProjectTabNavigation,
  toggleProjectTabPin,
  type ProjectTabDropPosition,
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
  onDuplicate(projectId: string): void;
  onDelete(projectId: string): void;
  onRename(projectId: string, name: string): void;
  onUndoProjectOperation(): void;
  onRedoProjectOperation(): void;
}

interface ProjectTabDropTarget {
  projectId: string;
  position: ProjectTabDropPosition;
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
  onDuplicate,
  onDelete,
  onRename,
  onUndoProjectOperation,
  onRedoProjectOperation,
}: ProjectTabsProps) {
  const projectIds = useMemo(() => projects.map((project) => project.id), [projects]);
  const projectsById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects],
  );
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  const draggedProjectIdRef = useRef<string | null>(null);
  const [dropTarget, setDropTarget] = useState<ProjectTabDropTarget | null>(null);
  const openProjects = tabs.openProjectIds.flatMap((projectId) => {
    const project = projectsById.get(projectId);
    return project === undefined ? [] : [project];
  });
  const canReopen = tabs.recentlyClosedTabs.length > 0;

  function selectAndFocus(projectId: string): void {
    onSelect(projectId);
    focusTab(projectId);
  }

  function focusTab(projectId: string): void {
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

  function togglePin(projectId: string): void {
    onTabsChange((current) => toggleProjectTabPin(current, projectId));
    focusTab(projectId);
  }

  function rename(project: Project): void {
    const requestedName = window.prompt(
      'Project名を入力してください（1〜120文字）',
      project.name,
    );
    if (requestedName === null) return;

    const normalizedName = requestedName.trim();
    if (normalizedName.length < 1 || normalizedName.length > 120) {
      window.alert('Project名は1〜120文字で入力してください');
      return;
    }
    onRename(project.id, normalizedName);
  }

  function handleTabKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    projectId: string,
  ): void {
    if (
      (event.ctrlKey || event.metaKey) &&
      event.shiftKey &&
      (event.key === 'ArrowLeft' || event.key === 'ArrowRight')
    ) {
      event.preventDefault();
      onTabsChange((current) =>
        moveProjectTabByOffset(
          current,
          projectId,
          event.key === 'ArrowLeft' ? -1 : 1,
        ),
      );
      focusTab(projectId);
      return;
    }

    if (!isNavigationKey(event.key)) return;
    event.preventDefault();
    selectAndFocus(
      resolveProjectTabNavigation(tabs.openProjectIds, activeProjectId, event.key),
    );
  }

  function handleDragStart(
    event: DragEvent<HTMLButtonElement>,
    projectId: string,
  ): void {
    draggedProjectIdRef.current = projectId;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', projectId);
  }

  function handleDragOver(
    event: DragEvent<HTMLDivElement>,
    targetProjectId: string,
  ): void {
    const draggedProjectId = draggedProjectIdRef.current;
    if (
      draggedProjectId === null ||
      !canMoveProjectTab(tabs, draggedProjectId, targetProjectId)
    ) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const bounds = event.currentTarget.getBoundingClientRect();
    const position = event.clientX < bounds.left + bounds.width / 2
      ? 'before'
      : 'after';
    if (
      dropTarget?.projectId !== targetProjectId ||
      dropTarget.position !== position
    ) {
      setDropTarget({ projectId: targetProjectId, position });
    }
  }

  function handleDrop(
    event: DragEvent<HTMLDivElement>,
    targetProjectId: string,
  ): void {
    const draggedProjectId = draggedProjectIdRef.current;
    if (
      draggedProjectId === null ||
      !canMoveProjectTab(tabs, draggedProjectId, targetProjectId)
    ) {
      clearDragState();
      return;
    }

    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    const position = event.clientX < bounds.left + bounds.width / 2
      ? 'before'
      : 'after';
    onTabsChange((current) =>
      moveProjectTab(current, draggedProjectId, targetProjectId, position),
    );
    clearDragState();
    focusTab(draggedProjectId);
  }

  function clearDragState(): void {
    draggedProjectIdRef.current = null;
    setDropTarget(null);
  }

  return (
    <div className="project-tabs-shell">
      <div className="document-tabs" role="tablist" aria-label="プロジェクト">
        {openProjects.map((project) => {
          const active = project.id === activeProjectId;
          const pinned = isProjectTabPinned(tabs, project.id);
          const dropPosition = dropTarget?.projectId === project.id
            ? dropTarget.position
            : null;
          return (
            <div
              className={`project-tab-item${
                dropPosition === null ? '' : ` is-drop-${dropPosition}`
              }`}
              key={project.id}
              data-pinned={pinned ? 'true' : 'false'}
              onDragOver={(event) => handleDragOver(event, project.id)}
              onDrop={(event) => handleDrop(event, project.id)}
            >
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
                draggable
                title="Ctrl+Shift+左右キーまたはドラッグで並び替え"
                onClick={() => onSelect(project.id)}
                onKeyDown={(event) => handleTabKeyDown(event, project.id)}
                onDragStart={(event) => handleDragStart(event, project.id)}
                onDragEnd={clearDragState}
              >
                {pinned ? (
                  <span className="project-tab-pinned-mark" aria-hidden="true">●</span>
                ) : null}
                <span>{project.name}</span>
                {active && hasUnsavedChanges ? (
                  <span className="project-tab-dirty" aria-label="未保存の変更あり">●</span>
                ) : null}
              </button>
              <button
                type="button"
                className="project-tab-rename"
                aria-label={`${project.name}の名前を変更`}
                onClick={() => rename(project)}
              >
                名前
              </button>
              <button
                type="button"
                className="project-tab-duplicate"
                aria-label={`${project.name}を複製`}
                onClick={() => onDuplicate(project.id)}
              >
                複製
              </button>
              <button
                type="button"
                className="project-tab-delete"
                aria-label={`${project.name}を削除`}
                title={
                  projects.length <= 1
                    ? 'Workspaceには1件以上のProjectが必要です'
                    : 'Project本体を削除'
                }
                disabled={projects.length <= 1}
                onClick={() => onDelete(project.id)}
              >
                削除
              </button>
              <button
                type="button"
                className="project-tab-pin"
                aria-label={`${project.name}のタブを${pinned ? 'ピン留め解除' : 'ピン留め'}`}
                aria-pressed={pinned}
                onClick={() => togglePin(project.id)}
              >
                {pinned ? '解除' : '固定'}
              </button>
              <button
                type="button"
                className="project-tab-close"
                aria-label={`${project.name}のタブを閉じる`}
                title={pinned ? 'ピン留めを解除すると閉じられます' : undefined}
                disabled={tabs.openProjectIds.length <= 1 || pinned}
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
