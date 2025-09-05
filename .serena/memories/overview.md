# プロジェクト概要

- 名称: journey-schedule-app
- 目的: 1日の行動（旅程）を整理・表示するスケジュール管理アプリ。カレンダー/タイムライン表示、ドラッグ操作、Google認証に対応。

## 技術スタック
- フロントエンド: React 18 + TypeScript + Vite, React Router, react-three-fiber（三次元背景）
- バックエンド: Node.js 18+, Express 4, Prisma 5, Zod, jsonwebtoken, cookie-parser, google-auth-library
- データベース: PostgreSQL 15（Docker Compose）

## ディレクトリ構成（主要）
- frontend/
  - src/main.tsx, src/pages/DayListPage.tsx, src/pages/DayCalendarPage.tsx, src/DayCalendar.tsx
  - src/components/AuthButton.tsx（Google 認証UI）
  - vite.config.ts（/api を backend:4000 にプロキシ）
- backend/
  - src/index.ts（Express API 本体）
  - prisma/schema.prisma（User/DaySchedule/ScheduleItem/ItemKind）
  - package.json（dev/build/start/prisma スクリプト）
- docker-compose.yml（PostgreSQL 15）
- README.md（起動手順・機能概要）

## 環境変数
- backend/.env
  - DATABASE_URL（例: postgresql://journey:journey@localhost:5432/journey?schema=public）
  - GOOGLE_CLIENT_ID, JWT_SECRET（Google 認証・JWT用）
- frontend/.env.local
  - VITE_GOOGLE_CLIENT_ID（Google 認証用 Client ID）

## 実行エントリ
- Backend: npm run dev（ts-node-dev）、npm run build → npm start（dist）
- Frontend: npm run dev（Vite 5173）、npm run build / npm run preview
- Health: GET http://localhost:4000/api/health

## API 概要（抜粋）
- GET /api/day?date=YYYY-MM-DD（スケジュール+items）
- POST /api/day（1日のテーマ/ノート upsert）
- POST /api/item（予定作成: general/move, 時刻・場所等）
- PUT /api/item/:id（予定更新, 所有者チェック）
- DELETE /api/item/:id（予定削除）
- 認証: POST /api/auth/google（IDトークン→JWT付与）, GET /api/me, POST /api/logout

## スタイル/設計の要点
- バック: Zodで入力バリデーション、JWTをhttpOnlyクッキー（sameSite=lax, secureは本番時）
- フロント: 関数コンポーネント、日付/時刻のユーティリティ、ルーティングは`/day/:date`と`/calendar/:date`
- UI: カレンダーは5分刻みのドラッグ移動/最小15分リサイズ、空白クリックで追加シート
