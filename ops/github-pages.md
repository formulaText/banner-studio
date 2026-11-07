# GitHub Pages配信手順（公開準備）

2026-11-06。配信設定の作成のみ承認済み。初回デプロイは未実施で、別途本人の指示が必要です。

## 設定内容

- 正本: [pages.yml](../.github/workflows/pages.yml)。起動条件は `workflow_dispatch` のみ。push、PR、マージによる自動配信はありません。
- 手動で選んだブランチが `main` の場合のみ処理します。他ブランチではbuild/deployがスキップされます。
- Node.js `24.22.1`、`app/package-lock.json` を使い、`npm ci` → 型検査 → lint → 単体テスト → ビルドを実行します。失敗したら配信へ進みません。
- アップロード先はGitHub Pages、対象は `app/dist/` のみ。リポジトリ全体、docs、資料ZIP、テスト結果は配信しません。
- ビルドは `contents: read`、配信ジョブだけに `pages: write` と `id-token: write` を付与。配信environmentは `github-pages`。同時配信は `pages` グループで制御し、進行中の配信はキャンセルしません。
- Viteの既存 `base: "/banner-studio/"` を維持。予定URLは `https://formulatext.github.io/banner-studio/`。アプリはパスルーティングを使わず、この入口内で画面を切り替えます。独自の深いURLや404用SPAフォールバックは追加していません。
- `VITE_GATE_ENABLED: "true"` をビルドに渡します。公開デモ合言葉 `ba7demo` に対応する `app/src/gate.ts` の既定ハッシュを使います。Actions Secrets/Variablesの登録は不要です。ゲートは有効のままです。
- 簡易ゲートはJavaScriptのみで動き、実認証や公開ファイルの保護にはなりません。GitHubアカウントのパスワード等を設定しないでください。
- [verify.yml](../.github/workflows/verify.yml) は従来どおりPR時の検証専用です。配信は行いません。

## 今回のレビューで行うこと

1. Safari等でPRを開き、`Files changed`（変更ファイル）と検証結果を確認します。
2. 内容に問題がなければ、利用者の判断で `Merge pull request` → `Confirm merge` を押します。`Merged` と表示されれば統合完了です。マージだけではこの配信ワークフローは起動しません。
3. **今回はここで止めます。`Run workflow` は押しません。** 誤ってActions画面を開いただけなら、実行せず前の画面へ戻って構いません。

## 初回公開を別途指示した後の操作

以下は将来の手順です。今回こちらからGitHubの設定変更やワークフロー実行はしていません。

1. リポジトリの `Settings`（設定）→ `Pages` を開きます。スマホでタブが見えない場合は横スクロールまたはメニューから探してください。
2. `Build and deployment` の `Source` を **GitHub Actions** にします。表示がGitHub Actionsになったことを確認します。`Deploy from a branch` やdocsフォルダの配信は選びません。画面が異なる場合は操作を中断して状況を確認してください。
3. ゲートの公開デモ合言葉は `ba7demo` です。別の非秘密の合言葉を使いたい場合は、初回実行前に変更内容を別途確認してください。
4. `Actions` → `Deploy app to GitHub Pages (manual)` → `Run workflow` を開き、ブランチが **main** であることを確認して実行します。この操作で初めて配信が始まります。ワークフローが見つからない場合はPRがmainへマージ済みか確認します。
5. `github-pages` environmentに承認ルールが設定されている場合は、対象コミットを確認して `Review deployments` から承認します。承認ルールの有無は今回変更していません。
6. buildとdeployが緑色の成功表示になったら、environmentに表示されるURLを開きます。想定URLは `https://formulatext.github.io/banner-studio/` です。
7. iPhone/iPad Safariで初期ゲート、誤入力、正しい入力、再読込、ログアウト、画像読み込みとPNG出力を確認します。[実機確認手順](../verification/ios-device-checklist.md)も使用します。これらの実機確認は今回未実施です。

失敗時は該当runの赤いステップを開いて原因を確認します。Pages未設定なら手順1〜2を確認し、main以外でスキップされた場合は選択ブランチを確認します。原因を確認せず繰り返し実行しないでください。

## 参照

- [公開方針・簡易ゲート契約](../docs/29_GitHubPages公開と簡易パスワード画面.md)
- [今回の検証記録](../verification/pages-preparation.md)
- [GitHub公式: カスタムワークフローによるPages配信](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- [GitHub公式: 配信ソースの設定](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
