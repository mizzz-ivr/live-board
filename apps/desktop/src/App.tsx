import { useState } from 'react';

import { AppV2 } from './AppV2';
import './workspace-home.css';

type ApplicationSurface = 'home' | 'editor';

export function App() {
  const [surface, setSurface] = useState<ApplicationSurface>('home');
  const runtime = window.liveBoard?.getRuntimeInfo();

  if (surface === 'editor') {
    return (
      <div className="application-surface application-surface--editor">
        <button
          type="button"
          className="workspace-home-return"
          onClick={() => {
            const shouldReturn = window.confirm(
              'ホームへ戻ります。未保存の変更はEditorに保持されますが、アプリを終了する前に保存してください。',
            );
            if (shouldReturn) setSurface('home');
          }}
        >
          Workspaceホームへ戻る
        </button>
        <AppV2 />
      </div>
    );
  }

  return (
    <main className="workspace-home" aria-labelledby="workspace-home-title">
      <section className="workspace-home__hero">
        <div className="workspace-home__brand">
          <span className="workspace-home__mark" aria-hidden="true">LB</span>
          <div>
            <p className="workspace-home__product">Live Board</p>
            <h1 id="workspace-home-title">Workspaceを選んで制作を始める</h1>
          </div>
        </div>
        <p className="workspace-home__lead">
          配信用キャンバス、ページ、レイヤー、画像素材をWorkspace単位で管理します。
        </p>
      </section>

      <section className="workspace-home__actions" aria-label="Workspace操作">
        <button
          type="button"
          className="workspace-home__action workspace-home__action--primary"
          onClick={() => setSurface('editor')}
        >
          <strong>新しいWorkspace</strong>
          <span>空のWorkspaceから制作を開始します</span>
        </button>
        <button
          type="button"
          className="workspace-home__action"
          onClick={() => setSurface('editor')}
        >
          <strong>保存済みWorkspaceを開く</strong>
          <span>Editor右側の保存パネルから選択します</span>
        </button>
      </section>

      <section className="workspace-home__panel" aria-labelledby="workspace-home-status-title">
        <div>
          <h2 id="workspace-home-status-title">Workspace管理</h2>
          <p>
            最近使用したWorkspace、お気に入り、クラッシュ復元候補は、次の実装でこの画面へ統合します。
          </p>
        </div>
        <dl className="workspace-home__status">
          <div>
            <dt>実行環境</dt>
            <dd>{runtime === undefined ? 'Browser Preview' : `${runtime.platform} / Electron ${runtime.versions.electron}`}</dd>
          </div>
          <div>
            <dt>ファイル操作</dt>
            <dd>{window.liveBoard === undefined ? '利用不可' : 'Editorから利用可能'}</dd>
          </div>
        </dl>
        {window.liveBoard === undefined ? (
          <p className="workspace-home__notice" role="status">
            Browser Previewではローカルファイルの保存・読込・復元を実行できません。
          </p>
        ) : null}
      </section>
    </main>
  );
}
