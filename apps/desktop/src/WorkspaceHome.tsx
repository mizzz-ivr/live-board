import { useMemo, useState } from 'react';
import type { WorkspacePersistenceController } from './useWorkspacePersistence';
import {
  formatHomeTimestamp,
  sortRecentWorkspaceDocuments,
} from './workspace-home-model';
import './workspace-home.css';

type PendingAction =
  | 'create'
  | 'open'
  | `recent:${string}`
  | `favorite:${string}`
  | `restore:${string}`
  | `discard:${string}`
  | 'refresh'
  | null;

export function WorkspaceHome({
  controller,
  currentWorkspaceName,
  hasEditorSession,
  onContinueEditing,
  onCreateNew,
  onOpen,
  onOpenRecent,
  onRestore,
}: {
  controller: WorkspacePersistenceController;
  currentWorkspaceName: string;
  hasEditorSession: boolean;
  onContinueEditing(): void;
  onCreateNew(): void;
  onOpen(): Promise<void>;
  onOpenRecent(documentId: string): Promise<void>;
  onRestore(candidateId: string): Promise<void>;
}) {
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const recentDocuments = useMemo(
    () => sortRecentWorkspaceDocuments(controller.recentDocuments),
    [controller.recentDocuments],
  );
  const operationPending = controller.busy || pendingAction !== null;

  async function runAction(
    action: Exclude<PendingAction, null>,
    callback: () => void | Promise<void>,
  ): Promise<void> {
    if (operationPending) return;
    setPendingAction(action);
    try {
      await callback();
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <main className="workspace-home" aria-labelledby="workspace-home-title">
      <header className="workspace-home__hero">
        <div>
          <p className="workspace-home__eyebrow">LOCAL PAINT WORKSPACE</p>
          <h1 id="workspace-home-title">ワークスペースホーム</h1>
          <p>
            作業データを選択してからEditorを開始します。実ファイルパスはRendererへ公開しません。
          </p>
        </div>
        <span className="workspace-home__status">{controller.status}</span>
      </header>

      {!controller.enabled ? (
        <section className="workspace-home__notice" aria-label="Browser Previewの制約">
          <strong>Browser Preview</strong>
          <p>
            ファイルを開く、最近使用、お気に入り、クラッシュ復元はElectron版で利用できます。
            新規ワークスペースのUI確認は可能です。
          </p>
        </section>
      ) : null}

      {controller.error === null ? null : (
        <p className="workspace-home__error" role="alert">
          {controller.error}
        </p>
      )}

      <section className="workspace-home__actions" aria-label="ワークスペース開始操作">
        <button
          type="button"
          className="workspace-home__primary-action"
          disabled={operationPending}
          onClick={() => void runAction('create', onCreateNew)}
        >
          <strong>新しいワークスペース</strong>
          <span>空のProjectとPageから開始</span>
        </button>
        <button
          type="button"
          disabled={!controller.enabled || operationPending}
          onClick={() => void runAction('open', onOpen)}
        >
          <strong>ファイルから開く</strong>
          <span>.liveboardを1件選択</span>
        </button>
      </section>

      {hasEditorSession ? (
        <section className="workspace-home__current" aria-label="現在の編集セッション">
          <div>
            <span>現在の編集セッション</span>
            <strong title={currentWorkspaceName}>{currentWorkspaceName}</strong>
            <small>
              {controller.hasUnsavedChanges
                ? '未保存の変更をメモリ上に保持しています'
                : '明示保存済みの状態です'}
            </small>
          </div>
          <button
            type="button"
            disabled={operationPending}
            onClick={onContinueEditing}
          >
            編集を続ける
          </button>
        </section>
      ) : null}

      <div className="workspace-home__columns">
        <section className="workspace-home__panel" aria-labelledby="recent-workspaces-title">
          <div className="workspace-home__panel-heading">
            <div>
              <h2 id="recent-workspaces-title">最近使用したワークスペース</h2>
              <p>お気に入りを先頭に、最終利用日時の新しい順で表示します。</p>
            </div>
            <button
              type="button"
              disabled={!controller.enabled || operationPending}
              onClick={() => void runAction('refresh', controller.refresh)}
            >
              更新
            </button>
          </div>

          {recentDocuments.length === 0 ? (
            <p className="workspace-home__empty">最近使用したワークスペースはありません。</p>
          ) : (
            <div className="workspace-home__list" aria-label="最近使用したワークスペース一覧">
              {recentDocuments.map((document) => (
                <article className="workspace-home__row" key={document.documentId}>
                  <button
                    type="button"
                    className="workspace-home__open"
                    disabled={!controller.enabled || operationPending}
                    onClick={() =>
                      void runAction(`recent:${document.documentId}`, () =>
                        onOpenRecent(document.documentId),
                      )
                    }
                  >
                    <strong title={document.displayName}>{document.displayName}</strong>
                    <small>最終利用 {formatHomeTimestamp(document.lastOpenedAt)}</small>
                    <small>
                      最終保存 {document.lastSavedAt === null
                        ? '未記録'
                        : formatHomeTimestamp(document.lastSavedAt)}
                    </small>
                  </button>
                  <button
                    type="button"
                    className="workspace-home__favorite"
                    aria-label={`${document.displayName}を${document.favorite ? 'お気に入りから外す' : 'お気に入りに追加'}`}
                    aria-pressed={document.favorite}
                    disabled={!controller.enabled || operationPending}
                    onClick={() =>
                      void runAction(`favorite:${document.documentId}`, () =>
                        controller.toggleFavorite(
                          document.documentId,
                          !document.favorite,
                        ),
                      )
                    }
                  >
                    {document.favorite ? '★' : '☆'}
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="workspace-home__panel" aria-labelledby="recovery-candidates-title">
          <div className="workspace-home__panel-heading">
            <div>
              <h2 id="recovery-candidates-title">クラッシュ復元</h2>
              <p>検証済みの自動保存Snapshotだけを表示します。</p>
            </div>
            <span>{controller.recoveryCandidates.length}件</span>
          </div>

          {controller.recoveryCandidates.length === 0 ? (
            <p className="workspace-home__empty">復元候補はありません。</p>
          ) : (
            <div className="workspace-home__list" aria-label="クラッシュ復元候補一覧">
              {controller.recoveryCandidates.map((candidate) => (
                <article className="workspace-home__recovery" key={candidate.candidateId}>
                  <div>
                    <strong title={candidate.workspaceId}>{candidate.workspaceId}</strong>
                    <small>
                      revision {candidate.revision}・{formatHomeTimestamp(candidate.savedAt)}
                    </small>
                    <small>
                      Snapshot後の操作 {candidate.operationCountAfterSnapshot}件
                    </small>
                  </div>
                  <div className="workspace-home__row-actions">
                    <button
                      type="button"
                      disabled={!controller.enabled || operationPending}
                      onClick={() =>
                        void runAction(`restore:${candidate.candidateId}`, () =>
                          onRestore(candidate.candidateId),
                        )
                      }
                    >
                      復元
                    </button>
                    <button
                      type="button"
                      disabled={!controller.enabled || operationPending}
                      onClick={() => {
                        if (
                          !window.confirm(
                            `${candidate.workspaceId} の復元候補を破棄します。元に戻せません。`,
                          )
                        ) {
                          return;
                        }
                        void runAction(`discard:${candidate.candidateId}`, () =>
                          controller.discard(candidate.candidateId),
                        );
                      }}
                    >
                      破棄
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
