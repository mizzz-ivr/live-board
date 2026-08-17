import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type MouseEvent,
} from 'react';
import {
  BUILT_IN_PAGE_TEMPLATES,
  type BuiltInPageTemplateId,
} from './page-templates';
import {
  createUserPageTemplateExportFile,
  downloadUserPageTemplateExportFile,
} from './user-page-template-export';
import { getBrowserUserPageTemplateAssetPayloadStore } from './user-page-template-asset-payload-store';
import type { UserPageTemplate } from './user-page-templates';
import './page-template-dialog.css';

interface PageTemplateDialogProps {
  open: boolean;
  busy: boolean;
  currentPageName: string;
  canSaveCurrentPage: boolean;
  saveDisabledReason: string | null;
  userTemplates: readonly UserPageTemplate[];
  userTemplateMessage: string | null;
  canRestoreDeleted: boolean;
  onRequestClose(): void;
  onCreate(templateId: BuiltInPageTemplateId): void;
  onCreateUserTemplate(templateId: string): void;
  onSaveCurrentPage(name: string): void;
  onDeleteUserTemplate(templateId: string): void;
  onRestoreDeletedTemplate(): void;
}

export function PageTemplateDialog({
  open,
  busy,
  currentPageName,
  canSaveCurrentPage,
  saveDisabledReason,
  userTemplates,
  userTemplateMessage,
  canRestoreDeleted,
  onRequestClose,
  onCreate,
  onCreateUserTemplate,
  onSaveCurrentPage,
  onDeleteUserTemplate,
  onRestoreDeletedTemplate,
}: PageTemplateDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const firstTemplateRef = useRef<HTMLButtonElement>(null);
  const [templateName, setTemplateName] = useState(currentPageName);
  const [exportingTemplateId, setExportingTemplateId] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const interactionBusy = busy || exportingTemplateId !== null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;

    if (open) {
      setTemplateName(currentPageName);
      setExportMessage(null);
      if (!dialog.open) dialog.showModal();
      window.requestAnimationFrame(() => firstTemplateRef.current?.focus());
      return;
    }

    if (dialog.open) dialog.close();
  }, [currentPageName, open]);

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>): void {
    if (!interactionBusy && event.target === event.currentTarget) onRequestClose();
  }

  function handleSave(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (interactionBusy || !canSaveCurrentPage) return;
    setExportMessage(null);
    onSaveCurrentPage(templateName);
  }

  async function handleExport(template: UserPageTemplate): Promise<void> {
    if (interactionBusy) return;
    setExportingTemplateId(template.id);
    setExportMessage(null);
    try {
      const file = await createUserPageTemplateExportFile({
        template,
        assetPayloadStore: getBrowserUserPageTemplateAssetPayloadStore(),
        exportedAt: new Date().toISOString(),
      });
      downloadUserPageTemplateExportFile(file);
      setExportMessage(`「${template.name}」を書き出しました。`);
    } catch (error: unknown) {
      setExportMessage(
        error instanceof Error
          ? error.message
          : 'マイテンプレートの書き出しに失敗しました。',
      );
    } finally {
      setExportingTemplateId(null);
    }
  }

  const statusMessage = exportMessage ?? userTemplateMessage;

  return (
    <dialog
      ref={dialogRef}
      className="page-template-dialog"
      aria-labelledby="page-template-dialog-title"
      aria-describedby="page-template-dialog-description"
      aria-busy={interactionBusy}
      onCancel={(event) => {
        event.preventDefault();
        if (!interactionBusy) onRequestClose();
      }}
      onClick={handleBackdropClick}
    >
      <div className="page-template-dialog-panel">
        <header className="page-template-dialog-header">
          <div>
            <p className="page-template-dialog-eyebrow">Scene library</p>
            <h2 id="page-template-dialog-title">Pageテンプレート</h2>
            <p id="page-template-dialog-description">
              ビルトインシーンの利用と、現在のPageをマイテンプレートとして保存・再利用できます。
            </p>
          </div>
          <button
            type="button"
            className="page-template-dialog-close"
            disabled={interactionBusy}
            onClick={onRequestClose}
          >
            閉じる
          </button>
        </header>

        <form className="page-template-save" onSubmit={handleSave}>
          <div className="page-template-section-heading">
            <div>
              <h3>現在のPageを保存</h3>
              <p>Pageと参照画像Assetを、Workspaceとは別のローカルテンプレートとして保存します。</p>
            </div>
            <span>{userTemplates.length} / 50</span>
          </div>
          <div className="page-template-save-controls">
            <label>
              <span>マイテンプレート名</span>
              <input
                type="text"
                value={templateName}
                maxLength={80}
                disabled={interactionBusy}
                onChange={(event) => setTemplateName(event.currentTarget.value)}
              />
            </label>
            <button type="submit" disabled={interactionBusy || !canSaveCurrentPage}>
              現在のPageをマイテンプレートに保存
            </button>
          </div>
          {saveDisabledReason !== null ? (
            <p className="page-template-warning">{saveDisabledReason}</p>
          ) : null}
          {interactionBusy ? (
            <p className="page-template-status" role="status" aria-live="polite">
              テンプレートを処理しています。完了するまでこの画面を閉じられません。
            </p>
          ) : statusMessage !== null ? (
            <p className="page-template-status" role="status" aria-live="polite">
              {statusMessage}
            </p>
          ) : null}
        </form>

        <section aria-labelledby="built-in-template-heading">
          <div className="page-template-section-heading">
            <div>
              <h3 id="built-in-template-heading">ビルトイン</h3>
              <p>配信ですぐ使える5種類のシーンです。</p>
            </div>
          </div>
          <div className="page-template-grid">
            {BUILT_IN_PAGE_TEMPLATES.map((template, index) => (
              <button
                ref={index === 0 ? firstTemplateRef : undefined}
                key={template.id}
                type="button"
                className="page-template-card"
                aria-label={`${template.name}テンプレートでPageを作成`}
                disabled={interactionBusy}
                onClick={() => {
                  setExportMessage(null);
                  onCreate(template.id);
                }}
              >
                <TemplatePreview preview={template.preview} />
                <span className="page-template-card-copy">
                  <strong>{template.name}</strong>
                  <span>{template.description}</span>
                  <small>{template.tags.join(' · ')}</small>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section aria-labelledby="user-template-heading">
          <div className="page-template-section-heading">
            <div>
              <h3 id="user-template-heading">マイテンプレート</h3>
              <p>自分で保存したPageを、別Projectや別Workspaceでも再利用・書き出しできます。</p>
            </div>
            <button
              type="button"
              disabled={interactionBusy || !canRestoreDeleted}
              onClick={() => {
                setExportMessage(null);
                onRestoreDeletedTemplate();
              }}
            >
              削除を元に戻す
            </button>
          </div>
          {userTemplates.length === 0 ? (
            <p className="page-template-empty">まだマイテンプレートはありません。</p>
          ) : (
            <div className="page-template-grid" aria-label="マイテンプレート一覧">
              {userTemplates.map((template) => (
                <article className="page-template-user-card" key={template.id}>
                  <button
                    type="button"
                    className="page-template-card"
                    aria-label={`${template.name}マイテンプレートでPageを作成`}
                    disabled={interactionBusy}
                    onClick={() => {
                      setExportMessage(null);
                      onCreateUserTemplate(template.id);
                    }}
                  >
                    <TemplatePreview preview={template.preview} />
                    <span className="page-template-card-copy">
                      <strong>{template.name}</strong>
                      <span>保存済みPageから新しいPageを作成します。</span>
                      <small>Asset {template.assets.length}件 · {new Date(template.createdAt).toLocaleString()}</small>
                    </span>
                  </button>
                  <div className="page-template-user-actions">
                    <button
                      type="button"
                      className="page-template-export"
                      aria-label={`${template.name}マイテンプレートを書き出す`}
                      disabled={interactionBusy}
                      onClick={() => void handleExport(template)}
                    >
                      書き出す
                    </button>
                    <button
                      type="button"
                      className="page-template-delete"
                      aria-label={`${template.name}マイテンプレートを削除`}
                      disabled={interactionBusy}
                      onClick={() => {
                        if (
                          window.confirm(
                            `マイテンプレート「${template.name}」を削除します。\n削除後は「削除を元に戻す」から直前の1件を復元できます。`,
                          )
                        ) {
                          setExportMessage(null);
                          onDeleteUserTemplate(template.id);
                        }
                      }}
                    >
                      削除
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <footer className="page-template-dialog-footer">
          <span>テンプレートから作成したPageは通常のPageとして編集・Undo/Redoできます。</span>
          <span><kbd>Esc</kbd> 閉じる</span>
        </footer>
      </div>
    </dialog>
  );
}

function TemplatePreview({
  preview,
}: {
  preview: {
    readonly background: string;
    readonly accent: string;
    readonly foreground: string;
  };
}) {
  return (
    <span
      className="page-template-preview"
      aria-hidden="true"
      style={
        {
          '--page-template-background': preview.background,
          '--page-template-accent': preview.accent,
          '--page-template-foreground': preview.foreground,
        } as CSSProperties
      }
    >
      <span className="page-template-preview-accent" />
      <span className="page-template-preview-title" />
      <span className="page-template-preview-subtitle" />
    </span>
  );
}
