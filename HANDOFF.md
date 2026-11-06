# 次フェーズへの引継ぎ

初回統合実装、2026-11-06。`feat/integrated-banner-studio`。全要件完成ではなく未達付きレビュー版。初回コードコミット `affea5e`、後続修正はこのブランチのGit履歴を参照。

## 再開

```sh
git fetch origin
git switch feat/integrated-banner-studio
cd app
npm ci
npm run dev
```

`http://127.0.0.1:5173/banner-studio/` を開く。デモ合言葉 `banner-demo` は公開情報。本物の認証ではない。デモ制作から画像追加→タイトル→出力先→書き出し→3件PNGを確認。自動保存の「保存済み」を待つ。素材つき移行は素材の同梱許諾を確認して設定のバックアップを使う。

```sh
npm run typecheck
npm run lint
npm test -- --reporter=default --reporter=json --outputFile=../verification/test-results/unit.json
npm run build
npx playwright install chromium
npm run e2e
cd ..
python scripts/verify_requirements.py
```

既存Chromiumは `CHROMIUM_PATH=/path/to/chromium npm run e2e`。今回の環境では `/usr/bin/chromium` を使用。Vite/E2Eのloopbackサーバーにも実行環境のネットワーク許可が必要だった。追加ブラウザCDNは拒否されているため、別の許可された開発環境でWebKit/Firefoxを準備する。npm ciはロックを変更しない。

## 実装・試験状態

- 型検査/lint/build成功、単体・結合23合格、E2E12合格/2重複スキップ。実機合格0。
- 全185REQの現在値: [requirements_coverage.csv](verification/requirements_coverage.csv)。118コードあり、58部分、5文書、3blocked、1未実装。自動合格57は限定シナリオ。
- 未実装: DBG-008（素材別同意付き診断）。blocked: QA-003/008（実機）、OPS-002（β案内未承認）。partial58件はCSVのimplementationStatusで抽出。
- 初期218TCの個別全条件は未実施。[checklist.csv](verification/checklist.csv)をコピーせず同ファイルに証拠付き追記する。元docs/10は保持。
- [BUILD_REPORT](BUILD_REPORT.md)、[既知問題](verification/known-issues.md)、[試験範囲](verification/automated-scope.md)、[実機手順](verification/ios-device-checklist.md)を先に読む。

## コード配置

`app/src/model.ts` モデル、`document.ts` 継承/座標、`geometry.ts` 構図、`renderer.ts` Pixi、`Canvas.tsx` 操作、`Inspector.tsx/RegionEditor.tsx` 編集、`storage.ts` 保存、`assets.ts` 素材/フォント、`diagnostics.ts` 匿名診断、`operations.ts` 整列/移行、`gate.ts` 入口、`App.tsx` 統合UI。

次はBUG-0004の座標契約→0003の構図契約→0005の診断再現を個別修正し、関連単体+統合E2Eを通す。その後0002/0012の見本/goldenと0011のメモリを検証する。初回後のUI再設計はdocs/28のモック方針に従う。

`python scripts/generate_coverage.py` は現在の判定からCSV/画面トラッカーを再生成する。更新時はこの判定も変更すること。将来、手動の実機試験結果をCSVに書いた後は、生成器を拡張して結果列を保存するまで再生成しない（上書きする）。`verify_requirements.py` は実機未検証が前提の初回検査なので、実機証拠を登録する段階で判定も更新する。

## 保存と復旧

ブラウザDBは`banner-studio-v1`。保存競合は停止する。上書きのためにDBを消さず、未保存編集をZIPで退避→他タブを閉じる→再読込→別ID取込。描画器が失敗したら診断コードとログを記録。匿名診断は完全再現ではない。バックアップには本文を含むため公開Issueへ添付しない。コードを戻す場合もまずバックアップし、実験用ブラウザプロファイルでこのブランチの既知コミットをcheckoutして比較する。

## 公開境界

`.github/workflows/verify.yml` は検証のみ。配信準備の明示指示に基づき `.github/workflows/pages.yml` を追加した（手動実行のみ・main限定・未実行）。`ops/pages-workflow.example.yml` は参考ファイル。mainマージ、Pages設定変更、初回配信、β案内、外部契約はこの準備作業に含めない。初回配信は別途本人の指示後に行う。


## GitHub Pages公開準備（2026-11-06 JST）

- 基点: main `9dcbf49`（初回統合版PR #2マージ済み）。専用ブランチ: `chore/github-pages-manual`。
- 変更: 手動配信ワークフロー、README/参考例の案内、`ops/github-pages.md`、検証記録。`app/` のソース・base・依存・要件は変更なし。
- ワークフローは `workflow_dispatch` のみ。main以外はスキップ。ビルド検証後に `app/dist/` のみをPagesへ渡す。既存の簡易ゲートを有効に保つ。
- 型検査/lint/build成功、単体23合格、既存E2E12合格/2重複スキップ。ビルド成果物のPC/モバイル表示でゲート・アセット・配信範囲を確認。詳細: [検証記録](verification/pages-preparation.md)。
- REQ-IDの完了/未完判定は変更なし。既存の185REQ対応表・未達・既知バグを継続。実機、公開URL、実際のGitHub Actions配信は未検証。既存の500 kB超チャンク警告あり。
- 次のローカル確認: `cd app && npm ci && npm run typecheck && npm run lint && npm test && npm run build && npm run e2e`。
- 次の利用者操作: PRレビュー → 利用者の判断でmainへマージ。初回公開を指示した後に [配信手順](ops/github-pages.md) に沿ってPagesのSourceと手動実行を設定する。今回ワークフローは起動しない。
