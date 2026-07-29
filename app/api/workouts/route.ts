import { getStore } from "@netlify/blobs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type DayType = "upper" | "lower";
type Workout = { id: number; dayType: DayType; startedAt: string; endedAt: string | null };
type WorkoutSet = { id: number; workoutId: number; exercise: string; weight: number; reps: number; createdAt: string };
type TrainingData = { workouts: Workout[]; sets: WorkoutSet[] };

const EMPTY_DATA: TrainingData = { workouts: [], sets: [] };
const DATA_KEY = "training-data";

function store() {
  return getStore({ name: "setmark-workouts", consistency: "strong" });
}

async function readData(): Promise<TrainingData> {
  return (await store().get(DATA_KEY, { type: "json" })) as TrainingData | null ?? structuredClone(EMPTY_DATA);
}

async function writeData(data: TrainingData) {
  await store().setJSON(DATA_KEY, data);
}

function dashboard(data: TrainingData) {
  const activeWorkout = [...data.workouts].reverse().find((workout) => !workout.endedAt) ?? null;
  const sets = activeWorkout ? data.sets.filter((set) => set.workoutId === activeWorkout.id) : [];
  const bests = data.sets.reduce<Record<string, number>>((result, set) => {
    result[set.exercise] = Math.max(result[set.exercise] ?? 0, set.weight);
    return result;
  }, {});
  const recentWorkouts = data.workouts.filter((workout) => workout.endedAt).slice(-12).reverse();
  return { activeWorkout, sets, bests, recentWorkouts };
}

export async function GET() {
  try {
    return Response.json(dashboard(await readData()), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not load workouts." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { action?: string; dayType?: string; workoutId?: number; exercise?: string; weight?: number; reps?: number };
    const data = await readData();

    if (body.action === "start") {
      if (body.dayType !== "upper" && body.dayType !== "lower") return Response.json({ error: "Choose upper or lower body." }, { status: 400 });
      if (data.workouts.some((workout) => !workout.endedAt)) return Response.json({ error: "Finish your current workout first." }, { status: 409 });
      const workout: Workout = { id: Date.now(), dayType: body.dayType, startedAt: new Date().toISOString(), endedAt: null };
      data.workouts.push(workout);
      await writeData(data);
      return Response.json({ workout }, { status: 201 });
    }

    if (body.action === "addSet") {
      if (!body.workoutId || !body.exercise?.trim() || !Number.isFinite(body.weight) || !Number.isInteger(body.reps) || body.weight! <= 0 || body.reps! <= 0) return Response.json({ error: "Enter a valid weight and rep count." }, { status: 400 });
      if (!data.workouts.some((workout) => workout.id === body.workoutId && !workout.endedAt)) return Response.json({ error: "That workout is no longer active." }, { status: 409 });
      const set: WorkoutSet = { id: Date.now(), workoutId: body.workoutId, exercise: body.exercise.trim(), weight: body.weight!, reps: body.reps!, createdAt: new Date().toISOString() };
      data.sets.push(set);
      await writeData(data);
      return Response.json({ set }, { status: 201 });
    }

    if (body.action === "finish" && body.workoutId) {
      const workout = data.workouts.find((item) => item.id === body.workoutId);
      if (!workout) return Response.json({ error: "Workout not found." }, { status: 404 });
      workout.endedAt = new Date().toISOString();
      await writeData(data);
      return Response.json({ workout });
    }

    if (body.action === "cancel" && body.workoutId) {
      const workoutIndex = data.workouts.findIndex((item) => item.id === body.workoutId && !item.endedAt);
      if (workoutIndex === -1) return Response.json({ error: "Active workout not found." }, { status: 404 });
      data.workouts.splice(workoutIndex, 1);
      data.sets = data.sets.filter((set) => set.workoutId !== body.workoutId);
      await writeData(data);
      return Response.json({ cancelled: true });
    }

    return Response.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not update workout." }, { status: 500 });
  }
}
