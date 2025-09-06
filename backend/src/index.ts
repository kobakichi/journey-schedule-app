import 'dotenv/config';
import express, { type Request, type Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import crypto from 'crypto';

const prisma = new PrismaClient();
const app = express();

// Security headers
app.use(helmet({ contentSecurityPolicy: false }));

// CORS (strict): allow specific origins and send credentials (cookies)
const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({ origin: (origin, cb) => {
  if (!origin) return cb(null, true); // allow non-browser or same-origin
  cb(null, ALLOWED_ORIGINS.includes(origin));
}, credentials: true }));

app.use(express.json({ limit: '256kb' }));
app.use(cookieParser());

// Rate limiting
const apiLimiter = rateLimit({ windowMs: 60_000, max: 200, standardHeaders: true, legacyHeaders: false });
app.use('/api/', apiLimiter);
const authLimiter = rateLimit({ windowMs: 5 * 60_000, max: 20, standardHeaders: true, legacyHeaders: false });
app.use('/api/auth/', authLimiter);
const inviteLimiter = rateLimit({ windowMs: 10 * 60_000, max: 30, standardHeaders: true, legacyHeaders: false });
app.use('/api/share/day/invite', inviteLimiter);

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// Enforce secret in production
if (process.env.NODE_ENV === 'production' && JWT_SECRET === 'dev-secret') {
  throw new Error('JWT_SECRET must be set in production');
}

// Helper: sanitize error message in production
function errorMessage(e: any, fallback: string = 'bad_request'){
  const msg = (e && (e.message || e.error)) ? String(e.message || e.error) : fallback;
  return process.env.NODE_ENV === 'production' ? fallback : msg;
}

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// Helpers
function base62(n: number) {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let s = '';
  do { s = chars[n % 62] + s; n = Math.floor(n / 62); } while (n > 0);
  return s;
}
async function generateUniqueSlug(): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const bytes = crypto.randomBytes(6); // 48 bits ~ 8 base62 chars
    const val = bytes.readUIntBE(0, 6);
    const slug = base62(val).padStart(8, '0');
    const existing = await prisma.user.findFirst({ where: { publicSlug: slug }, select: { id: true } });
    if (!existing) return slug;
  }
  // fallback to longer slug
  return crypto.randomBytes(12).toString('hex');
}
// YYYY-MM-DD をサーバー環境のタイムゾーンに依存せず UTC の 00:00 として解釈
const parseDateOnlyUTC = (dateStr: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr));
  if (!m) throw new Error('Invalid date');
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo, d, 0, 0, 0, 0));
  return dt;
};

// YYYY-MM-DD + HH:mm を UTC として Date を生成（サーバーのローカルTZに依存しない）
const utcDateTimeFrom = (dateStr: string, hhmm: string) => {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateStr));
  const tm = /^(\d{2}):(\d{2})$/.exec(String(hhmm));
  if (!dm || !tm) throw new Error('Invalid date/time');
  const y = Number(dm[1]); const mo = Number(dm[2]) - 1; const d = Number(dm[3]);
  const h = Number(tm[1]); const mi = Number(tm[2]);
  return new Date(Date.UTC(y, mo, d, h, mi, 0, 0));
};

type ReqUser = { userId: number } | undefined;
function authOptional(req: Request & { user?: ReqUser }, _res: Response, next: NextFunction) {
  const token = req.cookies?.session;
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as { uid: number };
      req.user = { userId: payload.uid };
    } catch {}
  }
  next();
}
function ensureAuth(req: Request & { user?: ReqUser }, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'unauthorized' });
  next();
}

app.use(authOptional);

// Auth routes
app.post('/api/auth/google', async (req: Request, res: Response) => {
  try {
    const schema = z.object({ idToken: z.string().min(10) });
    const { idToken } = schema.parse(req.body);
    const ticket = await googleClient.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    if (!payload) return res.status(400).json({ error: 'invalid token' });
    const googleId = payload.sub!;
    const email = payload.email || null;
    const name = payload.name || null;
    const avatarUrl = payload.picture || null;
    let user = await prisma.user.upsert({
      where: { googleId },
      update: { email: email || undefined, name: name || undefined, avatarUrl: avatarUrl || undefined },
      create: { googleId, email, name, avatarUrl },
      select: { id: true, email: true, name: true, avatarUrl: true, publicSlug: true },
    });
    if (!user.publicSlug) {
      const slug = await generateUniqueSlug();
      user = await prisma.user.update({ where: { id: user.id }, data: { publicSlug: slug }, select: { id: true, email: true, name: true, avatarUrl: true, publicSlug: true } });
    }
    const token = jwt.sign({ uid: user.id }, JWT_SECRET, { expiresIn: '30d' });
    res.cookie('session', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 30*24*60*60*1000 });
    return res.json({ user });
  } catch (e: any) {
    return res.status(400).json({ error: errorMessage(e) });
  }
});

app.get('/api/me', async (req: Request & { user?: ReqUser }, res: Response) => {
  if (!req.user) return res.json({ user: null });
  const user = await prisma.user.findUnique({ where: { id: req.user.userId }, select: { id: true, email: true, name: true, avatarUrl: true, publicSlug: true } });
  return res.json({ user });
});

app.post('/api/logout', (req: Request, res: Response) => {
  res.clearCookie('session');
  res.json({ ok: true });
});

// Get day schedule with items
app.get('/api/day', ensureAuth, async (req: Request & { user?: ReqUser }, res: Response) => {
  try {
    const dateStr = String(req.query.date || '');
    if (!dateStr) return res.status(400).json({ error: 'date is required' });
    const date = parseDateOnlyUTC(dateStr);
    const ownerIdParam = req.query.ownerId ? Number(req.query.ownerId) : undefined;
    const ownerSlugParam = req.query.owner ? String(req.query.owner) : undefined;
    const requesterId = req.user!.userId;

    if ((!ownerIdParam && !ownerSlugParam) || ownerIdParam === requesterId) {
      const schedule = await prisma.daySchedule.findUnique({
        where: { userId_date: { userId: requesterId, date } },
        include: { items: { orderBy: { startTime: 'asc' } } },
      });
      return res.json({ schedule });
    }

    // 他人のスケジュールを閲覧する場合は共有チェック（ownerId または owner(slug)）
    let targetOwnerId = ownerIdParam;
    if (!targetOwnerId && ownerSlugParam) {
      const target = await prisma.user.findFirst({ where: { publicSlug: ownerSlugParam }, select: { id: true } });
      targetOwnerId = target?.id;
    }
    if (!targetOwnerId) return res.json({ schedule: null });
    const schedule = await prisma.daySchedule.findUnique({
      where: { userId_date: { userId: targetOwnerId, date } },
      include: { items: { orderBy: { startTime: 'asc' } }, shares: { where: { sharedWithUserId: requesterId } } },
    });
    if (!schedule) return res.json({ schedule: null });
    const shared = schedule.shares[0];
    if (!shared) return res.status(403).json({ error: 'forbidden' });
    // include.shares を外して返却
    const { shares, ...rest } = schedule as any;
    return res.json({ schedule: rest });
  } catch (e: any) {
    return res.status(500).json({ error: errorMessage(e, 'internal_error') });
  }
});

// Upsert day schedule title/notes
app.post('/api/day', ensureAuth, async (req: Request & { user?: ReqUser }, res: Response) => {
  try {
    const bodySchema = z.object({
      date: z.string(),
      title: z.string().max(120).optional(),
      notes: z.string().max(2000).optional(),
    });
    const body = bodySchema.parse(req.body);
    const date = parseDateOnlyUTC(body.date);
    const schedule = await prisma.daySchedule.upsert({
      where: { userId_date: { userId: req.user!.userId, date } },
      update: { title: body.title, notes: body.notes },
      create: { date, title: body.title, notes: body.notes, userId: req.user!.userId },
      include: { items: { orderBy: { startTime: 'asc' } } },
    });
    return res.json({ schedule });
  } catch (e: any) {
    return res.status(400).json({ error: errorMessage(e) });
  }
});

// Create item
app.post('/api/item', ensureAuth, async (req: Request & { user?: ReqUser }, res: Response) => {
  try {
    const bodySchema = z.object({
      date: z.string(),
      title: z.string().min(1).max(120),
      emoji: z.string().max(16).optional(),
      color: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional(),
      startTime: z.string(), // HH:mm
      endTime: z.string().optional(),
      location: z.string().max(200).optional(),
      kind: z.enum(['GENERAL','MOVE','general','move']).optional(),
      departurePlace: z.string().max(200).optional(),
      arrivalPlace: z.string().max(200).optional(),
      notes: z.string().max(2000).optional(),
      ownerId: z.number().optional(),
      ownerSlug: z.string().max(64).optional(),
    });
    const body = bodySchema.parse(req.body);
    const date = parseDateOnlyUTC(body.date);
    const start = utcDateTimeFrom(body.date, body.startTime);
    const end = body.endTime ? utcDateTimeFrom(body.date, body.endTime) : null;
    const kind = (body.kind || 'GENERAL').toUpperCase() as 'GENERAL' | 'MOVE';
    const requesterId = req.user!.userId;
    let targetOwnerId = (body.ownerId && body.ownerId !== requesterId) ? body.ownerId : requesterId;
    if (body.ownerSlug && body.ownerSlug.length > 0) {
      const target = await prisma.user.findFirst({ where: { publicSlug: body.ownerSlug }, select: { id: true } });
      if (target && target.id !== requesterId) targetOwnerId = target.id;
    }

    let schedule = await prisma.daySchedule.findUnique({ where: { userId_date: { userId: targetOwnerId, date } } });
    if (!schedule) {
      if (targetOwnerId !== requesterId) {
        return res.status(404).json({ error: 'schedule not found' });
      }
      schedule = await prisma.daySchedule.create({ data: { date, userId: requesterId } });
    }
    if (targetOwnerId !== requesterId) {
      // 共有の編集権限チェック
      const share = await prisma.scheduleShare.findUnique({ where: { scheduleId_sharedWithUserId: { scheduleId: schedule.id, sharedWithUserId: requesterId } } }).catch(async () => {
        return await prisma.scheduleShare.findFirst({ where: { scheduleId: schedule!.id, sharedWithUserId: requesterId } });
      });
      if (!share || !share.canEdit) return res.status(403).json({ error: 'forbidden' });
    }
    const item = await prisma.scheduleItem.create({
      data: {
        scheduleId: schedule.id,
        title: body.title,
        emoji: body.emoji,
        color: body.color,
        startTime: start,
        endTime: end,
        location: body.location,
        kind,
        departurePlace: body.departurePlace,
        arrivalPlace: body.arrivalPlace,
        notes: body.notes,
      },
    });
    return res.json({ item });
  } catch (e: any) {
    return res.status(400).json({ error: errorMessage(e) });
  }
});

// Update item
app.put('/api/item/:id', ensureAuth, async (req: Request & { user?: ReqUser }, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'invalid id' });
    const bodySchema = z.object({
      title: z.string().min(1).max(120).optional(),
      emoji: z.string().max(16).optional(),
      color: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/).optional(),
      startTime: z.string().optional(), // HH:mm
      endTime: z.string().optional(),
      date: z.string().optional(),
      location: z.string().max(200).optional(),
      kind: z.enum(['GENERAL','MOVE','general','move']).optional(),
      departurePlace: z.string().max(200).optional(),
      arrivalPlace: z.string().max(200).optional(),
      notes: z.string().max(2000).optional(),
    });
    const body = bodySchema.parse(req.body);
    let start: Date | undefined;
    let end: Date | null | undefined;
    if (body.startTime && body.date) start = utcDateTimeFrom(body.date, body.startTime);
    if (body.endTime && body.date) end = utcDateTimeFrom(body.date, body.endTime);
    // ownership or share-edit check
    const existing = await prisma.scheduleItem.findUnique({ where: { id }, include: { schedule: { select: { userId: true, id: true } } } });
    if (!existing) return res.status(404).json({ error: 'not found' });
    const ownerId = existing.schedule.userId;
    const requesterId = req.user!.userId;
    if (ownerId !== requesterId) {
      const share = await prisma.scheduleShare.findFirst({ where: { scheduleId: existing.schedule.id, sharedWithUserId: requesterId } });
      if (!share || !share.canEdit) return res.status(403).json({ error: 'forbidden' });
    }
    const item = await prisma.scheduleItem.update({
      where: { id },
      data: {
        title: body.title,
        emoji: body.emoji,
        color: body.color,
        startTime: start,
        endTime: end,
        location: body.location,
        kind: body.kind ? (body.kind.toUpperCase() as 'GENERAL' | 'MOVE') : undefined,
        departurePlace: body.departurePlace,
        arrivalPlace: body.arrivalPlace,
        notes: body.notes,
      },
    });
    return res.json({ item });
  } catch (e: any) {
    return res.status(400).json({ error: errorMessage(e) });
  }
});

// Delete item
app.delete('/api/item/:id', ensureAuth, async (req: Request & { user?: ReqUser }, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'invalid id' });
    const existing = await prisma.scheduleItem.findUnique({ where: { id }, include: { schedule: { select: { userId: true, id: true } } } });
    if (!existing) return res.status(404).json({ error: 'not found' });
    const ownerId = existing.schedule.userId;
    const requesterId = req.user!.userId;
    if (ownerId !== requesterId) {
      const share = await prisma.scheduleShare.findFirst({ where: { scheduleId: existing.schedule.id, sharedWithUserId: requesterId } });
      if (!share || !share.canEdit) return res.status(403).json({ error: 'forbidden' });
    }
    await prisma.scheduleItem.delete({ where: { id } });
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(400).json({ error: errorMessage(e) });
  }
});

// 共有: 指定日の共有一覧（オーナー用）
app.get('/api/share/day', ensureAuth, async (req: Request & { user?: ReqUser }, res: Response) => {
  try {
    const dateStr = String(req.query.date || '');
    if (!dateStr) return res.status(400).json({ error: 'date is required' });
    const date = parseDateOnlyUTC(dateStr);
    const ownerId = req.user!.userId;
    const schedule = await prisma.daySchedule.findUnique({ where: { userId_date: { userId: ownerId, date } } });
    if (!schedule) return res.json({ shares: [] });
    const shares = await prisma.scheduleShare.findMany({
      where: { scheduleId: schedule.id },
      select: { id: true, canEdit: true, sharedWithUserId: true, sharedWith: { select: { id: true, email: true, name: true } } },
      orderBy: { id: 'asc' }
    });
    return res.json({ shares });
  } catch (e: any) {
    return res.status(400).json({ error: errorMessage(e) });
  }
});

// 共有: 指定日の共有追加/更新（オーナー用）
app.post('/api/share/day', ensureAuth, async (req: Request & { user?: ReqUser }, res: Response) => {
  try {
    const bodySchema = z.object({ date: z.string(), email: z.string().email().max(320), canEdit: z.boolean().optional() });
    const body = bodySchema.parse(req.body);
    const date = parseDateOnlyUTC(body.date);
    const ownerId = req.user!.userId;
    const target = await prisma.user.findUnique({ where: { email: body.email } });
    if (!target) return res.status(404).json({ error: 'user not found (先に相手のログインが必要です)' });
    const schedule = await prisma.daySchedule.upsert({
      where: { userId_date: { userId: ownerId, date } },
      update: {},
      create: { userId: ownerId, date },
    });
    const share = await prisma.scheduleShare.upsert({
      where: { scheduleId_sharedWithUserId: { scheduleId: schedule.id, sharedWithUserId: target.id } },
      update: { canEdit: body.canEdit ?? false },
      create: { scheduleId: schedule.id, sharedWithUserId: target.id, canEdit: body.canEdit ?? false },
      select: { id: true, canEdit: true, sharedWithUserId: true },
    });
    return res.json({ share });
  } catch (e: any) {
    return res.status(400).json({ error: errorMessage(e) });
  }
});

// 共有: 指定日の共有削除（オーナー用）
app.delete('/api/share/day', ensureAuth, async (req: Request & { user?: ReqUser }, res: Response) => {
  try {
    const schema = z.object({ date: z.string(), userId: z.number().int().positive() });
    const q = schema.parse({ date: req.query.date, userId: req.query.userId ? Number(req.query.userId) : undefined });
    const date = parseDateOnlyUTC(q.date);
    const ownerId = req.user!.userId;
    const schedule = await prisma.daySchedule.findUnique({ where: { userId_date: { userId: ownerId, date } } });
    if (!schedule) return res.status(404).json({ error: 'schedule not found' });
    await prisma.scheduleShare.deleteMany({ where: { scheduleId: schedule.id, sharedWithUserId: q.userId } });
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(400).json({ error: errorMessage(e) });
  }
});

// 共有: 自分に共有されている（指定日）のオーナー一覧
app.get('/api/shared/day/list', ensureAuth, async (req: Request & { user?: ReqUser }, res: Response) => {
  try {
    const dateStr = String(req.query.date || '');
    if (!dateStr) return res.status(400).json({ error: 'date is required' });
    const date = parseDateOnlyUTC(dateStr);
    const me = req.user!.userId;
    const schedules = await prisma.daySchedule.findMany({
      where: { date, shares: { some: { sharedWithUserId: me } } },
      select: { userId: true, user: { select: { id: true, email: true, name: true } } },
      orderBy: { userId: 'asc' }
    });
    const owners = schedules.map(s => s.user);
    return res.json({ owners });
  } catch (e: any) {
    return res.status(400).json({ error: errorMessage(e) });
  }
});

// 招待リンクの作成（オーナー用）
app.post('/api/share/day/invite', ensureAuth, async (req: Request & { user?: ReqUser }, res: Response) => {
  try {
    const schema = z.object({ date: z.string(), canEdit: z.boolean().optional(), email: z.string().email().max(320).optional(), ttlHours: z.number().int().positive().max(24*90).optional() });
    const body = schema.parse(req.body);
    const date = parseDateOnlyUTC(body.date);
    const ownerId = req.user!.userId;
    const schedule = await prisma.daySchedule.upsert({ where: { userId_date: { userId: ownerId, date } }, update: {}, create: { userId: ownerId, date } });
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = body.ttlHours ? new Date(Date.now() + body.ttlHours*60*60*1000) : new Date(Date.now() + 14*24*60*60*1000);
    const invite = await prisma.scheduleShareInvite.create({ data: { scheduleId: schedule.id, token, invitedEmail: body.email, canEdit: body.canEdit ?? false, expiresAt } });
    return res.json({ invite: { id: invite.id, token: invite.token, canEdit: invite.canEdit, invitedEmail: invite.invitedEmail, expiresAt: invite.expiresAt } });
  } catch (e: any) {
    return res.status(400).json({ error: errorMessage(e) });
  }
});

// 招待リンク一覧（オーナー用）
app.get('/api/share/day/invites', ensureAuth, async (req: Request & { user?: ReqUser }, res: Response) => {
  try {
    const dateStr = String(req.query.date || '');
    if (!dateStr) return res.status(400).json({ error: 'date is required' });
    const date = parseDateOnlyUTC(dateStr);
    const ownerId = req.user!.userId;
    const schedule = await prisma.daySchedule.findUnique({ where: { userId_date: { userId: ownerId, date } } });
    if (!schedule) return res.json({ invites: [] });
    const invites = await prisma.scheduleShareInvite.findMany({ where: { scheduleId: schedule.id }, orderBy: { id: 'desc' }, select: { id: true, token: true, invitedEmail: true, canEdit: true, expiresAt: true, redeemedAt: true, redeemedByUserId: true } });
    return res.json({ invites });
  } catch (e: any) { return res.status(400).json({ error: errorMessage(e) }); }
});

// 招待リンクの無効化（オーナー用）
app.delete('/api/share/day/invite/:id', ensureAuth, async (req: Request & { user?: ReqUser }, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'invalid id' });
    const invite = await prisma.scheduleShareInvite.findUnique({ where: { id }, include: { schedule: { select: { userId: true } } } });
    if (!invite || invite.schedule.userId !== req.user!.userId) return res.status(404).json({ error: 'not found' });
    await prisma.scheduleShareInvite.delete({ where: { id } });
    return res.json({ ok: true });
  } catch (e: any) { return res.status(400).json({ error: errorMessage(e) }); }
});

// 招待メタデータ取得（認証不要）
app.get('/api/share/invite/:token', async (req: Request, res: Response) => {
  try {
    const token = String(req.params.token || '');
    if (!token) return res.status(400).json({ error: 'invalid token' });
    const inv = await prisma.scheduleShareInvite.findUnique({ where: { token }, include: { schedule: { select: { userId: true, date: true, user: { select: { id: true, name: true, email: true } } } } } });
    if (!inv) return res.status(404).json({ error: 'not found' });
    const now = new Date();
    const expired = !!(inv.expiresAt && inv.expiresAt < now);
    return res.json({ invite: { token: inv.token, invitedEmail: inv.invitedEmail, canEdit: inv.canEdit, expiresAt: inv.expiresAt, redeemedAt: inv.redeemedAt, owner: inv.schedule.user, date: inv.schedule.date, expired } });
  } catch (e: any) { return res.status(400).json({ error: errorMessage(e) }); }
});

// 招待受諾（認証必須）
app.post('/api/share/invite/:token/accept', ensureAuth, async (req: Request & { user?: ReqUser }, res: Response) => {
  try {
    const token = String(req.params.token || '');
    if (!token) return res.status(400).json({ error: 'invalid token' });
    const inv = await prisma.scheduleShareInvite.findUnique({ where: { token }, include: { schedule: true } });
    if (!inv) return res.status(404).json({ error: 'not found' });
    const now = new Date();
    if (inv.expiresAt && inv.expiresAt < now) return res.status(410).json({ error: 'expired' });
    const me = req.user!.userId;
    if (inv.redeemedAt && inv.redeemedByUserId && inv.redeemedByUserId !== me) {
      return res.status(409).json({ error: 'already redeemed' });
    }
    // if invitedEmail specified, ensure matches current user's email
    if (inv.invitedEmail) {
      const u = await prisma.user.findUnique({ where: { id: me }, select: { email: true } });
      if (!u?.email || u.email.toLowerCase() !== inv.invitedEmail.toLowerCase()) {
        return res.status(403).json({ error: 'email mismatch' });
      }
    }
    // Grant share
    await prisma.scheduleShare.upsert({
      where: { scheduleId_sharedWithUserId: { scheduleId: inv.scheduleId, sharedWithUserId: me } },
      update: { canEdit: inv.canEdit },
      create: { scheduleId: inv.scheduleId, sharedWithUserId: me, canEdit: inv.canEdit },
    });
    // Mark invite as redeemed
    await prisma.scheduleShareInvite.update({ where: { id: inv.id }, data: { redeemedAt: now, redeemedByUserId: me } });
    return res.json({ ok: true, ownerId: inv.schedule.userId, date: inv.schedule.date });
  } catch (e: any) { return res.status(400).json({ error: errorMessage(e) }); }
});

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});
