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
import type { UserPageTemplate } from './user-page-templates';
import './page-template-dialog.css';

interface PageTemplateDialogProps {
  open: boolean;
  currentPageName: string;
  canSaveCurrentPage: boolean;
  saveDisabledReason: string | null;
  userTemplates: readonly UserPageTemplate[];
  userTemplateMessage: string | null;
  onRequestClose(): void;
  onCreate(templateId: BuiltInPageTemplateId): void;
  onCreateUserTemplate(templateId: string): void;
  onSaveCurrentPage(name: string): void;
  onDeleteUserTemplate(templateId: string): void;
}

export function PageTemplateDialog({
  open,
  currentPageName,
  canSaveCurrentPage,
  saveDisabledReason,
  userTemplates,
  userTemplateMessage,
  onRequestClose,
  onCreate,
  onCreateUserTemplate,
  onSaveCurrentPage,
  onDeleteUserTemplate,
}: PageTemplateDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const firstTemplateRef = useRef<HTMLButtonElement>(null);
  const [templateName, setTemplateName] = useState(currentPageName);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;

    if (open) {
      setTemplateName(currentPageName);
      if (!dialog.open) dialog.showModal();
      window.requestAnimationFrame(() => firstTemplateRef.current?.focus());
      return;
    }

    if (dialog.open) dialog.close();
  }, [currentPageName, open]);

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>): void {
    if (event.target === event.currentTarget) onRequestClose();
  }

  function handleSave(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!canSaveCurrentPage) return;
    onSaveCurrentPage(templateName);
  }

  return (
    <dialog
      ref={dialogRef}
      className="page-template-dialog"
      aria-labelledby="page-template-dialog-title"
      aria-describedby="page-template-dialog-description"
      onCancel={(event) => {
        event.preventDefault();
        onRequestClose();
      }}
      onClick={handleBackdropClick}
    >
      <div className="page-template-dialog-panel">
        <header className="page-template-dialog-header">
          <div>
            <p className="page-template-dialog-eyebrow">Scene library</p>
            <h2 id="page-template-dialog-title">Pageテンプレート</h2>
            <p id="page-template-dialog-description">
              ビルトインシーンの利用と、現在のPageをマイテンプレートとして再利用できます。
            </p>
          </div>
          <button
            type="button"
            className="page-template-dialog-close"
            onClick={onRequestClose}
          >
            閉じる
          </button>
        </header>

        <form className="page-template-save" onSubmit={handleSave}>
          <div className="page-template-section-heading">
            <div>
              <h3>現在のPageを保存</h3>
              <p>Asset非依存のPageを、Workspaceとは別のローカルテンプレートとして保存します。</p>
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
                onChange={(event) => setTemplateName(event.currentTarget.value)}
              />
            </label>
            <button type="submit" disabled={!canSaveCurrentPage}>
              現在のPageをマイテンプレートに保存
            </button>
          </div>
          {saveDisabledReason !== null ? (
            <p className="page-template-warning">{saveDisabledReason}</p>
          ) : null}
          {userTemplateMessage !== null ? (
            <p className="page-template-status" role="status" aria-live="polite">
              {userTemplateMessage}
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
                onClick={() => onCreate(template.id)}
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
              <p>自分で保存したPageを、別Projectや別Workspaceでも再利用できます。</p>
            </div>
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
                    onClick={() => onCreateUserTemplate(template.id)}
                  >
                    <TemplatePreview preview={template.preview} />
                    <span className="page-template-card-copy">
                      <strong>{template.name}</strong>
                      <span>保存済みPageから新しいPageを作成します。</span>
                      <small>{new Date(template.createdAt).toLocaleString()}</small>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="page-template-delete"
                    aria-label={`${template.name}マイテンプレートを削除`}
                    onClick={() => {
                      if (
                        window.confirm(
                          `マイテンプレート「${template.name}」を削除します。\nこの操作はPage操作のUndo対象ではありません。`,
                        )
                      ) {
                        onDeleteUserTemplate(template.id);
                      }
                    }}
                  >
                    削除
                  </button>
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
