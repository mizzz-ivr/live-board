from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one match, got {count}")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")


app = "apps/desktop/src/AppV2.tsx"
replace_once(
    app,
    """import {
  createPageFromTemplate,
  type BuiltInPageTemplateId,
} from './page-templates';
import { ProjectTabs } from './ProjectTabs';""",
    """import {
  createPageFromTemplate,
  type BuiltInPageTemplateId,
} from './page-templates';
import {
  getUserPageTemplateSaveEligibility,
  instantiateUserPageTemplate,
} from './user-page-templates';
import { ProjectTabs } from './ProjectTabs';""",
)
replace_once(
    app,
    """import { useBroadcastControls } from './useBroadcastControls';
import { useWorkspacePersistence } from './useWorkspacePersistence';""",
    """import { useBroadcastControls } from './useBroadcastControls';
import { useUserPageTemplates } from './useUserPageTemplates';
import { useWorkspacePersistence } from './useWorkspacePersistence';""",
)
replace_once(
    app,
    """  const persistence = useWorkspacePersistence({
    commandState,
    assetLibraries,
    projectTabsState,
    setCommandState,
    setAssetLibraries,
    setProjectTabsState,
  });

  const workspace = commandState.workspace;""",
    """  const persistence = useWorkspacePersistence({
    commandState,
    assetLibraries,
    projectTabsState,
    setCommandState,
    setAssetLibraries,
    setProjectTabsState,
  });
  const userPageTemplates = useUserPageTemplates();

  const workspace = commandState.workspace;""",
)
replace_once(
    app,
    """  const editPage =
    project.pages.find((candidate) => candidate.id === project.activeEditPageId) ??
    project.pages[0]!;
  const broadcastPage =""",
    """  const editPage =
    project.pages.find((candidate) => candidate.id === project.activeEditPageId) ??
    project.pages[0]!;
  const userTemplateEligibility = getUserPageTemplateSaveEligibility(editPage);
  const userTemplateSaveDisabledReason = !userPageTemplates.enabled
    ? userPageTemplates.message ?? 'マイテンプレート保存領域を利用できません。'
    : userTemplateEligibility.reason;
  const broadcastPage =""",
)
replace_once(
    app,
    """  function selectProject(projectId: string): void {""",
    """  function addPageFromUserTemplate(templateId: string): void {
    const template = userPageTemplates.templates.find(
      (candidate) => candidate.id === templateId,
    );
    if (template === undefined) {
      setDomainError('マイテンプレートが見つかりません。');
      return;
    }

    try {
      const createdAt = new Date().toISOString();
      const page = instantiateUserPageTemplate({
        template,
        projectId: project.id,
        pageId: createEntityId('page'),
        createdAt,
        createLayerId: () => createEntityId('layer-user-template'),
      });
      setCommandState((current) =>
        dispatchProjectCommandWithCanvasHistory(
          current,
          createAddPageCommand(
            project.id,
            page,
            createCommandMetadata('page-user-template-add'),
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
        error instanceof Error
          ? error.message
          : 'マイテンプレートからPageを作成できませんでした。',
      );
    }
  }

  function saveEditPageAsUserTemplate(name: string): void {
    if (userPageTemplates.savePage(editPage, name)) setDomainError(null);
  }

  function deleteUserPageTemplate(templateId: string): void {
    if (userPageTemplates.removeTemplate(templateId)) setDomainError(null);
  }

  function selectProject(projectId: string): void {""",
)
replace_once(
    app,
    """      <PageTemplateDialog
        open={pageTemplateDialogOpen}
        onRequestClose={closePageTemplateDialog}
        onCreate={addPageFromTemplate}
      />""",
    """      <PageTemplateDialog
        open={pageTemplateDialogOpen}
        currentPageName={editPage.name}
        canSaveCurrentPage={userPageTemplates.enabled && userTemplateEligibility.allowed}
        saveDisabledReason={userTemplateSaveDisabledReason}
        userTemplates={userPageTemplates.templates}
        userTemplateMessage={userPageTemplates.message}
        onRequestClose={closePageTemplateDialog}
        onCreate={addPageFromTemplate}
        onCreateUserTemplate={addPageFromUserTemplate}
        onSaveCurrentPage={saveEditPageAsUserTemplate}
        onDeleteUserTemplate={deleteUserPageTemplate}
      />""",
)

model = "apps/desktop/src/project-command-palette-model.ts"
replace_once(
    model,
    """      description: 'オープニング・待機・雑談・休憩・エンディングから選択します。',
      keywords: [
        'page',
        'ページ',
        'template',
        'テンプレート',
        'scene',
        'シーン',
        'preset',
        'プリセット',
      ],""",
    """      description: 'ビルトインとマイテンプレートから選択し、現在Pageの保存も行えます。',
      keywords: [
        'page',
        'ページ',
        'template',
        'テンプレート',
        'my template',
        'マイテンプレート',
        '保存',
        '再利用',
        'scene',
        'シーン',
        'preset',
        'プリセット',
      ],""",
)
