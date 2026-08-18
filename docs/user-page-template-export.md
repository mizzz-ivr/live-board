# マイPageテンプレート Export設計

## 目的

端末内に保存したマイPageテンプレートを、Assetを含めてローカルファイルへ安全に書き出せるようにする。

本機能はバックアップと別環境移行の土台を作るものであり、外部ファイルをアプリへ取り込むImportは別PRで扱う。

## 対象

- AssetなしマイPageテンプレート
- PNG / JPEG / WebP / GIF静止画 / SVGを参照するマイPageテンプレート
- 既存上限内のAsset
  - 1テンプレート合計1MiB
  - 最大100 Asset

## 対象外

- `.liveboard-template` Import
- 動画・音声Asset
- 1MiBを超えるAsset同梱
- 複数テンプレートの一括Export
- クラウド同期、チーム共有

## ファイル形式

拡張子は `.liveboard-template` とする。

```plain text
+-------------------------------+
| magic: LIVEBOARD_PAGE_TEMPLATE\0 |
+-------------------------------+
| manifestLength: uint32 LE     |
+-------------------------------+
| manifest: UTF-8 JSON          |
+-------------------------------+
| asset payload #1: raw bytes   |
+-------------------------------+
| asset payload #2: raw bytes   |
+-------------------------------+
| ...                           |
+-------------------------------+
```

manifestには以下を保持する。

- `kind`: `live-board-page-template`
- `schemaVersion`: Export形式のversion。初期値は`1`
- `exportedAt`
- `template`: 既存の`UserPageTemplate` metadata
- `assetPayloads`
  - `assetId`
  - payload領域先頭からの`offset`
  - `byteLength`

Asset binaryはJSONへBase64として埋め込まない。既存のlocalStorage v2と同様、metadataとbinaryを分離する。

## Export前検証

Export元はアプリ内部で既に読み込み済みのマイテンプレートだが、IndexedDB上のbinaryは欠損・破損し得るため書き出し直前に再検証する。

1. PageのLayer document integrityを確認
2. Asset metadataをRuntime Validation
3. Pageが参照するAssetとmetadataの相互参照を確認
4. IndexedDB payloadを取得
5. 既存のAsset import validationを再利用し、SHA-256 / MIME / 寸法 / byteLength / SVG sanitize結果を再確認
6. 検証成功後のみbundleを生成

検証に失敗した場合はダウンロードを開始しない。

## サイズ制限

- manifest: 最大512KiB
- Export bundle全体: 最大2MiB

既存のマイテンプレート上限がmetadata 256KiB、Asset合計1MiBのため、現状の正常データはこの範囲へ収まる。2MiB上限は将来Import時の入力境界としても使用できる安全側の上限である。

## UI

マイテンプレートカードへ「書き出す」ボタンを追加する。

Export中はPageテンプレートDialog全体をbusy状態にし、以下を抑止する。

- Dialog Close / Esc / backdrop Close
- Page作成
- マイテンプレート保存
- マイテンプレート削除・復元
- 別テンプレートのExport

完了または失敗は既存status領域へ`aria-live="polite"`で通知する。

## ファイル名

テンプレート名をNFKC正規化した上で、Windowsで利用できない文字を`_`へ置換する。

- `< > : " / \\ | ? *`
- C0制御文字
- 末尾の`.`と空白
- `CON` / `PRN` / `AUX` / `NUL` / `COM1-9` / `LPT1-9`は先頭へ`_`を付加

空文字になった場合は`page-template.liveboard-template`とする。

## セキュリティ・運用上の注意

- Exportは読み取り専用であり、Workspaceやマイテンプレート保存状態を変更しない
- raw Asset binaryをRendererの外部APIへ渡さず、既存IndexedDBから読み取ってBlob downloadする
- ファイルにはローカル絶対パスやElectron権限情報を含めない
- Import実装時は本ファイルを信頼せず、magic / schema / manifest length / total bytes / offset / Asset hashを再検証して一時領域で復元する

## テスト観点

- AssetなしExport
- Asset付きExport
- manifestへBase64が混入しないこと
- raw payloadのbyte一致
- Asset欠損
- 同サイズ改ざんAsset
- 不正ファイル名文字、Windows予約名
- 既存マイテンプレート保存・再利用・削除・復元への回帰
