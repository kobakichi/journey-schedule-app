import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();
const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

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

// Get day schedule with items
app.get('/api/day', async (req: Request, res: Response) => {
  try {
    const dateStr = String(req.query.date || '');
    if (!dateStr) return res.status(400).json({ error: 'date is required' });
    const date = parseDateOnly(dateStr);
    const schedule = await prisma.daySchedule.findUnique({
      where: { date },
      include: { items: { orderBy: { startTime: 'asc' } } },
    });
    return res.json({ schedule });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// Upsert day schedule title/notes
app.post('/api/day', async (req: Request, res: Response) => {
  try {
    const bodySchema = z.object({
      date: z.string(),
      title: z.string().optional(),
      notes: z.string().optional(),
    });
    const body = bodySchema.parse(req.body);
    const date = parseDateOnly(body.date);
    const schedule = await prisma.daySchedule.upsert({
      where: { date },
      update: { title: body.title, notes: body.notes },
      create: { date, title: body.title, notes: body.notes },
      include: { items: { orderBy: { startTime: 'asc' } } },
    });
    return res.json({ schedule });
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
});

// Create item
app.post('/api/item', async (req: Request, res: Response) => {
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
      where: { date },
      update: {},
      create: { date },
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
app.put('/api/item/:id', async (req: Request, res: Response) => {
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
app.delete('/api/item/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'invalid id' });
    await prisma.scheduleItem.delete({ where: { id } });
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});
