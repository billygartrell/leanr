import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { workoutSets, workouts } from "../../../db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getDb();
    const [activeWorkout] = await db.select().from(workouts).where(isNull(workouts.endedAt)).orderBy(desc(workouts.id)).limit(1);
    const sets = activeWorkout ? await db.select().from(workoutSets).where(eq(workoutSets.workoutId, activeWorkout.id)).orderBy(workoutSets.id) : [];
    const bestRows = await db.select({ exercise: workoutSets.exercise, weight: sql<number>`max(${workoutSets.weight})` }).from(workoutSets).groupBy(workoutSets.exercise);
    const recentWorkouts = await db.select().from(workouts).where(sql`${workouts.endedAt} is not null`).orderBy(desc(workouts.id)).limit(12);
    return Response.json({ activeWorkout: activeWorkout || null, sets, bests: Object.fromEntries(bestRows.map((row) => [row.exercise, row.weight])), recentWorkouts });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not load workouts." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { action?: string; dayType?: string; workoutId?: number; exercise?: string; weight?: number; reps?: number };
    const db = getDb();
    if (body.action === "start") {
      if (body.dayType !== "upper" && body.dayType !== "lower") return Response.json({ error: "Choose upper or lower body." }, { status: 400 });
      const existing = await db.select({ id: workouts.id }).from(workouts).where(isNull(workouts.endedAt)).limit(1);
      if (existing.length) return Response.json({ error: "Finish your current workout first." }, { status: 409 });
      const [workout] = await db.insert(workouts).values({ dayType: body.dayType, startedAt: new Date().toISOString() }).returning();
      return Response.json({ workout }, { status: 201 });
    }
    if (body.action === "addSet") {
      if (!body.workoutId || !body.exercise?.trim() || !Number.isFinite(body.weight) || !Number.isInteger(body.reps) || body.weight! <= 0 || body.reps! <= 0) return Response.json({ error: "Enter a valid weight and rep count." }, { status: 400 });
      const active = await db.select({ id: workouts.id }).from(workouts).where(and(eq(workouts.id, body.workoutId), isNull(workouts.endedAt))).limit(1);
      if (!active.length) return Response.json({ error: "That workout is no longer active." }, { status: 409 });
      const [set] = await db.insert(workoutSets).values({ workoutId: body.workoutId, exercise: body.exercise.trim(), weight: body.weight!, reps: body.reps!, createdAt: new Date().toISOString() }).returning();
      return Response.json({ set }, { status: 201 });
    }
    if (body.action === "finish" && body.workoutId) {
      const [workout] = await db.update(workouts).set({ endedAt: new Date().toISOString() }).where(eq(workouts.id, body.workoutId)).returning();
      return workout ? Response.json({ workout }) : Response.json({ error: "Workout not found." }, { status: 404 });
    }
    return Response.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not update workout." }, { status: 500 });
  }
}
