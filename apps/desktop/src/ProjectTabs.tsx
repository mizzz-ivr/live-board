import type { Page, Project } from '@live-board/domain';
import {
  useEffect,
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
  openProjectTab,
  reopenLastProjectTab,
  resolveProjectTabNavigation,
  toggleProjectTabPin,
  type ProjectTabDropPosition,
  type ProjectTabsState,
} from './project-tabs-model';
import { ProjectCommandPalette } from './ProjectCommandPalette';
import {
  createProjectTabCommands,
  type ProjectTabCommand,
} from './project-command-palette-model';
import { ProjectTabShortcutHelpDialog } from './ProjectTabShortcutHelpDialog';
import {
  isEditableProjectTabShortcutTarget,
  resolveProjectTabShortcut,
} from './project-tab-shortcuts';
import './project-tabs.css';

export interface ProjectTabsProps {
  tabs: ProjectTabsState;
  projects: readonly Project[];
  activeProjectId: string;
  hasUnsavedChanges: boolean;
  canUndoProjectOperation: boolean;
  canRedoProjectOperation: boolean;
  canUndoPageOperation: boolean;
  canRedoPageOperation: boolean;
  isExternalModalOpen: boolean;
  onTabsChange: Dispatch<SetStateAction<ProjectTabsState>>;
  onSelect(projectId: string): void;
  onCreate(): void;
  onDuplicate(projectId: string): void;
  onDelete(projectId: string): void;
  onRename(projectId: string, name: string): void;
  onUndoProjectOperation(): void;
  onRedoProjectOperation(): void;
  onSelectPage(pageId: string): void;
  onCreatePage(): void;
  onDuplicatePage(): void;
  onDeletePage(pageId: string): void;
  onRenamePage(pageId: string, name: string): void;
  onMovePage(pageId: string, toIndex: number): void;
  onUndoPageOperation(): void;
  onRedoPageOperation(): void;
  onOpenPageTemplates(returnFocus?: HTMLElement | null): void;
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
  canUndoPageOperation,
  canRedoPageOperation,
  isExternalModalOpen,
  onTabsChange,
  onSelect,
  onCreate,
  onDuplicate,
  onDelete,
  onRename,
  onUndoProjectOperation,
  onRedoProjectOperation,
  onSelectPage,
  onCreatePage,
  onDuplicatePage,
  onDeletePage,
  onRenamePage,
  onMovePage,
  onUndoPageOperation,
  onRedoPageOperation,
  onOpenPageTemplates,
}: ProjectTabsProps) {
  const projectIds = useMemo(() => projects.map((project) => project.id), [projects]);
  const projectsById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects],
  );
  const tabRefs = useRef(new Map<string, HTMLButtonElement>());
  const draggedProjectIdRef = useRef<string | null>(null);
  const [dropTarget, setDropTarget] = useState<ProjectTabDropTarget | null>(null);
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);
  const shortcutHelpButtonRef = useRef<HTMLButtonElement>(null);
  const shortcutHelpReturnFocusRef = useRef<HTMLElement | null>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const commandPaletteButtonRef = useRef<HTMLButtonElement>(null);
  const commandPaletteReturnFocusRef = useRef<HTMLElement | null>(null);
  const openProjects = tabs.openProjectIds.flatMap((projectId) => {
    const project = projectsById.get(projectId);
    return project === undefined ? [] : [project];
  });
  const canReopen =
    tabs.recentlyClosedTabs.length > 0 || tabs.closedProjectIds.length > 0;
  const commandPaletteCommands = useMemo(
    () =>
      createProjectTabCommands({
        projects,
        activeProjectId,
        tabs,
        canUndoProjectOperation,
        canRedoProjectOperation,
        canUndoPageOperation,
        canRedoPageOperation,
      }),
    [
      activeProjectId,
      canRedoPageOperation,
      canRedoProjectOperation,
      canUndoPageOperation,
      canUndoProjectOperation,
      projects,
      tabs,
    ],
  );

  function openCommandPalette(): void {
    const activeElement = document.activeElement;
    commandPaletteReturnFocusRef.current =
      activeElement instanceof HTMLElement
      && activeElement !== document.body
      && activeElement !== document.documentElement
        ? activeElement
        : commandPaletteButtonRef.current;
    setShortcutHelpOpen(false);
    setCommandPaletteOpen(true);
  }

  function closeCommandPalette(): void {
    setCommandPaletteOpen(false);
    const returnFocus = commandPaletteReturnFocusRef.current;
    window.requestAnimationFrame(() => {
      if (returnFocus?.isConnected) returnFocus.focus();
      else commandPaletteButtonRef.current?.focus();
    });
  }

  function openShortcutHelp(): void {
    const activeElement = document.activeElement;
    shortcutHelpReturnFocusRef.current =
      activeElement instanceof HTMLElement &&
      activeElement !== document.body &&
      activeElement !== document.documentElement
        ? activeElement
        : shortcutHelpButtonRef.current;
    setCommandPaletteOpen(false);
    setShortcutHelpOpen(true);
  }

  function closeShortcutHelp(): void {
    setShortcutHelpOpen(false);
    const returnFocus = shortcutHelpReturnFocusRef.current;
    window.requestAnimationFrame(() => {
      if (returnFocus?.isConnected) returnFocus.focus();
      else shortcutHelpButtonRef.current?.focus();
    });
  }

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

  function renamePage(page: Page): void {
    const requestedName = window.prompt(
      'Page名を入力してください（1〜120文字）',
      page.name,
    );
    if (requestedName === null) return;

    const normalizedName = requestedName.trim();
    if (normalizedName.length < 1 || normalizedName.length > 120) {
      window.alert('Page名は1〜120文字で入力してください');
      return;
    }
    onRenamePage(page.id, normalizedName);
  }

  function executeCommandPaletteCommand(command: ProjectTabCommand): void {
    if (command.disabled) return;

    setCommandPaletteOpen(false);
    const returnFocus = commandPaletteReturnFocusRef.current;
    window.requestAnimationFrame(() => {
      if (returnFocus?.isConnected) returnFocus.focus();
      else commandPaletteButtonRef.current?.focus();

      switch (command.kind) {
        case 'select-project': {
          const projectId = command.projectId;
          if (projectId === undefined) return;
          onTabsChange((current) => openProjectTab(current, projectId));
          onSelect(projectId);
          focusTab(projectId);
          return;
        }
        case 'create-project':
          onCreate();
          return;
        case 'duplicate-active':
          onDuplicate(activeProjectId);
          return;
        case 'rename-active': {
          const activeProject = projectsById.get(activeProjectId);
          if (activeProject !== undefined) rename(activeProject);
          return;
        }
        case 'delete-active':
          onDelete(activeProjectId);
          return;
        case 'toggle-pin-active':
          togglePin(activeProjectId);
          return;
        case 'close-active':
          close(activeProjectId);
          return;
        case 'reopen-last':
          reopen();
          return;
        case 'undo-project-operation':
          onUndoProjectOperation();
          return;
        case 'redo-project-operation':
          onRedoProjectOperation();
          return;
        case 'select-page':
          if (command.pageId !== undefined) onSelectPage(command.pageId);
          return;
        case 'create-page':
          onCreatePage();
          return;
        case 'show-page-templates':
          onOpenPageTemplates(commandPaletteButtonRef.current);
          return;
        case 'duplicate-page':
          onDuplicatePage();
          return;
        case 'rename-page': {
          const activeProject = projectsById.get(activeProjectId);
          const page = activeProject?.pages.find(
            (candidate) => candidate.id === command.pageId,
          );
          if (page !== undefined) renamePage(page);
          return;
        }
        case 'delete-page': {
          const activeProject = projectsById.get(activeProjectId);
          const page = activeProject?.pages.find(
            (candidate) => candidate.id === command.pageId,
          );
          if (
            page !== undefined
            && window.confirm(
              `「${page.name}」を削除します。\nこの操作はPage操作のUndoで元に戻せます。`,
            )
          ) {
            onDeletePage(page.id);
          }
          return;
        }
        case 'move-page-up':
        case 'move-page-down':
          if (command.pageId !== undefined && command.toIndex !== undefined) {
            onMovePage(command.pageId, command.toIndex);
          }
          return;
        case 'undo-page-operation':
          onUndoPageOperation();
          return;
        case 'redo-page-operation':
          onRedoPageOperation();
          return;
        case 'show-shortcut-help':
          shortcutHelpReturnFocusRef.current = commandPaletteButtonRef.current;
          setShortcutHelpOpen(true);
      }
    });
  }

  useEffect(() => {
    function handleWindowKeyDown(event: globalThis.KeyboardEvent): void {
      const action = resolveProjectTabShortcut({
        key: event.key,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        repeat: event.repeat,
        isComposing: event.isComposing,
        defaultPrevented: event.defaultPrevented,
        editableTarget: isEditableProjectTabShortcutTarget(event.target),
      });
      if (action === null) return;

      event.preventDefault();
      event.stopPropagation();

      if (isExternalModalOpen) return;

      if (action === 'show-command-palette') {
        if (commandPaletteOpen) closeCommandPalette();
        else openCommandPalette();
        return;
      }

      if (commandPaletteOpen) return;

      if (action === 'show-help') {
        if (shortcutHelpOpen) closeShortcutHelp();
        else openShortcutHelp();
        return;
      }

      if (shortcutHelpOpen) return;

      if (action === 'close-active') {
        const result = closeProjectTab(tabs, activeProjectId, activeProjectId);
        onTabsChange(result.state);
        if (result.nextActiveProjectId !== activeProjectId) {
          onSelect(result.nextActiveProjectId);
          focusTab(result.nextActiveProjectId);
        }
        return;
      }

      if (action === 'reopen-last') {
        const result = reopenLastProjectTab(tabs, projectIds);
        onTabsChange(result.state);
        if (result.reopenedProjectId !== null) {
          onSelect(result.reopenedProjectId);
          focusTab(result.reopenedProjectId);
        }
        return;
      }

      const activeProject = projectsById.get(activeProjectId);
      if (activeProject !== undefined) rename(activeProject);
    }

    window.addEventListener('keydown', handleWindowKeyDown, true);
    return () => window.removeEventListener('keydown', handleWindowKeyDown, true);
  }, [
    activeProjectId,
    commandPaletteOpen,
    isExternalModalOpen,
    onRename,
    onSelect,
    onTabsChange,
    projectIds,
    projectsById,
    shortcutHelpOpen,
    tabs,
  ]);

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
                title="F2"
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
                title={
                  pinned
                    ? 'ピン留めを解除すると閉じられます（Ctrl/Cmd+W）'
                    : 'Ctrl/Cmd+W'
                }
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
        <button
          type="button"
          title="Ctrl/Cmd+Shift+T"
          onClick={reopen}
          disabled={!canReopen}
        >
          閉じたタブを復元
        </button>
        <button
          ref={commandPaletteButtonRef}
          type="button"
          aria-label="コマンドパレットを表示"
          title="Ctrl/Cmd+K"
          onClick={openCommandPalette}
        >
          コマンド
        </button>
        <button
          ref={shortcutHelpButtonRef}
          type="button"
          aria-label="キーボードショートカットを表示"
          title="?"
          onClick={openShortcutHelp}
        >
          ?
        </button>
        <button type="button" onClick={onCreate} aria-label="プロジェクトを追加">
          ＋
        </button>
      </div>
      <ProjectCommandPalette
        open={commandPaletteOpen}
        commands={commandPaletteCommands}
        onRequestClose={closeCommandPalette}
        onExecute={executeCommandPaletteCommand}
      />
      <ProjectTabShortcutHelpDialog
        open={shortcutHelpOpen}
        onRequestClose={closeShortcutHelp}
      />
    </div>
  );
}

function isNavigationKey(
  key: string,
): key is 'ArrowLeft' | 'ArrowRight' | 'Home' | 'End' {
  return key === 'ArrowLeft' || key === 'ArrowRight' || key === 'Home' || key === 'End';
}
