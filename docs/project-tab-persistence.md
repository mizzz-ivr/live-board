# Projectタブ表示状態の永続化

## 目的

Projectタブの表示順・Close状態・ピン留め状態をWorkspaceファイルへ保存し、ファイル読込、最近使用したWorkspaceからの読込、クラッシュ復元後も作業レイアウトを再現します。

## 保存境界

`.liveboard`の`manifest.json`へ、任意の`editorState.projectTabs`を追加します。

```json
{
  "editorState": {
    "projectTabs": {
      "openProjectIds": ["project-2", "project-1"],
      "pinnedProjectIds": ["project-2"]
    }
  }
}
```

保存する項目:

- 開いているProjectタブの表示順
- ピン留めProjectの表示順

保存しない項目:

- 直近に閉じたタブ履歴
- タブを閉じる前の通常タブ領域内index
- ドラッグ中やフォーカス中などの一時状態

閉じているProjectは`workspace.projects`には存在し、`openProjectIds`には存在しないProjectとして表現します。

## 互換性

- Liveboard Archive schemaVersionは`1`を維持します
- Workspace schemaVersionは変更しません
- `editorState`がない既存Archiveは全ProjectをWorkspace順で開きます
- Electron IPC、OBS Protocol、Broadcast Snapshotは変更しません
- 古いクライアントが未知の任意項目を無視できる形式にします

## 読込時の補正

Persistence層で次を正規化します。

- 存在しないProject IDを除外
- 重複Project IDを最初の1件へ集約
- ピン留め対象を開いているProjectのみに限定
- ピン留めProjectを通常Projectより前へ配置
- `workspace.activeProjectId`を必ず開いた状態にする
- 不正型または上限超過時は保存済み表示状態を破棄して既定状態へ戻す

Projectタブ数の上限はWorkspace側の上限と同じ1,024件です。

## Workspace複製・インポート

Workspace複製とインポートではProject IDが再採番されるため、`openProjectIds`と`pinnedProjectIds`も同じIDマップで変換します。元Bundleは変更しません。

## Desktop状態管理

`ProjectTabsState`は次を区別します。

- `openProjectIds`: 現在表示しているタブ
- `pinnedProjectIds`: 開いているタブのうちピン留め中のタブ
- `closedProjectIds`: ユーザーが明示的に閉じたProject
- `recentlyClosedTabs`: 同一Rendererセッションだけで使う復元履歴

`closedProjectIds`により、保存時に閉じていたProjectと、保存後に新規追加されたProjectを区別します。新規Projectは通常タブ末尾へ自動的に開きます。

## 保存・履歴

タブのClose・ピン留め・並び替えは未保存revisionと自動保存の対象です。一方、Project本体を変更する操作ではないため、Workspace CommandのUndo／Redo履歴には追加しません。

## テスト境界

- editorStateなしの既存Archiveを読める
- 表示順・Close・ピン留めをArchiveへ保存・再読込できる
- 不明ID・重複IDを除外できる
- 不正なeditorStateでWorkspace本体を失わない
- アクティブProjectを必ず開く
- Workspace複製時にProjectタブIDを再採番する
- 保存状態から復元後、新規Projectだけを通常タブ末尾へ開く
- 直近に閉じたタブ履歴をファイルへ保存しない
- 既存のProject追加・複製・削除・名前変更・Undo／Redo・タブ操作・OBS同期を回帰させない
