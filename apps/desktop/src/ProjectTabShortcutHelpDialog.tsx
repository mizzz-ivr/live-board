import { useEffect, useRef, type MouseEvent } from 'react';
import { PROJECT_TAB_SHORTCUT_GROUPS } from './project-tab-shortcuts';
import './project-tab-shortcut-help.css';

export interface ProjectTabShortcutHelpDialogProps {
  open: boolean;
  onRequestClose(): void;
}

export function ProjectTabShortcutHelpDialog({
  open,
  onRequestClose,
}: ProjectTabShortcutHelpDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;

    if (open) {
      if (!dialog.open) dialog.showModal();
      window.requestAnimationFrame(() => closeButtonRef.current?.focus());
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
      className="project-tab-shortcut-dialog"
      aria-labelledby="project-tab-shortcut-dialog-title"
      aria-describedby="project-tab-shortcut-dialog-description"
      onCancel={(event) => {
        event.preventDefault();
        onRequestClose();
      }}
      onClick={handleBackdropClick}
    >
      <div className="project-tab-shortcut-dialog-panel">
        <header className="project-tab-shortcut-dialog-header">
          <div>
            <p className="project-tab-shortcut-dialog-eyebrow">Keyboard help</p>
            <h2 id="project-tab-shortcut-dialog-title">
              キーボードショートカット
            </h2>
            <p id="project-tab-shortcut-dialog-description">
              Projectタブで利用できる主要なキーボード操作です。
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="project-tab-shortcut-dialog-close"
            aria-label="キーボードショートカット一覧を閉じる"
            onClick={onRequestClose}
          >
            閉じる
          </button>
        </header>

        <div className="project-tab-shortcut-groups">
          {PROJECT_TAB_SHORTCUT_GROUPS.map((group) => (
            <section key={group.id} aria-labelledby={`${group.id}-title`}>
              <h3 id={`${group.id}-title`}>{group.title}</h3>
              <dl className="project-tab-shortcut-list">
                {group.items.map((item) => (
                  <div className="project-tab-shortcut-row" key={item.id}>
                    <div>
                      <dt>{item.label}</dt>
                      <dd>{item.description}</dd>
                    </div>
                    <div
                      className="project-tab-shortcut-keys"
                      aria-label={item.keys.join(' + ')}
                    >
                      {item.keys.map((key, index) => (
                        <span key={`${item.id}-${key}`}>
                          {index > 0 ? (
                            <span className="project-tab-shortcut-plus" aria-hidden="true">
                              +
                            </span>
                          ) : null}
                          <kbd>{key}</kbd>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>

        <p className="project-tab-shortcut-dialog-note">
          入力欄やIME変換中はProjectタブのショートカットを実行しません。
        </p>
      </div>
    </dialog>
  );
}
