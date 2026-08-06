# Projectコマンドパレット

## 目的

Project数が増えた場合でも、Project名や操作名を検索してキーボード中心で切り替え・操作できるようにします。

## 起動方法

- Windows / Linux: `Ctrl + K`
- macOS: `Cmd + K`
- Projectタブ操作領域の「コマンド」ボタン

入力欄・IME変換中・キーリピート中・既に処理済みのイベントでは、グローバルショートカットを起動しません。

## 操作方法

- 文字入力: Project名・操作名・キーワードを検索
- `ArrowUp` / `ArrowDown`: 実行可能な候補間を循環移動
- `Enter`: 選択中のコマンドを実行
- `Esc`: コマンドパレットを閉じる
- `Ctrl/Cmd + K`: 表示中のコマンドパレットを閉じる

検索語はNFKC正規化、前後空白除去、連続空白の統合、大文字小文字の統一を行います。複数語はAND条件で検索します。言語間の自動翻訳や曖昧一致は行いません。

## 対応コマンド

### Project切り替え

Workspace内の全Projectを候補として表示します。

- 開いているProject: 既存タブへ切り替える
- 閉じているProject: 通常タブ末尾へ開いて切り替える
- アクティブProject: 現在選択中であることを説明表示する

閉じたProjectを直接開いた場合は、閉じたタブ履歴と保存由来の閉じたProject一覧から対象を除外します。

### Project操作

- 新しいProjectを作成
- アクティブProjectを複製
- アクティブProject名を変更
- アクティブProjectを削除
- Project操作を元に戻す
- Project操作をやり直す

削除は既存の確認ダイアログを経由します。作成・複製・名前変更・削除・Undo・Redoは既存のWorkspace Command処理へ合流し、コマンドパレット専用の履歴は作成しません。

### タブ操作

- アクティブタブのピン留め／解除
- アクティブタブを閉じる
- 閉じたタブを復元

ピン留めタブと最後の1タブは既存仕様どおりCloseできません。実行できないコマンドは理由付きで表示しますが、キーボード選択から除外し、実行も拒否します。

### ヘルプ

キーボードショートカット一覧を表示できます。コマンドパレットとショートカット一覧は同時に開きません。

## アクセシビリティ

- ネイティブ`dialog`と`showModal()`を利用する
- 表示中は背面UIを操作できない
- 初期フォーカスを検索欄へ移す
- 閉じた後は起点要素へフォーカスを戻す
- 検索欄はcombobox、候補一覧はlistboxとして通知する
- 選択中候補を`aria-activedescendant`で関連付ける
- 無効候補を`aria-disabled`で通知する
- 結果件数をstatusとして通知する

コマンドパレット表示中の`Ctrl/Cmd + W`、`Ctrl/Cmd + Shift + T`、`F2`は既定動作と伝播を抑止し、ProjectタブやElectronウィンドウが意図せず操作されることを防ぎます。

## 責務分離

- `project-command-palette-model.ts`: コマンド生成、検索、実行可否、選択移動
- `ProjectCommandPalette.tsx`: dialog、検索入力、キーボード操作、候補表示
- `ProjectTabs.tsx`: 既存Project／タブ操作への委譲とフォーカス復帰
- `project-tabs-model.ts`: 閉じたProjectを指定して開く純粋関数
- `project-tab-shortcuts.ts`: `Ctrl/Cmd + K`の判定とヘルプ表示

## 変更しない範囲

- Workspace Command履歴の構造
- `.liveboard`保存形式
- Projectタブ永続化形式
- Electron IPC
- OBS Protocol
- Broadcast Snapshot
- 最近使用したコマンドの永続化
- ショートカットのユーザー設定
