# banner-studio

複数出力先向けのバナー制作Webアプリ。TypeScript / React / PixiJS v8で、編集データと素材をブラウザ内に保存します。

**初回統合実装・レビュー段階です。全機能完成ではありません。iPhone/iPad実機は未検証、GitHub Pagesは未公開です。**

## ローカル起動

Node.js 24系を使用します。

```sh
cd app
npm ci
npm run dev
```

`http://127.0.0.1:5173/banner-studio/` → デモ合言葉 `ba7demo`。
入口は偶然の訪問者向けの簡易ゲートで、実認証や機密保護ではありません。変更設定は`app/.env.example`を参照してください。

制作→画像/文字の編集→出力先の調整→書き出しで3種PNGを生成します。保存済み表示を確認し、設定から定期的にZIPをバックアップしてください。素材の同梱は素材ごとの許諾とバックアップの同梱選択が必要です。

## 状態・開発資料

- [実装報告と未達](BUILD_REPORT.md)
- [再開手順](HANDOFF.md) / [設計](ARCHITECTURE.md) / [実装判断](DECISIONS.md)
- [185要件の実装・試験対応](verification/requirements_coverage.csv)
- [218項目の後続確認書](verification/checklist.csv) / [既知の問題](verification/known-issues.md)
- [試験環境](TEST_ENVIRONMENTS.md) / [実機確認手順](verification/ios-device-checklist.md)
- [第三者ライセンス](licenses/README.md)
- [元の開発資料案内](docs/00_README_開発パック.md) / [資料整理記録](docs/資料整理記録.md) / [配置とSHA-256](docs/devpack-import-audit.json)
- [保持した開発資料ZIP](banner-webapp-devpack-v0.3.2.zip)

検証: `npm run typecheck`、`npm run lint`、`npm test`、`npm run build`、`npm run e2e`（appディレクトリ）。PRのCIは検証のみで、配信しません。Pages配信は手動実行専用の `.github/workflows/pages.yml` を用意していますが、未実行です。設定と公開前の操作は[GitHub Pages配信手順](ops/github-pages.md)、今回の検証は[公開準備の検証記録](verification/pages-preparation.md)を参照してください。初回公開、mainへのマージ、β案内には別途本人の承認が必要です。
