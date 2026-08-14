# マイPageテンプレート

## 目的

ユーザーが編集したPageをマイテンプレートとして端末内に保存し、別Project・別Workspaceでも再利用できるようにします。

ビルトインテンプレートとは異なり、マイテンプレートはユーザー操作で増減するアプリローカルデータです。Workspace本体とはライフサイクルが異なるため、`.liveboard`アーカイブへ混在させません。

## 保存境界

マイテンプレートはDesktop Rendererのローカルストアへ、次のキーで保存します。

`live-board:user-page-templates:v2`

保存データにはschema versionを持たせ、Workspace保存・Autosave・Recoveryとは独立させます。`localStorage`は外部入力境界として扱い、読み込み時に型アサーションだけへ依存せずPage・Layer・Asset実データをRuntime Validationします。

旧`live-board:user-page-templates:v1`が存在し、v2がまだ存在しない場合は、Assetなしテンプレートとしてv2へコピー移行します。ダウングレード時のデータ保護のため、旧v1原本は削除しません。

現在の制限は以下です。

- 最大50テンプレート
- テンプレート名は1〜80文字
- NFKC正規化・大文字小文字を無視した同名保存は禁止
- 1テンプレートJSON最大2MiB
- 全テンプレートストアJSON最大4MiB
- 1テンプレートへ同梱する参照Asset実バイト合計最大1MiB
- 同梱Asset最大100件
- 直前に削除した復元候補1件もストア容量へ含める

## 保存時の処理

現在の編集Pageをそのまま保存せず、Page / Layerと参照Assetを検証した上でテンプレート用スナップショットへ変換します。

1. Page / LayerDocumentの整合性を検証
2. `image` / `raster` Layerが参照するAsset IDを抽出
3. 現在ProjectのAsset Libraryに参照Assetがすべて存在することを確認
4. 参照されているAssetだけを収集し、Asset件数・実バイト上限を検証
5. Page ID / Project IDをテンプレート専用IDへ変更
6. 全Layer IDをテンプレート専用IDへ再採番
7. `parentId` / Folder `childLayerIds` / `rootLayerIds` / `activeLayerId`を再マップ
8. Rasterの`sourceLayerIds`は現在存在するLayer IDだけを再マップ
9. Pageと同梱Assetの参照集合が一致することを検証
10. 1テンプレートJSON・ストア全体JSONの容量を検証して保存

この処理により、元Workspace / 元Project / 元Pageの内部IDをマイテンプレートへ持ち込みません。Asset IDはSHA-256 content-addressed IDのため、同一AssetではProjectをまたいでも同じIDを利用します。

## Assetの保存と再検証

Pageから実際に参照されている画像Assetだけをテンプレートへ同梱します。未参照Assetは保存しません。

localStorageに保存されたAsset metadata / data URLは信用せず、読み込み時および再利用時に次を確認します。

- Asset IDが`asset:<sha256>`形式で、SHA-256と一致する
- 対応MIMEがPNG / JPEG / WebP / GIF / SVGのいずれか
- data URLのMIMEと保存metadataが一致する
- base64を再デコードし、byteLengthを照合する
- 既存`importProjectAsset`へ再投入してフォーマット、MIME、拡張子、寸法、ピクセル数、SVG安全性を再検証する
- 再計算されたSHA-256、寸法、byteLength、sanitized状態が保存metadataと一致する
- 同梱Assetに重複SHAがない
- Pageの参照Asset集合と同梱Asset集合が完全一致する

SVGは既存のサニタイズ処理を再利用するため、テンプレート機能専用の別セキュリティ実装は持ちません。保存済みSVGの再検証を安全に繰り返せるよう、サニタイザが生成する`&amp;` / `&quot;` / `&lt;` / `&gt;`だけは再エスケープせず冪等性を保ちます。それ以外の`&`や数値文字参照は既存entityとして扱わずエスケープするため、エンコードによる危険URLの回避は許可しません。

## 再利用時の処理

マイテンプレートからPageを作る際は、Page生成とAsset Library更新を事前検証してからUI stateへ反映します。

1. 保存テンプレートのPage / Layer / AssetをRuntime Validation
2. 同梱Assetを対象ProjectのAsset Libraryへ既存`importProjectAsset`で取り込んだ次状態をメモリ上で生成
3. 同じSHA-256 Assetが対象Projectに存在する場合は既存Assetへ重複排除
4. 新規Page IDを生成
5. 全Layer IDを新規生成し、Layer参照を再マップ
6. 現在Project IDへ付け替え
7. LayerDocumentとAsset参照の整合性を検証
8. 既存`page.add` Commandを事前適用して成功することを確認
9. 検証済みAsset LibraryとPage Command stateを確定

Asset検証、Project Asset Libraryの既存256MiB上限、Page Commandのいずれかが失敗した場合は、Pageだけ追加またはAssetだけ追加された半端な状態へ進めません。

テンプレート作成専用のPage履歴は追加せず、生成後は通常のPage追加と同じUndo / Redoを利用します。

## Layer参照の扱い

Rasterの`sourceLayerIds`は、現在も存在するLayer IDだけを再マップします。Layer結合で既に削除済みになった履歴IDは生成Pageへ持ち込みません。

Assetの`assetId`はLayer IDとは異なりSHA-256 content-addressed IDなので再採番しません。再利用先Asset Libraryへ同じIDの実体を安全に登録することで参照を維持します。

## 破損データへの対応

- JSON全体が解析不能な場合はschema v2の安全な空状態へ復旧し、次回読込で同じwarningを繰り返さない
- 破損データが旧v1キー由来の場合は、ダウングレード用のv1原本を削除せず、安全な空v2を作成して以後はv2を読む
- schema versionが将来版の場合は原本を変更せず機能を停止
- schema version自体が欠損・不正な場合は空状態へ復旧
- 一部テンプレートだけ不正な場合は、そのエントリだけ除外
- Layerのtype / content / transform / Raster drawingを実行時検証
- Assetのdata URL / MIME / SHA / metadataを実行時再検証
- Pageから参照されない余分なAsset、または不足Assetを拒否
- 重複テンプレートID / 名前は後続エントリを除外
- 件数・容量上限を超えるエントリは除外
- 復旧できた正常データは可能な範囲でv2ストアへ書き戻す
- localStorage自体を利用できない場合は、アプリ本体を止めずマイテンプレート機能だけを利用不可にする

## UI

Pageテンプレートギャラリーを次の3領域に分けます。

1. 現在のPageを保存
2. ビルトインテンプレート
3. マイテンプレート

マイテンプレートでは以下を行えます。

- 現在Pageと参照画像Assetを名前付きで保存
- 保存済みテンプレートからPage作成
- 各テンプレートの同梱Asset件数を表示
- 保存済みテンプレート削除
- 直前に削除した1件を永続ストアから復元
- 保存件数確認
- 保存不可理由・復旧メッセージ確認

削除はPage操作履歴とは別のローカル設定変更なので確認ダイアログを表示します。直前に削除した1件はストア内に復元候補として保持し、「削除を元に戻す」で再読込後も復元できます。次の削除が行われると復元候補は更新されます。

## コマンドパレット

既存の「テンプレートからPageを作成」コマンドから同じギャラリーを開きます。

検索語は引き続き以下を利用できます。

- `my template`
- `マイテンプレート`
- `保存`
- `再利用`

新しいグローバルショートカットは追加しません。

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

- 保存時・再利用時の二段階Page / Layer ID再採番
- Folder / root / active / Raster参照の再マップ
- 結合済みRasterの削除済み履歴IDを除外
- LayerDocument整合性
- Layer type / Rich Content / Transform / Raster drawingのRuntime Validation
- 参照Assetの同梱とSHA-256重複排除
- 欠損Assetの保存拒否
- 改ざんAssetの読み込み拒否
- Asset data URL / MIME / SHA / metadata再検証
- XML entityを含むSVGのsanitize冪等性とテンプレート再読込
- 数値文字参照で難読化した危険URLの拒否
- v1→v2コピー移行とv1原本保持
- 破損v1原本を保持した空v2復旧と再読込
- 保存 / 再読込 / 削除 / 削除復元
- 未対応schemaの原本保持
- NFKC同名拒否
- JSON全体破損からの復旧
- 一部エントリ破損時の正常データ保持
- コマンドパレット検索

### E2E

- 画像AssetをPageへ追加
- Asset付きPageをマイテンプレートへ保存
- reload後もテンプレートが残る
- Asset Libraryが空の状態からテンプレートを再利用して画像Assetが復元される
- 同じテンプレートを複数回利用しても同一Assetが1件へ重複排除される
- 既存Assetなしマイテンプレートの保存・再利用・削除復元
- ビルトインテンプレート、Undo / Redo、コマンドパレット、Project操作の回帰

## 対象外

- 動画・音声Asset
- 1MiBを超えるAsset同梱を前提とした大容量テンプレートストレージ
- クラウド同期
- テンプレートExport / Import
- チーム共有・マーケットプレイス

## 将来拡張

優先候補は次の通りです。

1. マイテンプレート名変更・複製
2. タグ・検索・お気に入り
3. テンプレートExport / Import
4. IndexedDB等を利用した大容量テンプレートAsset保存
5. チーム共有・クラウド同期
