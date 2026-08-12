from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    if old not in text:
        raise RuntimeError(f"expected text not found in {path}: {old[:120]!r}")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")


app = "apps/desktop/src/AppV2.tsx"
replace_once(
    app,
    "import { PageThumbnail } from './PageThumbnail';\nimport { ProjectTabs } from './ProjectTabs';",
    """import { PageTemplateDialog } from './PageTemplateDialog';
import { PageThumbnail } from './PageThumbnail';
import {
  createPageFromTemplate,
  type BuiltInPageTemplateId,
} from './page-templates';
import { ProjectTabs } from './ProjectTabs';""",
)
replace_once(
    app,
    """  const [renderMetrics, setRenderMetrics] = useState<RenderMetrics | null>(null);
  const nextBroadcastRevisionRef = useRef(1);""",
    """  const [renderMetrics, setRenderMetrics] = useState<RenderMetrics | null>(null);
  const [pageTemplateDialogOpen, setPageTemplateDialogOpen] = useState(false);
  const pageTemplateReturnFocusRef = useRef<HTMLElement | null>(null);
  const nextBroadcastRevisionRef = useRef(1);""",
)
replace_once(
    app,
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

  function selectProject(projectId: string): void {""",
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

  function openPageTemplateDialog(returnFocus?: HTMLElement | null): void {
    const activeElement = document.activeElement;
    pageTemplateReturnFocusRef.current =
      returnFocus
      ?? (activeElement instanceof HTMLElement
        && activeElement !== document.body
        && activeElement !== document.documentElement
        ? activeElement
        : null);
    setPageTemplateDialogOpen(true);
  }

  function closePageTemplateDialog(): void {
    setPageTemplateDialogOpen(false);
    const returnFocus = pageTemplateReturnFocusRef.current;
    window.requestAnimationFrame(() => {
      if (returnFocus?.isConnected) returnFocus.focus();
    });
  }

  function addPageFromTemplate(templateId: BuiltInPageTemplateId): void {
    try {
      const createdAt = new Date().toISOString();
      const page = createPageFromTemplate({
        templateId,
        projectId: project.id,
        pageId: createEntityId('page'),
        createdAt,
        createLayerId: () => createEntityId('layer-template'),
      });
      setCommandState((current) =>
        dispatchProjectCommandWithCanvasHistory(
          current,
          createAddPageCommand(
            project.id,
            page,
            createCommandMetadata('page-template-add'),
          ),
        ),
      );
      setSelection(null);
      setSelectionMode(null);
      setViewport(DEFAULT_CANVAS_VIEWPORT);
      setDomainError(null);
      closePageTemplateDialog();
    } catch (error: unknown) {
      setDomainError(
        error instanceof Error ? error.message : 'Pageテンプレートの作成に失敗しました',
      );
    }
  }

  function selectProject(projectId: string): void {""",
)
replace_once(
    app,
    """          canUndoPageOperation={canUndoProject(commandState, project.id)}
          canRedoPageOperation={canRedoProject(commandState, project.id)}
          onTabsChange={setProjectTabsState}""",
    """          canUndoPageOperation={canUndoProject(commandState, project.id)}
          canRedoPageOperation={canRedoProject(commandState, project.id)}
          isExternalModalOpen={pageTemplateDialogOpen}
          onTabsChange={setProjectTabsState}""",
)
replace_once(
    app,
    """          onRedoPageOperation={() => {
            setCommandState((current) =>
              redoProjectCommandWithCanvasHistory(current, project.id),
            );
            setDomainError(null);
          }}
        />""",
    """          onRedoPageOperation={() => {
            setCommandState((current) =>
              redoProjectCommandWithCanvasHistory(current, project.id),
            );
            setDomainError(null);
          }}
          onOpenPageTemplates={openPageTemplateDialog}
        />""",
)
replace_once(
    app,
    """          addPage={addPage}
          duplicateEditPage={duplicateEditPage}
          executeCommand={executeCommand}""",
    """          addPage={addPage}
          duplicateEditPage={duplicateEditPage}
          openPageTemplates={openPageTemplateDialog}
          executeCommand={executeCommand}""",
)
replace_once(
    app,
    """      </aside>
    </div>
  );
}

interface PagePanelProps {""",
    """      </aside>

      <PageTemplateDialog
        open={pageTemplateDialogOpen}
        onRequestClose={closePageTemplateDialog}
        onCreate={addPageFromTemplate}
      />
    </div>
  );
}

interface PagePanelProps {""",
)
replace_once(
    app,
    """  addPage(): void;
  duplicateEditPage(): void;
  executeCommand(command: ProjectCommand): void;""",
    """  addPage(): void;
  duplicateEditPage(): void;
  openPageTemplates(returnFocus?: HTMLElement | null): void;
  executeCommand(command: ProjectCommand): void;""",
)
replace_once(
    app,
    """  addPage,
  duplicateEditPage,
  executeCommand,""",
    """  addPage,
  duplicateEditPage,
  openPageTemplates,
  executeCommand,""",
)
replace_once(
    app,
    """      <div className="panel-heading">
        <h2>ページ</h2>
        <button type="button" aria-label="ページを追加" onClick={addPage}>＋</button>
      </div>""",
    """      <div className="panel-heading">
        <h2>ページ</h2>
        <button
          type="button"
          aria-label="テンプレートからページを追加"
          onClick={(event) => openPageTemplates(event.currentTarget)}
        >
          テンプレート
        </button>
        <button type="button" aria-label="ページを追加" onClick={addPage}>＋</button>
      </div>""",
)


tabs = "apps/desktop/src/ProjectTabs.tsx"
replace_once(
    tabs,
    """  canUndoPageOperation: boolean;
  canRedoPageOperation: boolean;
  onTabsChange: Dispatch<SetStateAction<ProjectTabsState>>;""",
    """  canUndoPageOperation: boolean;
  canRedoPageOperation: boolean;
  isExternalModalOpen: boolean;
  onTabsChange: Dispatch<SetStateAction<ProjectTabsState>>;""",
)
replace_once(
    tabs,
    """  onUndoPageOperation(): void;
  onRedoPageOperation(): void;
}""",
    """  onUndoPageOperation(): void;
  onRedoPageOperation(): void;
  onOpenPageTemplates(returnFocus?: HTMLElement | null): void;
}""",
)
replace_once(
    tabs,
    """  canUndoPageOperation,
  canRedoPageOperation,
  onTabsChange,""",
    """  canUndoPageOperation,
  canRedoPageOperation,
  isExternalModalOpen,
  onTabsChange,""",
)
replace_once(
    tabs,
    """  onUndoPageOperation,
  onRedoPageOperation,
}: ProjectTabsProps) {""",
    """  onUndoPageOperation,
  onRedoPageOperation,
  onOpenPageTemplates,
}: ProjectTabsProps) {""",
)
replace_once(
    tabs,
    """        case 'create-page':
          onCreatePage();
          return;
        case 'duplicate-page':""",
    """        case 'create-page':
          onCreatePage();
          return;
        case 'show-page-templates':
          onOpenPageTemplates(commandPaletteButtonRef.current);
          return;
        case 'duplicate-page':""",
)
replace_once(
    tabs,
    """      event.preventDefault();
      event.stopPropagation();

      if (action === 'show-command-palette') {""",
    """      event.preventDefault();
      event.stopPropagation();

      if (isExternalModalOpen) return;

      if (action === 'show-command-palette') {""",
)
replace_once(
    tabs,
    """    activeProjectId,
    commandPaletteOpen,
    onRename,""",
    """    activeProjectId,
    commandPaletteOpen,
    isExternalModalOpen,
    onRename,""",
)


model = "apps/desktop/src/project-command-palette-model.ts"
replace_once(
    model,
    """  | 'select-page'
  | 'create-page'
  | 'duplicate-page'""",
    """  | 'select-page'
  | 'create-page'
  | 'show-page-templates'
  | 'duplicate-page'""",
)
replace_once(
    model,
    """    {
      id: 'create-page',
      kind: 'create-page',
      group: 'Page操作',
      label: '新しいPageを作成',
      description: `${activeName}へ空のPageを追加して編集対象にします。`,
      keywords: ['page', 'ページ', '新規', '作成', '追加', activeName],
      disabled: activeProject === undefined,
    },
    {
      id: 'duplicate-page',""",
    """    {
      id: 'create-page',
      kind: 'create-page',
      group: 'Page操作',
      label: '新しいPageを作成',
      description: `${activeName}へ空のPageを追加して編集対象にします。`,
      keywords: ['page', 'ページ', '新規', '作成', '追加', activeName],
      disabled: activeProject === undefined,
    },
    {
      id: 'show-page-templates',
      kind: 'show-page-templates',
      group: 'Page操作',
      label: 'テンプレートからPageを作成',
      description: 'オープニング・待機・雑談・休憩・エンディングから選択します。',
      keywords: [
        'page',
        'ページ',
        'template',
        'テンプレート',
        'scene',
        'シーン',
        'preset',
        'プリセット',
      ],
      disabled: activeProject === undefined,
    },
    {
      id: 'duplicate-page',""",
)


test = "apps/desktop/test/project-command-palette.test.ts"
replace_once(
    test,
    """    expect(
      filterProjectTabCommands(commands, 'page 待機').map((command) => command.id),
    ).toContain('select-page:page-2');
  });""",
    """    expect(
      filterProjectTabCommands(commands, 'page 待機').map((command) => command.id),
    ).toContain('select-page:page-2');
    expect(
      filterProjectTabCommands(commands, 'template').map((command) => command.id),
    ).toEqual(['show-page-templates']);
  });""",
)


dialog = "apps/desktop/src/PageTemplateDialog.tsx"
replace_once(
    dialog,
    '''        <div className="page-template-grid" role="list" aria-label="Pageテンプレート一覧">''',
    '''        <section className="page-template-grid" aria-label="Pageテンプレート一覧">''',
)
replace_once(
    dialog,
    '''              type="button"
              role="listitem"
              className="page-template-card"''',
    '''              type="button"
              className="page-template-card"''',
)
replace_once(
    dialog,
    '''          ))}
        </div>

        <footer className="page-template-dialog-footer">''',
    '''          ))}
        </section>

        <footer className="page-template-dialog-footer">''',
)
