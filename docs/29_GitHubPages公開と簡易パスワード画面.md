# GitHub Pages公開＋簡易パスワードUI：実装・運用契約

版：0.3.2／2026-11-06／開発未開始。ユーザーの最終合意事項。

1. **GitHubだけで管理・配信**：公開GitHubリポジトリ1件を使用し、GitHub Pagesからアプリを常時公開する。Cloudflare・独立ホスティング・Codespacesプレビューは今回採用しない。
2. **簡易ゲート**：アプリの起動時にパスワード入力画面を表示する。正しい入力でエディタを表示し、誤入力にはエラーを出す。通過状態はsessionStorage等にセッション単位で保持し、ログアウト・再入力できる設計とする。公開前には入力UIをダミー文字列で検証する。
3. **安全性の限界**：クライアントJSだけのゲートは解析・回避可能である。GitHubのPublicリポジトリ、GitHub Pagesの配信ファイル、アプリのソースなどは隠せない。**権限管理・ユーザー認証・秘密保護と誤認させない**。本物のパスワード、APIキー、未公開素材、個人情報をGitHubへコミットしない。
4. **本人中心→知人β→一般告知**：技術的には全段階でPublic。初期は本人のみが主に使い、後から知人へURLと簡易ゲート用の合言葉を知らせる。一般向け告知時にゲート解除するかは本人が判断する。ユーザーごとの招待/取り消しは要件外。
5. **ビルド配信**：Vite等から生成した`dist/`のみをGitHub ActionsによりPagesへ公開する。`docs/`・ZIP・テスト用の内部ファイルはGitHubリポジトリでは公開されるがPagesのアセットには入れない。GitHub PagesプロジェクトURLのサブパスに合わせて`base`を設定し、直リンクと静的ファイルの404を防ぐ。
6. **テスト**：初期表示・正誤入力・セッション保持/リセット・ゲート有効/無効・iOS Safari動作・公開JSに秘密がないことを検証する。ゲート迂回テストは失敗要件でなく既知の非セキュリティ仕様とする。
7. **権限と時系列**：現存リポジトリをPrivateからPublicに変更する場合は、本人がGitHub画面で実施する。AIには勝手な公開設定変更をさせない。ZIPアップロード→Codex接続→ZIP展開とdocs整理のみを先に行い、アプリ本体の一括開発は別の明示的な開始指示後に行う。初回サイトデプロイも別途承認する。

参照：GitHub公式『Getting started with GitHub Pages』『Configuring a publishing source for your GitHub Pages site』。
https://docs.github.com/en/pages/getting-started-with-github-pages
https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
