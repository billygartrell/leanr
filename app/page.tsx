"use client";

import { useEffect, useMemo, useState } from "react";

type DayType = "upper" | "lower";
type Effort = "maxed" | "challenging" | "moderate" | "easy";
type LoggedSet = { id: number; workoutId: number; exercise: string; weight: number; reps: number; createdAt: string };
type Workout = { id: number; dayType: DayType; startedAt: string; endedAt: string | null };
type Dashboard = { activeWorkout: Workout | null; sets: LoggedSet[]; efforts: Record<string, Effort>; bests: Record<string, number>; recentWorkouts: Workout[] };

const EFFORTS: { value: Effort; label: string }[] = [
  { value: "maxed", label: "Maxed Out" },
  { value: "challenging", label: "Challenging" },
  { value: "moderate", label: "Moderate" },
  { value: "easy", label: "Easy" },
];

const EXERCISES: Record<DayType, string[]> = {
  upper: ["Bench Press", "Incline Press", "Shoulder Press", "Lat Pulldown", "Cable Row", "Bicep Curls", "Tricep Extensions"],
  lower: ["Back squat", "Deadlift", "Leg press", "Romanian deadlift", "Leg curl", "Calf raise"],
};

export default function Home() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const refresh = async () => {
    const response = await fetch("/api/workouts", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not load your training data.");
    setData(await response.json());
  };

  useEffect(() => {
    refresh().catch((error) => setMessage(error.message)).finally(() => setLoading(false));
  }, []);

  const act = async (payload: object) => {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/workouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Something went wrong.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <main className="loading">Loading your training log…</main>;
  if (!data) return <main className="loading">{message || "Your training log is unavailable."}</main>;

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Setmark home"><span>SM</span> SETMARK</a>
        <div className="today"><i /> {new Intl.DateTimeFormat("en", { weekday: "short", month: "short", day: "numeric" }).format(new Date())}</div>
      </header>

      {!data.activeWorkout ? (
        <StartView data={data} busy={busy} onStart={(dayType) => act({ action: "start", dayType })} />
      ) : (
        <WorkoutView data={data} busy={busy} onAdd={(exercise, weight, reps) => act({ action: "addSet", workoutId: data.activeWorkout!.id, exercise, weight, reps })} onRemove={(setId) => act({ action: "removeSet", workoutId: data.activeWorkout!.id, setId })} onEffort={(exercise, effort) => act({ action: "setEffort", workoutId: data.activeWorkout!.id, exercise, effort })} onFinish={() => act({ action: "finish", workoutId: data.activeWorkout!.id })} onCancel={() => act({ action: "cancel", workoutId: data.activeWorkout!.id })} />
      )}
      {message && <div className="toast" role="alert">{message}</div>}
    </main>
  );
}

function StartView({ data, busy, onStart }: { data: Dashboard; busy: boolean; onStart: (day: DayType) => void }) {
  const bestEntries = Object.entries(data.bests).sort((a, b) => b[1] - a[1]).slice(0, 4);
  return <div className="shell start-shell" id="top">
    <section className="hero">
      <p className="eyebrow">TRAINING LOG · READY WHEN YOU ARE</p>
      <h1>What are we<br /><em>training?</em></h1>
      <p className="subcopy">Pick a split. Your best numbers come with you.</p>
      <div className="day-grid">
        <button className="day-card coral" disabled={busy} onClick={() => onStart("upper")}>
          <span className="day-number">01</span><span className="day-icon">↗</span><strong>UPPER</strong><small>Chest · Back · Shoulders · Arms</small><b>START SESSION <span>→</span></b>
        </button>
        <button className="day-card blue" disabled={busy} onClick={() => onStart("lower")}>
          <span className="day-number">02</span><span className="day-icon">↓</span><strong>LOWER</strong><small>Quads · Hamstrings · Glutes · Calves</small><b>START SESSION <span>→</span></b>
        </button>
      </div>
    </section>
    <aside className="records-panel">
      <p className="eyebrow">ALL-TIME BESTS</p>
      <h2>THE BOARD</h2>
      {bestEntries.length ? <div className="record-list">{bestEntries.map(([name, weight], index) => <div className="record" key={name}><span>0{index + 1}</span><p>{name}<small>PERSONAL BEST</small></p><strong>{weight}<small>LB</small></strong></div>)}</div> : <div className="empty-records"><strong>NO NUMBERS YET.</strong><p>Your heaviest weight for every exercise will appear here automatically.</p></div>}
      <div className="sessions-count"><strong>{data.recentWorkouts.length}</strong><span>RECENT<br />SESSIONS</span></div>
    </aside>
  </div>;
}

function WorkoutView({ data, busy, onAdd, onRemove, onEffort, onFinish, onCancel }: { data: Dashboard; busy: boolean; onAdd: (exercise: string, weight: number, reps: number) => void; onRemove: (setId: number) => void; onEffort: (exercise: string, effort: Effort) => void; onFinish: () => void; onCancel: () => void }) {
  const workout = data.activeWorkout!;
  const exercises = EXERCISES[workout.dayType];
  const goBack = () => {
    if (data.sets.length === 0 || window.confirm("Discard this session and return to workout selection? Logged sets from this session will be removed.")) onCancel();
  };
  return <div className="workout-shell" id="top">
    <button className="back-button" disabled={busy} onClick={goBack}>← BACK TO SESSION CHOICE</button>
    <section className="session-head">
      <div><p className="eyebrow">SESSION IN PROGRESS</p><h1>{workout.dayType.toUpperCase()} <em>DAY</em></h1><p className="subcopy">Log every set separately. Change the weight whenever you need.</p></div>
      <button className="finish" disabled={busy} onClick={onFinish}>FINISH WORKOUT <span>✓</span></button>
    </section>
    <div className="exercise-stack">
      {exercises.map((exercise, index) => <ExerciseCard key={exercise} index={index + 1} exercise={exercise} best={data.bests[exercise]} sets={data.sets.filter((set) => set.exercise === exercise)} effort={data.efforts[exercise]} busy={busy} onAdd={onAdd} onRemove={onRemove} onEffort={onEffort} />)}
    </div>
  </div>;
}

function ExerciseCard({ index, exercise, best, sets, effort, busy, onAdd, onRemove, onEffort }: { index: number; exercise: string; best?: number; sets: LoggedSet[]; effort?: Effort; busy: boolean; onAdd: (exercise: string, weight: number, reps: number) => void; onRemove: (setId: number) => void; onEffort: (exercise: string, effort: Effort) => void }) {
  const suggested = best || 45;
  const [weight, setWeight] = useState(String(suggested));
  const [reps, setReps] = useState("8");
  const sessionBest = useMemo(() => Math.max(0, ...sets.map((set) => set.weight)), [sets]);
  const submit = () => {
    const w = Number(weight), r = Number(reps);
    if (w > 0 && r > 0) onAdd(exercise, w, r);
  };
  return <article className="exercise-card">
    <div className="exercise-title"><span>{String(index).padStart(2, "0")}</span><div><h2>{exercise}</h2><p>ALL-TIME BEST <b>{best ? `${best} LB` : "—"}</b></p></div>{sessionBest > 0 && <mark>Today {sessionBest} lb</mark>}</div>
    <div className="effort-picker" role="group" aria-label={`Effort for ${exercise}`}>
      <span>HOW DID IT FEEL?</span>
      <div>{EFFORTS.map((option) => <button key={option.value} type="button" aria-pressed={effort === option.value} className={effort === option.value ? `selected ${option.value}` : ""} disabled={busy} onClick={() => onEffort(exercise, option.value)}>{option.label}</button>)}</div>
    </div>
    {sets.length > 0 && <div className="set-list">{sets.map((set, i) => <div key={set.id}><span>SET {i + 1}</span><strong>{set.weight} <small>LB</small></strong><b>×</b><strong>{set.reps} <small>REPS</small></strong>{best === set.weight && <em>BEST</em>}<button className="remove-set" type="button" disabled={busy} onClick={() => onRemove(set.id)} aria-label={`Remove set ${i + 1} from ${exercise}`}>×</button></div>)}</div>}
    <div className="set-form">
      <label>WEIGHT <span><input inputMode="decimal" type="number" min="0" step="2.5" value={weight} onChange={(e) => setWeight(e.target.value)} /> LB</span></label>
      <label>REPS <span><input inputMode="numeric" type="number" min="1" value={reps} onChange={(e) => setReps(e.target.value)} /></span></label>
      <button disabled={busy || !weight || !reps} onClick={submit}>LOG SET <span>＋</span></button>
    </div>
  </article>;
}
