import { getStore } from "@netlify/blobs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type DayType = "upper" | "lower" | "full" | "cardio";
type Effort = "maxed" | "challenging" | "moderate" | "easy";
type Workout = { id: number; dayType: DayType; startedAt: string; endedAt: string | null };
type WorkoutSet = { id: number; workoutId: number; exercise: string; weight: number; reps: number; createdAt: string };
type ExerciseEffort = { workoutId: number; exercise: string; effort: Effort };
type TrainingData = { workouts: Workout[]; sets: WorkoutSet[]; efforts: ExerciseEffort[] };

const PROFILE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f-]{27}$/i;
const DAY_TYPES: DayType[] = ["upper", "lower", "full", "cardio"];

function store() {
  return getStore({ name: "setmark-workouts", consistency: "strong" });
}

function profileId(request: Request) {
  const id = request.headers.get("x-profile-id") ?? "";
  return PROFILE_ID_PATTERN.test(id) ? id : null;
}

async function readData(id: string): Promise<TrainingData> {
  const saved = (await store().get(`training-data:${id}`, { type: "json" })) as Partial<TrainingData> | null;
  return { workouts: saved?.workouts ?? [], sets: saved?.sets ?? [], efforts: saved?.efforts ?? [] };
}

async function writeData(id: string, data: TrainingData) {
  await store().setJSON(`training-data:${id}`, data);
}

function dashboard(data: TrainingData) {
  const activeWorkout = [...data.workouts].reverse().find((workout) => !workout.endedAt) ?? null;
  const sets = activeWorkout ? data.sets.filter((set) => set.workoutId === activeWorkout.id) : [];
  const efforts = activeWorkout ? Object.fromEntries(data.efforts.filter((item) => item.workoutId === activeWorkout.id).map((item) => [item.exercise, item.effort])) : {};
  const bests = data.sets.reduce<Record<string, number>>((result, set) => {
    result[set.exercise] = Math.max(result[set.exercise] ?? 0, set.weight);
    return result;
  }, {});
  const lastWeights = data.sets.reduce<Record<string, number>>((result, set) => {
    result[set.exercise] = set.weight;
    return result;
  }, {});
  const recentWorkouts = data.workouts.filter((workout) => workout.endedAt).slice(-20).reverse().map((workout) => ({
    ...workout,
    setCount: data.sets.filter((set) => set.workoutId === workout.id).length,
  }));
  return { activeWorkout, sets, efforts, bests, lastWeights, recentWorkouts };
}

export async function GET(request: Request) {
  try {
    const id = profileId(request);
    if (!id) return Response.json({ error: "Choose a profile first." }, { status: 401 });
    const data = await readData(id);
    const workoutId = Number(new URL(request.url).searchParams.get("workoutId"));
    if (workoutId) {
      const workout = data.workouts.find((item) => item.id === workoutId);
      if (!workout) return Response.json({ error: "Workout not found." }, { status: 404 });
      const sets = data.sets.filter((set) => set.workoutId === workoutId);
      const efforts = Object.fromEntries(data.efforts.filter((item) => item.workoutId === workoutId).map((item) => [item.exercise, item.effort]));
      return Response.json({ workout, sets, efforts }, { headers: { "Cache-Control": "no-store" } });
    }
    return Response.json(dashboard(data), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not load workouts." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const id = profileId(request);
    if (!id) return Response.json({ error: "Choose a profile first." }, { status: 401 });
    const body = await request.json() as { action?: string; dayType?: string; startedAt?: string; workoutId?: number; setId?: number; exercise?: string; weight?: number; reps?: number; effort?: string };
    const data = await readData(id);

    if (body.action === "start") {
      if (!DAY_TYPES.includes(body.dayType as DayType)) return Response.json({ error: "Choose a valid workout type." }, { status: 400 });
      if (data.workouts.some((workout) => !workout.endedAt)) return Response.json({ error: "Finish your current workout first." }, { status: 409 });
      const workout: Workout = { id: Date.now(), dayType: body.dayType as DayType, startedAt: new Date().toISOString(), endedAt: null };
      data.workouts.push(workout);
      await writeData(id, data);
      return Response.json({ workout }, { status: 201 });
    }

    if (body.action === "addSet") {
      if (!body.workoutId || !body.exercise?.trim() || !Number.isFinite(body.weight) || !Number.isInteger(body.reps) || body.weight! <= 0 || body.reps! <= 0) return Response.json({ error: "Enter a valid weight and rep count." }, { status: 400 });
      if (!data.workouts.some((workout) => workout.id === body.workoutId && !workout.endedAt)) return Response.json({ error: "That workout is no longer active." }, { status: 409 });
      const set: WorkoutSet = { id: Date.now(), workoutId: body.workoutId, exercise: body.exercise.trim(), weight: body.weight!, reps: body.reps!, createdAt: new Date().toISOString() };
      data.sets.push(set);
      await writeData(id, data);
      return Response.json({ set }, { status: 201 });
    }

    if (body.action === "setEffort") {
      const validEfforts: Effort[] = ["maxed", "challenging", "moderate", "easy"];
      if (!body.workoutId || !body.exercise?.trim() || !validEfforts.includes(body.effort as Effort)) return Response.json({ error: "Choose a valid effort level." }, { status: 400 });
      if (!data.workouts.some((workout) => workout.id === body.workoutId)) return Response.json({ error: "Workout not found." }, { status: 404 });
      const existing = data.efforts.find((item) => item.workoutId === body.workoutId && item.exercise === body.exercise);
      if (existing) existing.effort = body.effort as Effort;
      else data.efforts.push({ workoutId: body.workoutId, exercise: body.exercise, effort: body.effort as Effort });
      await writeData(id, data);
      return Response.json({ effort: body.effort });
    }

    if (body.action === "removeSet") {
      if (!body.workoutId || !body.setId) return Response.json({ error: "Set not found." }, { status: 400 });
      if (!data.workouts.some((workout) => workout.id === body.workoutId)) return Response.json({ error: "Workout not found." }, { status: 404 });
      const setIndex = data.sets.findIndex((set) => set.id === body.setId && set.workoutId === body.workoutId);
      if (setIndex === -1) return Response.json({ error: "Set not found." }, { status: 404 });
      data.sets.splice(setIndex, 1);
      await writeData(id, data);
      return Response.json({ removed: true });
    }

    if (body.action === "updateSet") {
      if (!body.workoutId || !body.setId || !Number.isFinite(body.weight) || !Number.isInteger(body.reps) || body.weight! <= 0 || body.reps! <= 0) return Response.json({ error: "Enter a valid weight and rep count." }, { status: 400 });
      const set = data.sets.find((item) => item.id === body.setId && item.workoutId === body.workoutId);
      if (!set) return Response.json({ error: "Set not found." }, { status: 404 });
      set.weight = body.weight!;
      set.reps = body.reps!;
      await writeData(id, data);
      return Response.json({ set });
    }

    if (body.action === "updateWorkout") {
      if (!body.workoutId || !DAY_TYPES.includes(body.dayType as DayType) || !body.startedAt || Number.isNaN(Date.parse(body.startedAt))) return Response.json({ error: "Enter valid session details." }, { status: 400 });
      const workout = data.workouts.find((item) => item.id === body.workoutId);
      if (!workout) return Response.json({ error: "Workout not found." }, { status: 404 });
      workout.dayType = body.dayType as DayType;
      workout.startedAt = new Date(body.startedAt).toISOString();
      await writeData(id, data);
      return Response.json({ workout });
    }

    if (body.action === "finish" && body.workoutId) {
      const workout = data.workouts.find((item) => item.id === body.workoutId);
      if (!workout) return Response.json({ error: "Workout not found." }, { status: 404 });
      workout.endedAt = new Date().toISOString();
      await writeData(id, data);
      return Response.json({ workout });
    }

    if (body.action === "cancel" && body.workoutId) {
      const workoutIndex = data.workouts.findIndex((item) => item.id === body.workoutId && !item.endedAt);
      if (workoutIndex === -1) return Response.json({ error: "Active workout not found." }, { status: 404 });
      data.workouts.splice(workoutIndex, 1);
      data.sets = data.sets.filter((set) => set.workoutId !== body.workoutId);
      data.efforts = data.efforts.filter((item) => item.workoutId !== body.workoutId);
      await writeData(id, data);
      return Response.json({ cancelled: true });
    }

    return Response.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not update workout." }, { status: 500 });
  }
}
