# 配信性能・長時間安定性試験

## 1. 目的

配信中のページ切り替え、Overlay描画、自動保存、画像配置が長時間動作しても、操作停止・revision欠番・重大なメモリ増加を発生させないことを確認します。

計測結果なしにWorker、OffscreenCanvas、WebGLへ置き換えず、現在のCanvas 2D構成で性能予算を超えた箇所だけを段階的に最適化します。

## 2. 性能予算

| 項目 | 予算 |
|---|---:|
| 100ページ一覧の配信切り替え判定 | 100ms |
| 100Layerの配信DTO投影 | 100ms |
| BroadcastSnapshot生成 | 100ms |
| Overlay描画 | 100ms |
| OBSページ切り替え反映 | 100ms |
| 自動保存による描画停止 | 50ms |
| Windows packaged soakの最終RSS増加 | 128MiB |
| Windows packaged soakのピークRSS増加 | 256MiB |
| Windows packaged soakの1反復最大時間 | 15秒 |

予算超過時は計測値と対象を警告へ記録し、再現条件を固定してから最適化します。

## 3. CI実測結果

Ubuntuの状態遷移・DTO試験と、Windowsのパッケージ済みElectron Main試験を分けて記録します。いずれも実OBS Browser Source、GPU、実時間8時間操作の測定ではありません。

| 試験 | 実測 | 判定 |
|---|---:|---|
| 100ページの次ページ切り替え判定 | 0.716ms | 100ms予算内 |
| 100Layerの配信DTO投影 | 1.599ms | 100ms予算内 |
| 配信対象Layer | 50 / 100 | 非表示50Layerを除外 |
| 4K画像4枚の理論RGBAメモリ | 126.56MiB | 同時キャッシュ数の制御が必要 |
| 28,800回の8時間相当切り替え | 201.866ms | 全28,800回成功 |
| 8時間相当revision欠番 | 0件 | 成功 |
| シミュレーション保持Workspace | 1件 | 旧状態を保持しない |
| 最大シリアライズWorkspace | 2,432byte | 試験fixture内で安定 |
| Renderer→Main 100LayerフルSnapshot | 48,006byte | 比較元 |
| Renderer→Main 1Layer更新patch | 1,764byte | フルの3.67% |
| Renderer→Main payload削減率 | 96.33% | 10%未満の退行防止基準内 |
| Windows packaged soak | 100 / 100回成功 | 成功 |
| Windows packaged soak p95 | 25.211ms | 予算内 |
| Windows packaged soak 最大 | 69.592ms | 予算内 |
| Windows packaged soak 初回RSS | 68.27MiB | 比較元 |
| Windows packaged soak 最終RSS | 86.20MiB | 増加17.93MiB |
| Windows packaged soak 最大RSS | 86.20MiB | ピーク増加17.93MiB |

Windows値はGitHub ActionsのWindows Server 2025 runner、Electron 43.1.1、100反復で取得しました。診断runは`30185070266`、対象headは`1278096d7b3e8a032d1474ed6dc047d9320c8daf`です。runner負荷やメモリアロケータで値は変動するため、単発値の一致ではなく予算内で継続成功することを品質ゲートにします。

## 4. CIで実施する試験

### 4.1 100ページ

- 100ページを保持するProjectを生成
- 次・前・番号指定の配信ページ切り替えを実行
- UIでは100ページを実際に追加して一覧操作を確認
- `IntersectionObserver`により画面外サムネイルを生成しないことを確認

### 4.2 100Layer

- 100Layerを生成
- 半数を非表示に設定
- 配信DTOへ非表示Layerが含まれないことを確認
- 投影時間を性能予算と比較

### 4.3 4K画像

RGBA展開後の理論メモリ量を次式で算出します。

```text
width × height × 4 byte × image count
```

3840×2160画像を4枚同時にデコードした場合は132,710,400 byte、約126.56MiBです。これは圧縮ファイル容量とは別に必要となるため、画像枚数、Canvasキャッシュ、サムネイル生成を同時に増やさないことを前提とします。

### 4.4 8時間相当

実時間8時間をCIで待機する代わりに、1秒ごとの配信切り替えを想定した28,800回の操作を高速実行します。

確認項目:

- 全切り替えが完了する
- revisionが単調増加する
- revision欠番が発生しない
- シミュレーションが最新Workspace 1件だけを保持する
- OBS同期が途中停止しない

これは状態遷移の長時間相当試験であり、Electron・OBS・GPU・OSを8時間稼働させる実機試験の代替ではありません。

### 4.5 Renderer→Main Layer差分

- 100Layerを持つsourceなしSnapshotを2世代生成します。
- 2世代目では1Layerの内容だけを変更します。
- フルSnapshotと`BroadcastLayerPatchDescriptor`をUTF-8 JSON byteLengthで比較します。
- fixtureではフル48,006byteに対してpatch 1,764byte、比率3.67%、削減率96.33%です。
- patch payloadがフルSnapshot payloadの10%未満であることを確認します。
- Page、Canvas、Overlay設定変更時はフルSnapshotへフォールバックすることを確認します。
- Main再起動相当とbase revision不一致時に同revisionのフルSnapshotで復旧することを確認します。

この試験はIPCオブジェクトのJSON表現を比較する退行防止fixtureです。Electron structured cloneの実時間、メモリコピー回数、GC、Windows実機CPUは直接測定していません。

### 4.6 Windows packaged soak

パッケージ済み`LiveBoard.exe`をsmoke modeで起動し、同一Electron Mainプロセス内で100回反復します。

各反復:

- 一時永続化領域を作成して初期化
- loopback OBS Bridgeを起動
- token付きOverlay URLをHTTP取得
- HTTP 200とReact rootを確認
- Bridgeを終了
- 一時領域を削除
- 所要時間とプロセスRSSを記録

品質ゲート:

- 全100回成功
- 最終RSS増加128MiB以内
- ピークRSS増加256MiB以内
- 1反復最大15秒以内
- 全体10分以内

結果は`packaged-soak.json`としてWindows Package artifactへ保存します。各反復のURL、token、ポート履歴、パスは保存しません。

## 5. 現在の最適化

- 非表示Layerと非表示フォルダー配下をBroadcastSnapshotへ含めない
- Overlayで表示対象Layerだけを描画
- Layer単位Canvasキャッシュ
- 利用可能な環境ではLayerキャッシュへOffscreenCanvasを使用
- ページサムネイルは表示領域付近だけをidle時間に生成
- サムネイル生成後に元サイズCanvasとRendererキャッシュを解放
- OBS優先プリセットではページ遷移と装飾効果を無効化
- Renderer→Mainの画像bytesをSHA-256単位で一回登録
- Renderer→MainとOBS Bridge→OverlayでLayer DTOの差分／フル自動選択
- WindowsパッケージのBridge・永続化ライフサイクルを100回反復して診断

## 6. Worker / OffscreenCanvas / WebGL判断

### 推奨判断

現時点ではCanvas 2Dを維持します。Layerキャッシュには既にOffscreenCanvasを利用でき、状態遷移と配信DTO投影は性能予算を大きく下回ったため、全面的なWorker移行やWebGL化は行いません。

### Worker導入基準

- 自動保存やサムネイル生成によりメインスレッド停止が50msを継続的に超える
- 画像デコード・縮小が描画入力を阻害する

### WebGL導入基準

- 100LayerのOverlay描画が100msを継続的に超える
- Canvas 2Dの合成モード・大規模変形が主要なボトルネックになる

### OffscreenCanvas拡張基準

- 対象ブラウザ・OBS Browser Sourceで安定利用できることを確認できる
- Worker転送コストを含めても現行Canvas 2Dより改善する

## 7. 実機で残る確認

- Windows ElectronとOBS Browser Sourceを接続した8時間連続試験
- 複数4K実画像のデコード・切り替え・保存同時実行
- GPUドライバー別のCanvasメモリ解放
- ウイルス対策ソフト動作中の自動保存
- スリープ復帰、OBS再接続、ディスプレイ構成変更
- Renderer→Main Layer patchのstructured clone時間とGCピーク

Windows packaged soakはElectron Main、永続化、loopback Bridge、Overlay静的配信の反復試験です。OBS Browser Source、Canvas描画、GPU、ユーザー操作を含む実機試験の代替ではありません。

実機結果は配布候補ビルドごとに記録します。
