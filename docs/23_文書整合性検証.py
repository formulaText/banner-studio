#!/usr/bin/env python3
"""開発前パックの資料整合性検証。アプリを実装・実行するものではない。

Usage: python 23_文書整合性検証.py [--write-report]
"""
from __future__ import annotations
import argparse
import csv
import hashlib
import json
from collections import Counter
from pathlib import Path

ROOT=Path(__file__).resolve().parent
REQ='09_要件トレーサビリティ.csv'
TC='10_初期検証マトリクス.csv'
REPORT='24_文書整合性監査結果.json'
MANIFEST='manifest.json'


def read_csv(name: str):
    with (ROOT/name).open('r',encoding='utf-8-sig',newline='') as f:
        rd=csv.DictReader(f)
        return list(rd),rd.fieldnames


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--write-report',action='store_true')
    args=ap.parse_args()
    errors=[]
    req,req_fields=read_csv(REQ)
    cases,tc_fields=read_csv(TC)
    req_ids=[r['REQ-ID'] for r in req]
    tc_ids=[r['TC-ID'] for r in cases]
    req_counter=Counter(req_ids)
    tc_counter=Counter(tc_ids)
    for rid,cnt in req_counter.items():
        if cnt!=1: errors.append(f'REQ-ID重複: {rid} x{cnt}')
    for tid,cnt in tc_counter.items():
        if cnt!=1: errors.append(f'TC-ID重複: {tid} x{cnt}')
    missing_req=sorted(set(c['REQ-ID'] for c in cases)-set(req_ids))
    uncovered=sorted(set(req_ids)-set(c['REQ-ID'] for c in cases))
    if missing_req: errors.append(f'不正REQ参照:{missing_req}')
    if uncovered: errors.append(f'試験未対応REQ:{uncovered}')
    if req_fields!=['REQ-ID','分野','要件','要求種別','開発目標','根拠','初期実装状態','検証種別','備考']:
        errors.append('REQ CSVの列順/列名が変更された')
    if tc_fields!=['TC-ID','REQ-ID','試験種別','試験素材','前提条件','操作・試験手順（初期案）','期待結果','診断・確認手段','端末','実施結果']:
        errors.append('TC CSVの列順/列名が変更された')
    if any(r['初期実装状態']!='未実装' for r in req):
        errors.append('未開発なのに実装状態が未実装以外に設定されている')
    if any(c['実施結果']!='未実施' for c in cases):
        errors.append('未試験なのに実施結果が未実施以外に設定されている')
    expected=['00_README_開発パック.md','01_統合要件定義.md','02_技術設計・データモデル.md','03_先行研究・技術根拠.md','04_デバッグ・診断仕様.md','05_検証計画・確認項目作成手順.md','06_AI一括開発実行指示書.md','07_事前準備・環境構築チェック.md','08_未決定事項・リスク台帳.md',REQ,TC,'11_実装後確認項目書テンプレート.md','12_テスト素材・フィクスチャ仕様.md','13_開発AI用スタータープロンプト.txt','14_画面構成・操作フロー設計.md','15_設計レビュー結果.md','16_設計決定台帳.md','17_仕様契約_継承と永続化.md','18_仕様契約_座標と構図最適化.md','19_仕様契約_描画とエフェクト.md','20_仕様契約_文字素材安全.md','21_品質ゲートと受入判定.md','22_事前条件_サービス実測と未確定事項.md','29_GitHubPages公開と簡易パスワード画面.md','25_ユーザー決定事項と変更記録.md','26_配信環境と段階的公開・βテスト.md','27_GitHubをスマホで使うための操作案内方針.md','28_改修フェーズ_モジュールとデザインモック運用.md','23_文書整合性検証.py','AGENTS.md','CLAUDE.md','README_使い方.txt']
    for name in expected:
        if not (ROOT/name).is_file(): errors.append('必須ファイル欠損:'+name)
    manifest=ROOT/MANIFEST
    if manifest.is_file():
        m=json.loads(manifest.read_text(encoding='utf-8'))
        listed=set()
        for f in m['files']:
            name=f['path']
            if name in listed: errors.append('manifest重複:'+name)
            listed.add(name)
            path=ROOT/name
            if not path.is_file(): errors.append('manifestファイル欠損:'+name); continue
            digest=hashlib.sha256(path.read_bytes()).hexdigest()
            if digest!=f['sha256']: errors.append('manifestハッシュ不一致:'+name)
            if path.stat().st_size!=f['sizeBytes']: errors.append('manifestサイズ不一致:'+name)
        if set(expected)-listed: errors.append('manifest未収録:'+str(sorted(set(expected)-listed)))
        if m['counts']['requirements']!=len(req) or m['counts']['initialTestCases']!=len(cases):
            errors.append('manifestカウント不一致')
    report={
        'reviewDate':'2026-11-06',
        'packVersion':'0.3.2',
        'status':'documents_only_app_not_developed',
        'requirementsCount':len(req),
        'testCasesCount':len(cases),
        'requirementTypes':dict(Counter(r['要求種別'] for r in req)),
        'domains':dict(Counter(r['分野'] for r in req)),
        'duplicateReqIds':sorted([k for k,v in req_counter.items() if v>1]),
        'duplicateTcIds':sorted([k for k,v in tc_counter.items() if v>1]),
        'orphanCaseReqIds':missing_req,
        'uncoveredReqIds':uncovered,
        'checks':{'all_initial_implementation_states_unimplemented':all(r['初期実装状態']=='未実装' for r in req),
                  'all_tests_unexecuted':all(c['実施結果']=='未実施' for c in cases)},
        'errors':errors,
        'passed':not errors,
        'note':'文書間の構造的な照合であり、コードや実機の動作検証ではない。'
    }
    if args.write_report:
        (ROOT/REPORT).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False,indent=2))
    raise SystemExit(1 if errors else 0)

if __name__=='__main__': main()
