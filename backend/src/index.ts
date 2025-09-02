import 'dotenv/config';
import express, { type Request, type Response, NextFunction } from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';

const prisma = new PrismaClient();
const app = express();
app.use(cors());
app.use(express.json());
app.use(cookieParser());

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// Helpers
const parseDateOnly = (dateStr: string) => {
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) throw new Error('Invalid date');
  return d;
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
    const user = await prisma.user.upsert({
      where: { googleId },
      update: { email: email || undefined, name: name || undefined, avatarUrl: avatarUrl || undefined },
      create: { googleId, email, name, avatarUrl },
      select: { id: true, email: true, name: true, avatarUrl: true },
    });
    const token = jwt.sign({ uid: user.id }, JWT_SECRET, { expiresIn: '30d' });
    res.cookie('session', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 30*24*60*60*1000 });
    return res.json({ user });
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
});

app.get('/api/me', async (req: Request & { user?: ReqUser }, res: Response) => {
  if (!req.user) return res.json({ user: null });
  const user = await prisma.user.findUnique({ where: { id: req.user.userId }, select: { id: true, email: true, name: true, avatarUrl: true } });
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
    const date = parseDateOnly(dateStr);
    const schedule = await prisma.daySchedule.findUnique({
      where: { userId_date: { userId: req.user!.userId, date } },
      include: { items: { orderBy: { startTime: 'asc' } } },
    });
    return res.json({ schedule });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// Upsert day schedule title/notes
app.post('/api/day', ensureAuth, async (req: Request & { user?: ReqUser }, res: Response) => {
  try {
    const bodySchema = z.object({
      date: z.string(),
      title: z.string().optional(),
      notes: z.string().optional(),
    });
    const body = bodySchema.parse(req.body);
    const date = parseDateOnly(body.date);
    const schedule = await prisma.daySchedule.upsert({
      where: { userId_date: { userId: req.user!.userId, date } },
      update: { title: body.title, notes: body.notes },
      create: { date, title: body.title, notes: body.notes, userId: req.user!.userId },
      include: { items: { orderBy: { startTime: 'asc' } } },
    });
    return res.json({ schedule });
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
});

// Create item
app.post('/api/item', ensureAuth, async (req: Request & { user?: ReqUser }, res: Response) => {
  try {
    const bodySchema = z.object({
      date: z.string(),
      title: z.string().min(1),
      emoji: z.string().optional(),
      color: z.string().optional(),
      startTime: z.string(), // HH:mm
      endTime: z.string().optional(),
      location: z.string().optional(),
      kind: z.enum(['GENERAL','MOVE','general','move']).optional(),
      departurePlace: z.string().optional(),
      arrivalPlace: z.string().optional(),
      notes: z.string().optional(),
    });
    const body = bodySchema.parse(req.body);
    const date = parseDateOnly(body.date);
    const start = new Date(`${body.date}T${body.startTime}:00`);
    const end = body.endTime ? new Date(`${body.date}T${body.endTime}:00`) : null;
    const kind = (body.kind || 'GENERAL').toUpperCase() as 'GENERAL' | 'MOVE';
    const schedule = await prisma.daySchedule.upsert({
      where: { userId_date: { userId: req.user!.userId, date } },
      update: {},
      create: { date, userId: req.user!.userId },
    });
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
    return res.status(400).json({ error: e.message });
  }
});

// Update item
app.put('/api/item/:id', ensureAuth, async (req: Request & { user?: ReqUser }, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'invalid id' });
    const bodySchema = z.object({
      title: z.string().min(1).optional(),
      emoji: z.string().optional(),
      color: z.string().optional(),
      startTime: z.string().optional(), // HH:mm
      endTime: z.string().optional(),
      date: z.string().optional(),
      location: z.string().optional(),
      kind: z.enum(['GENERAL','MOVE','general','move']).optional(),
      departurePlace: z.string().optional(),
      arrivalPlace: z.string().optional(),
      notes: z.string().optional(),
    });
    const body = bodySchema.parse(req.body);
    let start: Date | undefined;
    let end: Date | null | undefined;
    if (body.startTime && body.date) start = new Date(`${body.date}T${body.startTime}:00`);
    if (body.endTime && body.date) end = new Date(`${body.date}T${body.endTime}:00`);
    // ownership check
    const existing = await prisma.scheduleItem.findUnique({ where: { id }, include: { schedule: { select: { userId: true } } } });
    if (!existing || existing.schedule.userId !== req.user!.userId) return res.status(404).json({ error: 'not found' });
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
    return res.status(400).json({ error: e.message });
  }
});

// Delete item
app.delete('/api/item/:id', ensureAuth, async (req: Request & { user?: ReqUser }, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'invalid id' });
    const existing = await prisma.scheduleItem.findUnique({ where: { id }, include: { schedule: { select: { userId: true } } } });
    if (!existing || existing.schedule.userId !== req.user!.userId) return res.status(404).json({ error: 'not found' });
    await prisma.scheduleItem.delete({ where: { id } });
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});
