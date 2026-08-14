# マイPageテンプレート

## 目的

ユーザーが編集したPageをマイテンプレートとして端末内に保存し、別Project・別Workspaceでも再利用できるようにします。

ビルトインテンプレートとは異なり、マイテンプレートはユーザー操作で増減するアプリローカルデータです。Workspace本体とはライフサイクルが異なるため、`.liveboard`アーカイブへ混在させません。

## 保存境界

保存領域はmetadataとAsset binaryで分離します。

### localStorage: テンプレートmetadata

キー:

`live-board:user-page-templates:v2`

保存する内容:

- Page / Layerスナップショット
- テンプレート名・作成日時
- AssetのSHA-256 ID / MIME / 寸法 / byteLength / fileNames / sanitized状態
- 直前に削除した復元候補1件

**Assetの`dataUrl`やBase64本体はlocalStorageへ保存しません。**

旧`live-board:user-page-templates:v1`が存在し、v2がまだ存在しない場合はAssetなしテンプレートとしてv2へコピー移行します。ダウングレード時のデータ保護のため、旧v1原本は削除しません。

### IndexedDB: Asset binary

- Database: `live-board-user-page-template-assets`
- Object Store: `assets`
- Key: `asset:<sha256>`
- Value: raw `ArrayBuffer` + byteLength

同一SHA-256のAssetは複数テンプレート間で共有され、binaryを重複保存しません。

## 容量制限

- 最大50テンプレート
- テンプレート名1〜80文字
- NFKC正規化・大文字小文字を無視した同名保存は禁止
- 1テンプレートmetadata JSON最大256KiB
- localStorageのテンプレートmetadata全体最大2MiB
- 1テンプレートが参照できるAsset実バイト合計最大1MiB
- 1テンプレートのAsset最大100件
- IndexedDBのマイテンプレートAsset binary全体最大64MiB

Asset binaryをJSON/Base64から分離することで、同期JSONシリアライズの肥大化とlocalStorage容量超過を避けます。

## 保存時の処理

1. Page / LayerDocumentの整合性を検証
2. `image` / `raster` Layerの`assetId`を抽出
3. 現在ProjectのAsset Libraryに参照Assetがすべて存在することを確認
4. Pageから実際に参照されるAssetだけを収集
5. Asset件数・1テンプレート実バイト上限を検証
6. 既存metadataを基準にIndexedDBの孤立binaryをベストエフォートで整理
7. Asset raw binaryをSHA-256 IDでIndexedDBへ保存
8. Page ID / Project ID / Layer IDをテンプレート用IDへ変換
9. Layer内参照IDを再マップ
10. localStorageへPage / Layer + Asset metadataだけを保存
11. 保存後は**最新の永続metadataを再読込**して孤立binaryをGC

binaryを先に保存してmetadataを後から確定します。metadata保存に失敗した場合は現在のmetadata参照集合を使って孤立binaryを回収します。この順序により、通常フローでは「metadataだけ存在してbinaryがない」状態を作りません。

起動時に独立した非同期GCは実行しません。さらにsave / delete / restoreは共通のmutation queueで**操作全体を直列化**します。短時間に保存操作を連続実行しても、先行処理のGCが後続処理で書き込んだAsset binaryを削除しないよう、binary保存・metadata確定・GCを1つのクリティカルセクションとして扱います。

## AssetのRuntime Validation

localStorageのmetadataとIndexedDBのbinaryはどちらも外部入力境界として扱います。再利用時はIndexedDBからraw bytesを読み出し、既存`importProjectAsset`へ再投入して検証します。

- Asset IDが`asset:<sha256>`形式であること
- SHA-256とAsset IDが一致すること
- MIMEがPNG / JPEG / WebP / GIF / SVGのいずれか
- metadataのbyteLengthとraw binary長が一致すること
- ファイル形式・MIME・拡張子が一致すること
- 画像寸法・ピクセル数が既存制限内であること
- SVGが既存サニタイズ境界を通ること
- 再計算したSHA / MIME / 寸法 / byteLength / sanitized状態がmetadataと一致すること
- PageのAsset参照集合とテンプレートmetadataのAsset集合が完全一致すること

改ざん・欠損・参照切れを検出した場合はPage追加前に失敗させます。

## SVGの再検証

SVGはテンプレート専用の別サニタイザを持たず、Domainの既存`sanitizeSvg`を利用します。

保存済みの安全なSVGを繰り返し再検証できるよう、サニタイザが生成する次の4 entityは再エスケープしません。

- `&amp;`
- `&quot;`
- `&lt;`
- `&gt;`

一方、数値文字参照などその他の`&`は既存entityとして扱わずエスケープします。`jav&#x61;script:`のような難読化を許可しません。

## 再利用時の処理

1. localStorageのPage / Layer / Asset metadataをRuntime Validation
2. IndexedDBから参照Asset binaryを取得
3. `importProjectAsset`で全Assetを再検証
4. 対象Project Asset Libraryの次状態をメモリ上で生成
5. 同じSHA-256 Assetが既に存在する場合は重複登録しない
6. 新規Page / Layer IDを生成
7. LayerDocumentとAsset参照を検証
8. 既存`page.add` Commandを事前適用して成功することを確認
9. 検証済みAsset LibraryとProject Command stateを確定

Asset検証・Project Asset Library容量・Page Commandのいずれかが失敗した場合はstateを更新しません。Pageだけ追加、またはAssetだけ追加された半端な状態へ進めません。

### 非同期Asset読込中のstate保護

IndexedDBの読込中に開始時点の`commandState`が古くならないよう、Asset付きマイテンプレート作成中はPageテンプレートダイアログをbusy状態にします。

- native modalを開いたまま`aria-busy=true`
- Esc / cancelを無効化
- 背景クリック・閉じるボタンを無効化
- ビルトイン / マイテンプレート作成を無効化
- 保存 / 削除 / 復元 / 名前入力を無効化
- 既存ProjectTabsの`isExternalModalOpen`境界によりProject/Pageショートカットを無効化
- 成功・失敗どちらでも`finally`でbusy解除

これによりIndexedDB待機中のユーザー操作でPage編集・Project切替を確定できないため、事前検証したCommand stateを古い状態から全体上書きする経路を作りません。

生成後のPage操作は既存のPage Undo / Redoへ合流します。

## Assetの削除とGC

テンプレート削除時も直前1件は復元候補として保持するため、そのテンプレートが参照するAsset binaryは削除しません。

GC対象は次のすべてから参照されていないAssetだけです。

- 現在保存されているマイテンプレート
- 直前に削除した復元候補

次の削除で復元候補が置き換わり、旧候補のAssetが他テンプレートからも参照されていなければ、そのbinaryをIndexedDBから削除します。GC直前には最新のlocalStorage metadataを再読込し、古い操作結果だけを参照集合として使いません。

## Layer参照の扱い

Rasterの`sourceLayerIds`は現在存在するLayer IDだけを再マップします。Layer結合で削除済みになった履歴IDは生成Pageへ持ち込みません。

Assetの`assetId`はSHA-256 content-addressed IDなので再採番しません。再利用先Project Asset Libraryへ同一IDの検証済み実体を登録することで参照を維持します。

## 破損データへの対応

- localStorage JSON全体が解析不能ならschema v2の安全な空状態へ復旧
- 破損データが旧v1由来ならv1原本を残し、安全な空v2を作成
- 将来schema versionは原本を変更せず機能停止
- 一部テンプレートだけ不正ならそのエントリだけ除外
- Layer type / content / transform / Raster drawingを実行時検証
- Asset metadataとIndexedDB binaryを再検証
- IndexedDB binary欠損・改ざん時は対象テンプレートの再利用を拒否
- orphan binaryは操作境界でGC
- localStorageやIndexedDB障害時もWorkspace本体は破壊しない

## UI

Pageテンプレートギャラリーでは以下を行えます。

- 現在Pageと参照画像Assetをマイテンプレートとして保存
- 保存済みテンプレートからPage作成
- 各テンプレートのAsset件数表示
- テンプレート削除
- 直前に削除した1件を復元
- 保存件数・エラー・復旧メッセージ表示
- 非同期処理中のbusy状態を`role=status` / `aria-live`で通知

既存のコマンドパレットから同じギャラリーを開けます。

## 変更しない範囲

- `.liveboard` schema
- Workspace Autosave / Recovery
- Electron IPC
- OBS Protocol
- Project Asset Library形式
- Projectタブ永続化形式
- Workspace Command履歴

## テスト観点

### Unit

- Page / Layer ID再採番と参照再マップ
- Asset metadataへ`dataUrl`を含めないこと
- localStorage JSONにBase64 binaryが混入しないこと
- IndexedDB相当payload storeからのAsset復元
- SHA-256重複排除
- binary欠損・改ざん拒否
- orphan binary GCと復元候補Asset保持
- SVG sanitize冪等性
- 数値文字参照による危険URL拒否
- v1→v2移行・破損v1原本保護
- 既存Assetなしテンプレート回帰

### E2E

- 画像Asset付きPageをテンプレート保存
- localStorageに`data:image` / `base64,`が存在しないこと
- IndexedDBにraw binaryが保存されること
- reload後にAsset付きテンプレートを再利用できること
- 同じテンプレートを複数回利用してもProject Asset Libraryで重複しないこと
- 既存マイテンプレート・削除復元・ビルトインテンプレートの回帰

## 対象外

- 動画・音声Asset
- 1テンプレートで1MiBを超えるAsset payload
- クラウド同期
- テンプレートExport / Import
- チーム共有・マーケットプレイス

## 将来拡張

1. マイテンプレート名変更・複製
2. タグ・検索・お気に入り
3. テンプレートExport / Import
4. Asset容量管理UI・使用量表示
5. チーム共有・クラウド同期
