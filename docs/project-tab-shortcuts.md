# Projectタブのキーボードショートカット

## 目的

Projectタブの主要操作をキーボードだけで実行できるようにし、マウス移動を減らして編集効率とアクセシビリティを改善します。

## ショートカット

| 操作 | Windows / Linux | macOS |
| --- | --- | --- |
| アクティブタブを閉じる | `Ctrl + W` | `Cmd + W` |
| 閉じたタブを復元する | `Ctrl + Shift + T` | `Cmd + Shift + T` |
| アクティブProject名を変更する | `F2` | `F2` |

## 既存仕様との関係

ショートカットは新しいProject操作を追加せず、既存のタブ操作を呼び出します。

- Closeは`closeProjectTab`を使用する
- 復元は`reopenLastProjectTab`を使用する
- 名前変更は既存のProject名変更ダイアログと`workspace.project.rename`を使用する
- ピン留めタブはCloseしない
- 最後の1タブはCloseしない
- 復元候補がない場合は状態を変更しない
- 名前変更をキャンセルした場合は状態を変更しない

認識したClose・復元ショートカットは、操作できない状態でもElectronやブラウザの既定動作を抑止します。これにより、最後の1タブやピン留めタブで`Ctrl/Cmd + W`を押した際に編集ウィンドウが意図せず閉じることを防ぎます。

## 誤発火防止

次の場合はProjectタブのショートカットとして扱いません。

- `input`、`textarea`、`select`内で操作している
- `contenteditable`内で操作している
- IME変換中
- キーリピート中
- 既に`preventDefault`されたイベント
- `Alt`を併用している
- `Ctrl`と`Cmd`を同時に押している
- 定義されていない修飾キーの組み合わせ

ショートカット判定は`project-tab-shortcuts.ts`へ集約し、UIコンポーネントから分離します。

## イベント境界

`ProjectTabs`表示中だけ`window`の`keydown`をCaptureフェーズで監視します。認識したイベントは`preventDefault`と`stopPropagation`を実行し、同じキー操作が別の画面操作として二重実行されることを防ぎます。

Projectタブがアンマウントされた場合はイベントリスナーを解除します。グローバルショートカットやElectronメニューのAcceleratorは使用しません。

## 変更しない範囲

- Workspace Command履歴の構造
- `.liveboard`保存形式
- Projectタブ表示状態の永続化形式
- Electron IPC
- OBS Protocol
- Broadcast Snapshot
- ショートカットのユーザー設定

## テスト境界

### Unit Test

- CtrlとCmdの双方でCloseできる
- Ctrl/Cmd + Shift + Tで復元できる
- 修飾キーなしのF2で名前変更できる
- 入力中、IME、repeat、処理済みイベントを無視する
- Alt、CtrlとCmd同時、余分なShiftを拒否する
- 未定義キーを無視する

### E2E

- F2でアクティブProject名を変更できる
- Ctrl + Wでアクティブ通常タブをCloseできる
- Ctrl + Shift + TでCloseしたタブを復元できる
- ピン留めタブではCtrl + Wを押してもCloseしない
- 入力要素から発生したショートカット相当イベントでタブを操作しない
