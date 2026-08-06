import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import {
  filterProjectTabCommands,
  findFirstEnabledProjectTabCommandIndex,
  moveProjectTabCommandSelection,
  type ProjectTabCommand,
} from './project-command-palette-model';
import './project-command-palette.css';

export interface ProjectCommandPaletteProps {
  open: boolean;
  commands: readonly ProjectTabCommand[];
  onRequestClose(): void;
  onExecute(command: ProjectTabCommand): void;
}

export function ProjectCommandPalette({
  open,
  commands,
  onRequestClose,
  onExecute,
}: ProjectCommandPaletteProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const filteredCommands = useMemo(
    () => filterProjectTabCommands(commands, query),
    [commands, query],
  );
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const selectedCommand = filteredCommands[selectedIndex];

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;

    if (open) {
      setQuery('');
      if (!dialog.open) dialog.showModal();
      window.requestAnimationFrame(() => searchInputRef.current?.focus());
      return;
    }

    if (dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    setSelectedIndex(findFirstEnabledProjectTabCommandIndex(filteredCommands));
  }, [filteredCommands]);

  function executeSelectedCommand(): void {
    if (selectedCommand === undefined || selectedCommand.disabled) return;
    onExecute(selectedCommand);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDialogElement>): void {
    if (event.nativeEvent.isComposing || event.repeat) return;

    const normalizedKey =
      event.key.length === 1 ? event.key.toLowerCase() : event.key;
    const hasSinglePrimaryModifier = event.ctrlKey !== event.metaKey;
    const commandPaletteShortcut =
      hasSinglePrimaryModifier
      && !event.altKey
      && !event.shiftKey
      && normalizedKey === 'k';
    const blockedProjectShortcut =
      (hasSinglePrimaryModifier
        && !event.altKey
        && (
          (!event.shiftKey && normalizedKey === 'w')
          || (event.shiftKey && normalizedKey === 't')
        ))
      || (
        !event.ctrlKey
        && !event.metaKey
        && !event.altKey
        && !event.shiftKey
        && event.key === 'F2'
      );

    if (commandPaletteShortcut) {
      event.preventDefault();
      event.stopPropagation();
      onRequestClose();
      return;
    }

    if (blockedProjectShortcut) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((current) =>
        moveProjectTabCommandSelection(
          filteredCommands,
          current,
          event.key === 'ArrowDown' ? 1 : -1,
        ),
      );
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      executeSelectedCommand();
    }
  }

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>): void {
    if (event.target === event.currentTarget) onRequestClose();
  }

  return (
    <dialog
      ref={dialogRef}
      className="project-command-palette"
      aria-labelledby="project-command-palette-title"
      aria-describedby="project-command-palette-description"
      onCancel={(event) => {
        event.preventDefault();
        onRequestClose();
      }}
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
    >
      <div className="project-command-palette-panel">
        <header className="project-command-palette-header">
          <div>
            <p className="project-command-palette-eyebrow">Command palette</p>
            <h2 id="project-command-palette-title">Projectコマンド</h2>
            <p id="project-command-palette-description">
              Projectの切り替えや主要操作を検索して実行します。
            </p>
          </div>
          <kbd>Ctrl/Cmd + K</kbd>
        </header>

        <label className="project-command-palette-search">
          <span className="sr-only">コマンドを検索</span>
          <input
            ref={searchInputRef}
            type="search"
            role="combobox"
            aria-autocomplete="list"
            aria-controls="project-command-palette-results"
            aria-expanded="true"
            aria-activedescendant={
              selectedCommand === undefined
                ? undefined
                : `project-command-option-${selectedCommand.id}`
            }
            placeholder="Project名または操作を検索"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <div className="project-command-palette-result-summary" role="status">
          {filteredCommands.length}件
        </div>

        {filteredCommands.length === 0 ? (
          <p className="project-command-palette-empty">
            一致するProjectまたはコマンドがありません。
          </p>
        ) : (
          <ul
            id="project-command-palette-results"
            className="project-command-palette-results"
            role="listbox"
            aria-label="コマンド候補"
          >
            {filteredCommands.map((command, index) => (
              <li
                id={`project-command-option-${command.id}`}
                key={command.id}
                role="option"
                aria-selected={index === selectedIndex}
                aria-disabled={command.disabled}
                data-selected={index === selectedIndex ? 'true' : 'false'}
              >
                <button
                  type="button"
                  disabled={command.disabled}
                  onMouseMove={() => {
                    if (!command.disabled) setSelectedIndex(index);
                  }}
                  onClick={() => onExecute(command)}
                >
                  <span className="project-command-palette-command-copy">
                    <strong>{command.label}</strong>
                    <span>{command.description}</span>
                  </span>
                  <span className="project-command-palette-command-group">
                    {command.group}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <footer className="project-command-palette-footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> 選択</span>
          <span><kbd>Enter</kbd> 実行</span>
          <span><kbd>Esc</kbd> 閉じる</span>
        </footer>
      </div>
    </dialog>
  );
}
