<div align="center">

# 旅のしおり

1日の行動をまとめる旅程スケジュール管理アプリ。

<p>
  <a href="https://react.dev"><img alt="React" src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=000" /></a>
  <a href="https://nodejs.org/"><img alt="Node.js" src="https://img.shields.io/badge/Node.js-18%2B-339933?logo=nodedotjs&logoColor=fff" /></a>
  <a href="https://www.typescriptlang.org/"><img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=fff" /></a>
  <a href="https://vitejs.dev/"><img alt="Vite" src="https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=fff" /></a>
  <a href="https://expressjs.com/"><img alt="Express" src="https://img.shields.io/badge/Express-4-000000?logo=express&logoColor=fff" /></a>
  <a href="https://www.prisma.io/"><img alt="Prisma" src="https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma&logoColor=fff" /></a>
  <a href="https://www.postgresql.org/"><img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-15-4169E1?logo=postgresql&logoColor=fff" /></a>
  <a href="https://www.docker.com/"><img alt="Docker" src="https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=fff" /></a>
  <a href="#%E3%83%86%E3%83%BC%E3%83%9E"><img alt="Theme" src="https://img.shields.io/badge/Theme-Light%20%2F%20Dark%20%2F%20Auto-8B5CF6?logo=apple&logoColor=fff" /></a>
</p>

</div>

## 特徴

- ドラッグ&ドロップで時間移動／下端リサイズで終了時刻変更（カレンダー）
  - 移動は5分刻み、リサイズは最小15分から
- クリックでその時刻に「予定追加」ボトムシートを表示（カレンダー）
- 出発地/到着地から所要時間を自動計算、見やすいタイムライン（リスト）
- モバイル最適化（2ページ構成＋下部タブ／日付ピッカーと「前日/今日/翌日」）
- テーマ切替（ライト/ダーク/自動）。ライトでも立体背景を薄く表示、ダークで強調

## 構成 / 技術スタック

- フロントエンド: React + TypeScript + Vite（`frontend/`）
- バックエンド: Express + Prisma（`backend/`）
- DB: PostgreSQL（`docker-compose.yml`）

```
journey-schedule-app/
├─ backend/            # API / Prisma スキーマ
├─ frontend/           # React クライアント
├─ docker-compose.yml  # PostgreSQL（ローカル）
└─ README.md
```

## クイックスタート

1) DB 起動

```bash
docker compose up -d
```

2) バックエンド（API）

```bash
cd backend
cp .env.example .env  # 値を必要に応じて編集
npm install
npm run prisma:generate
npm run prisma:migrate   # 初回のみ
npm run dev              # http://localhost:4000
```

3) フロントエンド

```bash
cd frontend
npm install
npm run dev  # http://localhost:5173 （/api は http://localhost:4000 へプロキシ）
```

ヘルスチェック:

```bash
curl http://localhost:4000/api/health
```

### Google認証の設定（任意）

1) Google Cloud Console で OAuth クライアント（Web）を作成し、Client ID を取得
   - 認証情報 → 認証情報を作成 → OAuth クライアントID → アプリの種類: Web
   - 承認済みのJavaScript生成元: `http://localhost:5173`
2) 環境変数を設定
   - `backend/.env` に `GOOGLE_CLIENT_ID` と `JWT_SECRET` を追加
   - `frontend` の起動環境に `VITE_GOOGLE_CLIENT_ID` を追加（例: `.env.local` に `VITE_GOOGLE_CLIENT_ID=...`）
3) マイグレーション（User 追加）
   - `cd backend && npx prisma migrate dev --name add_user_auth`

起動後、ヘッダー右の「Googleでログイン」からサインインできます。

## ルーティング / 画面構成

- 一覧（タイムライン）: `/day/YYYY-MM-DD`
- 1日カレンダー: `/calendar/YYYY-MM-DD`
- 画面下部のタブでページ切替。右上の「前日/今日/翌日」ボタンと日付ピッカーで日付移動できます

## 操作ガイド（要点）

- 予定の追加（カレンダー）: 空きグリッドをタップ → 開いたシートで「出発地/到着地・出発/到着・メモ」を入力 → 追加
- 予定の移動（カレンダー）: イベントをドラッグ（5分刻み）
- 予定の長さ変更（カレンダー）: イベント下端をドラッグ（最小15分）
- 予定の編集（一覧）: 各行の「編集」から同じ項目（出発地/到着地・時刻・メモ）を更新
- テーマ切替: ヘッダー右のトグルで「自動 → ライト → ダーク」を巡回

## 秘匿情報（Git管理しない）

- 秘匿情報は `.env` に配置し Git から除外（`.gitignore` 済）
- 共有が必要な値は `backend/.env.example` を更新し、各自で `.env` を作成
- 代表例: `DATABASE_URL=postgresql://journey:journey@localhost:5432/journey?schema=public`

## サーバー操作

— DB（PostgreSQL / Docker Compose）

- 起動: `docker compose up -d`
- 停止: `docker compose stop`
- 破棄: `docker compose down`
- ログ: `docker compose logs -f db`

— API（backend）

- 開発: `cd backend && npm run dev`
- 本番: `cd backend && npm run build && npm start`
- ヘルス: `curl http://localhost:4000/api/health`

— フロント（frontend）

- 開発: `cd frontend && npm run dev`
- 本番ビルド: `cd frontend && npm run build`
- プレビュー: `cd frontend && npm run preview`

## API 概要（MVP）

- `GET /api/day?date=YYYY-MM-DD` 日付のスケジュール＋項目一覧
- `POST /api/day` `{ date, title?, notes? }` 1日のテーマ作成/更新
- `POST /api/item` `{ date, title, startTime(HH:mm), endTime?, kind?, departurePlace?, arrivalPlace?, notes? }` 作成
- `PUT /api/item/:id` 項目更新
- `DELETE /api/item/:id` 項目削除

### 認証系

- `POST /api/auth/google` body `{ idToken }` GoogleのIDトークンを検証し、JWTクッキーを発行
- `GET /api/me` ログイン中のユーザー情報
- `POST /api/logout` ログアウト（クッキー削除）

## テーマ

- ライト/ダーク/自動のテーマ切替（ヘッダー右のトグル）
- 自動は OS 設定に追従。ライトでは背景の立体オブジェクトを薄く、ダークでははっきり表示（react-three-fiber）

## 今後の拡張

- 重なりイベントの横分割レイアウト（Googleカレンダー風）
- 繰り返し予定、テンプレート、共有リンク/印刷
- 認証/ユーザー管理、オフライン対応（PWA）
