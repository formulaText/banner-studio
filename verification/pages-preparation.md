# GitHub Pages公開準備の検証記録

実施日: 2026-11-06（JST）。対象: main `9dcbf49` から分岐した `chore/github-pages-manual`。
今回は配信設定の準備とローカル検証のみ。GitHub Pages設定変更、ワークフロー手動実行、初回デプロイ、mainへの反映は行っていません。

## 構成の確認

- `app/`: React / TypeScript / PixiJS / Vite。`npm run build` は `tsc --noEmit && vite build`、成果物は `app/dist/`。
- `app/vite.config.ts` は既に `base: "/banner-studio/"`。生成HTMLのJS/CSS/modulepreloadは `/banner-studio/assets/` を参照し、対象ファイルが存在します。
- `app/src/gate.ts` は既定で有効。公開デモ `banner-demo` のSHA-256と照合し、sessionStorageで保持。配信ワークフローでも有効値を明示。アプリコード・依存・要件は変更していません。
- ページ内の画面切り替えにパスルーターはなく、独自サブURLへの直接アクセス対応は不要です。画像等の動的URLは既存のblob/data URLを使用します。
- `app/dist/` 直下は `index.html` と `assets/` のみ。ソース、docs、資料ZIP、テスト、個人制作素材を追加していません。ビルドへ秘密値は投入していません。
- 既存 `.github/workflows/verify.yml` はPR時の検証のみ。追加 `pages.yml` は `workflow_dispatch` のみで、main限定。PR作成で既存の検証CIが動く場合も配信はしません。
- `docs/29_GitHubPages公開と簡易パスワード画面.md` と `ops/pages-workflow.example.yml` を参照。公式 `actions/starter-workflows` のPages例も確認し、サンプルのpush起動・リポジトリ全体アップロードは採用していません。

## 実行結果

環境: Linux、Node.js v24.22.1、npm 11.9.0、Chromium 156.0.8078.79、ソフトウェアGPU（SwiftShader）。PCは1440×1000、モバイル表示はPixel 7エミュレーションです。

| 検査 | 結果 |
|---|---|
| `npm ci --cache /workspace/work/npm-cache` | 成功、lock変更なし、197パッケージ |
| `npm run typecheck` | 成功 |
| `npm run lint` | 成功 |
| `npm test` | 1ファイル、23件成功 |
| `VITE_GATE_ENABLED=true npm run build` | 成功、2885モジュール。既存の500 kB超チャンク警告あり |
| `npm run e2e` | 12件成功、2件は同一エンジンの重複試験として既存設定によりスキップ |
| `python scripts/verify_requirements.py` | 成功、185REQ/218TCの対応一致、実機合格0 |
| ビルド成果物スモーク | PC/モバイル表示とも成功。初期ゲート、誤入力、正入力、再読込保持、ログアウト後の再読込、新規セッションを確認 |
| アセット・配信範囲 | JS/CSSのサブパスと実ファイル存在を確認。画面のアセット404・JS例外なし。docs/ZIP/src/testsの代表URLは404 |
| actionlint v1.7.7 | `actionlint -shellcheck= .github/workflows/pages.yml` 成功（ShellCheckは対象外） |
| YAML設定の静的確認 | 手動起動のみ、main限定、app/dist/のみ、build依存、権限、environment、同時実行制御を確認 |
| Prettier | `prettier --check .github/workflows/pages.yml` 成功 |

コマンド出力は [pages-preparation.log](test-results/pages-preparation.log)。既存統合版のテスト記録は保持しました。
最初の `npm ci` はこの環境の既定キャッシュディレクトリに書き込めず失敗したため、workspace内のキャッシュを指定して成功しました。リポジトリの依存設定やlockの変更は不要でした。

## 成果物スモークの再実行

公開サーバーへ接続せず、ビルド成果物だけをローカルHTTPサーバーに載せて確認します。リポジトリルートで実行します。Python 3と `/usr/bin/chromium` が必要です。

```sh
cd app
npm ci
VITE_GATE_ENABLED=true npm run build
cd ..
mkdir -p work/site
ln -s ../../app/dist work/site/banner-studio
python -m http.server 4173 --bind 127.0.0.1 --directory work/site
```

別ターミナルで `node verification/pages-smoke.mjs` を実行します。終了後はHTTPサーバーをCtrl+Cで停止します。`ln -s` は初回のみ必要です。

## 未実施と継続事項

- GitHub Actions上の配信ジョブ、Pages上の予定URL、HTTPSでの実配信は未検証です。初回デプロイの別途指示後に確認します。
- iPhone/iPad Safari、Android Chrome実機は未検証。Chromiumエミュレーションを実機合格とは扱いません。
- REQ-IDの完了/未完判定と [既知バグ](known-issues.md) は変更なし。アプリ機能の未達を今回解消したとは扱いません。
- 簡易ゲートは実認証ではありません。ゲート解除や合言葉変更の仕様は既存どおりで、今回の配信対象はゲート有効・既存デモ設定です。
- 初回公開前の利用者操作は [配信手順](../ops/github-pages.md) を参照してください。
