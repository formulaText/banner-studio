# 試験環境

- 開発: Linux / Node v24.22.1 / npm 11.9.0。
- 自動: Vitest + fake-indexeddb、Playwright + `/usr/bin/chromium`。WebGLはSwiftShaderによるソフトウェアGPU。
- PC表示: 1440×1000。
- モバイル表示: Playwright Pixel 7プリセット。これはAndroid実機でもiPhoneでもない。
- iPhone/iPad Safari、Android Chrome実機、PC Safari/Edge/Firefox: 未検証。
- WebKit/Firefox追加インストール: CDNへの通信が環境ポリシーで拒否され未実施。設定の迂回は行っていない。
- GitHub Pages: 未公開、実サイト上の試験は未実施。

成功コマンド、時刻、件数はverification/test-results/とBUILD_REPORT.mdを参照。iPhoneとiPadは利用者が後続フェーズで試験する。
