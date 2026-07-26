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

予算超過時は計測値と対象を警告へ記録し、再現条件を固定してから最適化します。

## 3. CI実測結果

状態遷移・DTOの値はGitHub ActionsのUbuntu runner、Node.js 22、Vitest 4.1.10で取得しています。Windows packaged soakはWindows Server 2025 runner上でパッケージ済みElectron Mainを実行した値です。いずれも実OBS Browser Source、GPU、利用者端末の実測値ではありません。

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
| Windows packaged soak | 100 / 100回成功 | Overlay HTTP 200 |
| packaged soak p95 / 最大 | 63.163ms / 200.460ms | 最大10秒以内 |
| packaged soak 初回 / 最終RSS | 65.61MiB / 83.23MiB | 増加17.62MiB |
| packaged soak 最大RSS | 83.23MiB | 768MiB以内 |

Windows packaged soakの値はsource head `148c6dcdbb53cc5608f34b55df699f1a6f5f757a`、Windows Package run `30185604929`で取得しました。runner負荷やGCタイミングで変動するため、絶対値だけでメモリリークを断定せず、品質ゲートと複数runの傾向を確認します。

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

Windows Package CIで、パッケージ済み`LiveBoard.exe`をsmoke modeで100回反復します。

各反復:

- 一時永続化領域を作成する
- 永続化サービスを初期化する
- loopback OBS Bridgeを起動する
- token付きOverlay URLをHTTP取得する
- HTMLのReact rootを確認する
- Bridgeを終了する
- 一時領域を削除する

品質ゲート:

- 100 / 100回成功
- 全反復でOverlay HTTP 200
- 最終RSS増加128MiB以下
- 最大RSS768MiB以下
- 1反復最大10秒以下
- 結果JSONにtoken・環境固有パスを含めない

詳細は[Windowsパッケージ反復soak test設計](windows-package-soak.md)を参照してください。

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
- パッケージ済みMainで永続化・Bridge・Overlayライフサイクルを100回反復

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
- 実OBSを含むEditor／Overlay renderer processのRSS・GPUメモリ推移

packaged soakはElectron Mainの反復ライフサイクルを確認しますが、上記の実機試験を代替しません。実機結果は配布候補ビルドごとに記録します。
