# ワークスペースホーム設計

## 1. 目的

Live Boardの起動直後に、制作対象のWorkspaceを選択するホーム画面を表示します。

既存の`.liveboard`保存、最近使用、お気に入り、クラッシュ復元を再実装せず、`useWorkspacePersistence`の公開操作をホームへ統合します。

## 2. 責務境界

Rendererの表示状態として次を持ちます。

```ts
type ApplicationSurface = 'home' | 'editor';
```

`ApplicationSurface`はDomainのWorkspace状態ではありません。ホームへ戻っても現在のWorkspace、Asset Library、Undo履歴を自動破棄せず、同一Rendererプロセスのメモリ上に保持します。

```text
AppV2
├── WorkspaceHome
│   ├── 開始操作
│   ├── 現在の編集セッション
│   ├── 最近使用・お気に入り
│   └── クラッシュ復元
└── Editor
```

Canvas、Layer、OBS Protocol、`.liveboard`形式、Electron IPC contractは変更しません。

## 3. 起動と遷移

### 通常起動

起動直後は`home`を表示します。Archive本体は先読みせず、Main Processから公開済みの最近使用メタデータと復元候補だけを取得します。

### Editorへ進む条件

次の処理が成功した場合だけ`editor`へ遷移します。

- 新規Workspace作成
- ファイル選択から読込
- 最近使用から読込
- クラッシュ復元

ファイル選択のキャンセル、Archive検証失敗、Main Process API失敗ではホームを維持します。現在のWorkspace状態も置き換えません。

### Editorからホームへ戻る

未保存変更がある場合は確認ダイアログを表示します。確認文には、変更を破棄せずメモリ上に保持することを明記します。

確認をキャンセルした場合はEditorを維持します。ホームから「編集を続ける」を選ぶと同じ状態へ戻ります。

## 4. 新規Workspace

`createEmptyWorkspace`と既存`applyBundle`経路を使用します。

新規作成時に次を一括で初期化します。

- Workspace ID
- Project / Pageの初期構造
- Command履歴
- Asset Library
- 関連付いたdocument
- Persistence revision
- 明示保存revision

新規作成直後は未保存状態です。以降の明示保存・自動保存は既存フローへ合流します。

## 5. 最近使用とお気に入り

Rendererへ渡す情報は既存`PublicDocumentRecord`だけです。

- `documentId`
- `displayName`
- `favorite`
- `lastOpenedAt`
- `lastSavedAt`

実ファイルパスは公開しません。

表示順は次のとおりです。

1. お気に入り
2. お気に入り以外
3. 各グループ内で最終利用日時の降順
4. 同値時は表示名、document IDで決定的に整列

不正または未知の日時は`日時不明`として扱い、一覧描画を失敗させません。

## 6. クラッシュ復元

Main Processで検証済みの`PublicRecoveryCandidate`だけを表示します。

復元処理は次の順序です。

1. 候補が現在の一覧に存在することを確認
2. ArchiveをMain Processから取得
3. Archiveを検証・decode
4. 候補のrevisionで破棄を記録
5. 検証済みbundleを現在状態へ適用
6. 未保存WorkspaceとしてEditorへ遷移

Archive取得、検証、破棄のいずれかが失敗した場合は現在のWorkspaceを置き換えません。

手動破棄では確認ダイアログを表示します。Workspaceファイル自体を削除するAPIは追加しません。

## 7. Browser Preview

`window.liveBoard`が存在しないBrowser Previewでは、次を無効化します。

- ファイル選択から開く
- 最近使用から開く
- お気に入り更新
- 復元候補の復元・破棄
- 一覧の再取得

新規Workspaceの作成とホーム／Editor UIの確認は可能です。

既存E2EはEditor機能の回帰を維持するため、PlaywrightのDesktopプロジェクトだけlocalStorageでEditor開始を指定します。ホーム専用E2Eは空のstorage stateで通常起動を検証します。このキーはテスト専用で、通常利用では設定されません。

## 8. 配信との分離

ホーム表示中は次を停止します。

- Altキーによる配信ページ切り替え
- RendererからElectron MainへのBroadcast Snapshot同期

OBS Bridge自体はMain Processで起動を維持し、最後に公開成功したフレームを保持します。Editorへ戻った時点で最新Workspaceを再同期します。

## 9. 重複操作防止

ホームの非同期操作は同期Refと表示stateの両方でロックします。

- Ref: 同一イベントループ内の連続実行を防止
- state: ボタンを無効化して処理中であることをUIへ反映
- Controller `busy`: Main Processを伴う処理全体を排他

## 10. テスト観点

### Unit Test

- お気に入り優先ソート
- 最終利用日時降順
- 元配列を変更しないこと
- 100件の整列
- 不正日時のフォールバック

### E2E

- 起動直後にホームを表示
- Browser PreviewのファイルI/O操作を無効化
- 新規Workspace作成後にEditorを表示
- 未保存状態でホームへ戻る確認
- ホームで編集セッションを保持
- 「編集を続ける」でEditorへ復帰
- 確認キャンセル時にEditorを維持

### 回帰

- 既存Desktop / Overlay E2E
- 自動保存・明示保存・復元
- OBS Snapshot / Layer patch
- Windows package smoke / soak

## 11. 対象外

- Workspaceファイルの削除
- OS上のファイル名変更
- 複数Workspaceの同時編集
- 複数ウィンドウ
- Workspaceテンプレート
- Workspaceサムネイルの永続化
- Projectタブの閉じる・ピン留め
