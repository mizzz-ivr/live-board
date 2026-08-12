import {
  useEffect,
  useRef,
  type CSSProperties,
  type MouseEvent,
} from 'react';
import {
  BUILT_IN_PAGE_TEMPLATES,
  type BuiltInPageTemplateId,
} from './page-templates';
import './page-template-dialog.css';

interface PageTemplateDialogProps {
  open: boolean;
  onRequestClose(): void;
  onCreate(templateId: BuiltInPageTemplateId): void;
}

export function PageTemplateDialog({
  open,
  onRequestClose,
  onCreate,
}: PageTemplateDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const firstTemplateRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;

    if (open) {
      if (!dialog.open) dialog.showModal();
      window.requestAnimationFrame(() => firstTemplateRef.current?.focus());
      return;
    }

    if (dialog.open) dialog.close();
  }, [open]);

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>): void {
    if (event.target === event.currentTarget) onRequestClose();
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
            <p className="page-template-dialog-eyebrow">Built-in scenes</p>
            <h2 id="page-template-dialog-title">Pageテンプレート</h2>
            <p id="page-template-dialog-description">
              配信でよく使うシーンを、編集可能な背景・図形・テキストLayer付きで作成します。
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

        <div className="page-template-grid" role="list" aria-label="Pageテンプレート一覧">
          {BUILT_IN_PAGE_TEMPLATES.map((template, index) => (
            <button
              ref={index === 0 ? firstTemplateRef : undefined}
              key={template.id}
              type="button"
              role="listitem"
              className="page-template-card"
              aria-label={`${template.name}テンプレートでPageを作成`}
              onClick={() => onCreate(template.id)}
            >
              <span
                className="page-template-preview"
                aria-hidden="true"
                style={
                  {
                    '--page-template-background': template.preview.background,
                    '--page-template-accent': template.preview.accent,
                    '--page-template-foreground': template.preview.foreground,
                  } as CSSProperties
                }
              >
                <span className="page-template-preview-accent" />
                <span className="page-template-preview-title" />
                <span className="page-template-preview-subtitle" />
              </span>
              <span className="page-template-card-copy">
                <strong>{template.name}</strong>
                <span>{template.description}</span>
                <small>{template.tags.join(' · ')}</small>
              </span>
            </button>
          ))}
        </div>

        <footer className="page-template-dialog-footer">
          <span>作成後も通常のPageとして自由に編集できます。</span>
          <span><kbd>Esc</kbd> 閉じる</span>
        </footer>
      </div>
    </dialog>
  );
}
