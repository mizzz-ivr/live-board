# Project削除設計

## 目的

Workspaceから不要なProjectを安全に削除し、誤削除時はProject本体・Page・Layer・Asset・関連履歴をProject操作のUndoで復元します。

## Domain境界

Project削除は`workspace.project.delete`として実行します。

- 存在しないProjectを拒否
- Workspace最後の1Projectを拒否
- 非アクティブProject削除時は現在の`activeProjectId`を維持
- アクティブProject削除時はWorkspace順で同じ位置の次Project、末尾なら直前Projectへ切り替え
- Workspace整合性検証後だけ更新結果を返す

RendererはProject名を含む確認ダイアログを表示し、承認された場合だけCommandを発行します。

## 差分型履歴

削除履歴はWorkspace全体のSnapshotではなく次だけを保持します。

- `DeleteProjectCommand`
- 削除ProjectのSnapshot
- 削除前のWorkspace内index
- 削除前の`activeProjectId`
- Command metadata
- 推定バイト数

UndoはProjectを元のindexへ挿入し、削除前の`activeProjectId`を復元します。

Undo後に復元ProjectへPage・Layer・Canvas編集を加えてからRedoした場合、Redo直前のProjectを新しいSnapshotとして履歴へ退避します。次のUndoでは編集後の内容を復元します。

## 到達可能性とメモリ上限

現在Workspaceに存在しなくても、次のProjectは復元可能データとして保持します。

- `workspace.project.add`をUndoし、Redo可能なProject
- `workspace.project.delete`を実行し、Undo可能なProject

保持対象:

- Project Snapshot
- Project Asset Library
- Project / Page Command履歴
- Layer履歴
- Canvas履歴

Workspace履歴entry、Asset容量、各履歴の推定容量を合算し、上限超過時はRedo entryを古い順、その後Undo entryを古い順に破棄します。削除entryが破棄されProjectが復元不能になると、到達可能性フィルタが関連Assetと履歴を回収します。

## Rendererセッション

削除Projectは`workspace.projects`から消えるため、タブ同期で次を除去します。

- 開いているタブ
- ピン留め
- 閉じたタブ履歴

UndoでProjectが復元された場合は新規に利用可能になったProjectとして通常タブ領域へ表示します。削除前のタブ順とピン留めは復元しません。

## 永続化・OBS

削除は既存Workspace revisionへ合流し、自動保存・明示保存・未保存表示を更新します。

アクティブProjectを削除した場合は、切り替え先Projectの配信Pageを既存OBS同期経路で送信します。次は変更しません。

- `.liveboard` schema version
- Electron IPC contract
- OBS Protocol
- Broadcast Snapshot schema

## テスト境界

- アクティブ／非アクティブProject削除
- 最後の1Project削除拒否
- 元位置・選択状態のUndo／Redo
- Undo後編集→Redo→Undoで最新内容を復元
- 削除ProjectのAsset・Project / Page / Layer / Canvas履歴保持
- 履歴上限超過後の関連データ回収
- 確認キャンセルでは無変更
- 削除後タブ除去とUndo後の通常タブ復元
- 既存の追加・複製・名前変更・選択・タブ整理・OBS同期の回帰
