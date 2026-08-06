"use client";

import { useEffect, useMemo, useState } from "react";

type DayType = "upper" | "lower" | "full" | "cardio";
type Effort = "maxed" | "challenging" | "moderate" | "easy";
type LoggedSet = { id: number; workoutId: number; exercise: string; weight: number; reps: number; createdAt: string };
type Workout = { id: number; dayType: DayType; startedAt: string; endedAt: string | null };
type RecentWorkout = Workout & { setCount: number };
type SessionDetail = { workout: Workout; sets: LoggedSet[]; efforts: Record<string, Effort> };
type Dashboard = { activeWorkout: Workout | null; sets: LoggedSet[]; efforts: Record<string, Effort>; bests: Record<string, number>; lastWeights: Record<string, number>; recentWorkouts: RecentWorkout[] };
type Profile = { id: string; name: string; createdAt: string };
type ExerciseRecord = { exercise: string; cardio: boolean; maxWeight: number; maxReps: number; maxVolume: number; estimatedOneRepMax: number | null; setCount: number; sessionCount: number; lastPerformed: string; recentSets: LoggedSet[] };

const PROFILE_KEY = "leanr-profile-id";

async function fetchDashboard(profile: Profile): Promise<Dashboard> {
  const response = await fetch("/api/workouts", { cache: "no-store", headers: { "X-Profile-Id": profile.id } });
  if (!response.ok) throw new Error("Could not load your training data.");
  return response.json();
}

const EFFORTS: { value: Effort; label: string }[] = [
  { value: "maxed", label: "Maxed Out" },
  { value: "challenging", label: "Challenging" },
  { value: "moderate", label: "Moderate" },
  { value: "easy", label: "Easy" },
];

const UPPER_EXERCISES = ["Bench Press", "Incline Press", "Chest Press", "Chest Fly", "Reverse Fly", "Shoulder Press", "Pulldown Wide", "Pulldown Narrow", "Lat Pulldown", "Cable Row", "Strap - Suspension Row", "Bicep Curls", "Tricep Extensions", "Cable Triceps Extension Push down", "Cable Triceps Extension Overhead"];
const LOWER_EXERCISES = ["Back squat", "Meatball squat Curl & overhead Press", "Deadlift", "Romanian Deadlift", "Leg press", "Seated Leg Press", "Leg curl", "Leg Extensions", "Outer Thigh", "Inner Thigh", "Calf raise"];
const EXERCISES: Record<DayType, string[]> = {
  upper: UPPER_EXERCISES,
  lower: LOWER_EXERCISES,
  full: [...UPPER_EXERCISES, ...LOWER_EXERCISES],
  cardio: ["Recumbent Bike"],
};

const DAY_OPTIONS: { value: DayType; number: string; icon: string; title: string; detail: string; className: string }[] = [
  { value: "upper", number: "01", icon: "↗", title: "UPPER", detail: "Chest · Back · Shoulders · Arms", className: "coral" },
  { value: "lower", number: "02", icon: "↓", title: "LOWER", detail: "Quads · Hamstrings · Glutes · Calves", className: "blue" },
  { value: "full", number: "03", icon: "↕", title: "FULL BODY", detail: "Every strength exercise", className: "acid" },
  { value: "cardio", number: "04", icon: "◉", title: "CARDIO", detail: "Recumbent Bike", className: "mint" },
];

export default function Home() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedSession, setSelectedSession] = useState<SessionDetail | null>(null);
  const [records, setRecords] = useState<ExerciseRecord[] | null>(null);

  const refresh = async (profile = activeProfile) => {
    if (!profile) return;
    setData(await fetchDashboard(profile));
  };

  useEffect(() => {
    fetch("/api/profiles", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not load profiles.");
        const available = result.profiles as Profile[];
        setProfiles(available);
        const savedId = window.localStorage.getItem(PROFILE_KEY);
        const selected = available.find((profile) => profile.id === savedId) ?? null;
        if (selected) {
          setActiveProfile(selected);
          setData(await fetchDashboard(selected));
        }
      })
      .catch((error) => setMessage(error.message))
      .finally(() => setLoading(false));
  }, []);

  const selectProfile = async (profile: Profile) => {
    setLoading(true);
    setMessage("");
    setSelectedSession(null);
    setRecords(null);
    setData(null);
    setActiveProfile(profile);
    window.localStorage.setItem(PROFILE_KEY, profile.id);
    try { await refresh(profile); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not load that profile."); }
    finally { setLoading(false); }
  };

  const createProfile = async (name: string) => {
    const response = await fetch("/api/profiles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not create profile.");
    const profile = result.profile as Profile;
    setProfiles((current) => [...current, profile]);
    await selectProfile(profile);
  };

  const openSession = async (workoutId: number) => {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/workouts?workoutId=${workoutId}`, { cache: "no-store", headers: { "X-Profile-Id": activeProfile!.id } });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not open that session.");
      setSelectedSession(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not open that session.");
    } finally {
      setBusy(false);
    }
  };

  const openRecords = async () => {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/workouts?records=1", { cache: "no-store", headers: { "X-Profile-Id": activeProfile!.id } });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not load your records.");
      setRecords(result.records);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load your records.");
    } finally { setBusy(false); }
  };

  const act = async (payload: object) => {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/workouts", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Profile-Id": activeProfile!.id },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Something went wrong.");
      await refresh();
      if (selectedSession) await openSession(selectedSession.workout.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <main className="loading">Loading your training log…</main>;
  if (!activeProfile) return <ProfileGate profiles={profiles} message={message} onSelect={selectProfile} onCreate={createProfile} />;
  if (!data) return <main className="loading">{message || "Your training log is unavailable."}</main>;

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Leanr home"><span>LR</span> LEANR</a>
        <div className="profile-tools">
          <label><span>TRAINING AS</span><select value={activeProfile.id} onChange={(event) => selectProfile(profiles.find((profile) => profile.id === event.target.value)!)}>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}</select></label>
          <button disabled={busy} onClick={openRecords}>RECORDS</button>
          <button onClick={() => { window.localStorage.removeItem(PROFILE_KEY); setActiveProfile(null); setData(null); }}>SWITCH / ADD</button>
        </div>
      </header>

      {records ? (
        <RecordsView records={records} onBack={() => setRecords(null)} />
      ) : selectedSession ? (
        <SessionDetailView session={selectedSession} busy={busy} onBack={() => setSelectedSession(null)} onUpdate={act} />
      ) : !data.activeWorkout ? (
        <StartView data={data} busy={busy} onStart={(dayType) => act({ action: "start", dayType })} onOpenSession={openSession} onSeeAll={openRecords} />
      ) : (
        <WorkoutView data={data} busy={busy} onAdd={(exercise, weight, reps) => act({ action: "addSet", workoutId: data.activeWorkout!.id, exercise, weight, reps })} onRemove={(setId) => act({ action: "removeSet", workoutId: data.activeWorkout!.id, setId })} onEffort={(exercise, effort) => act({ action: "setEffort", workoutId: data.activeWorkout!.id, exercise, effort })} onFinish={() => act({ action: "finish", workoutId: data.activeWorkout!.id })} onCancel={() => act({ action: "cancel", workoutId: data.activeWorkout!.id })} />
      )}
      {message && <div className="toast" role="alert">{message}</div>}
    </main>
  );
}

function ProfileGate({ profiles, message, onSelect, onCreate }: { profiles: Profile[]; message: string; onSelect: (profile: Profile) => void; onCreate: (name: string) => Promise<void> }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(message);
  const create = async () => {
    if (!name.trim()) return;
    setBusy(true); setError("");
    try { await onCreate(name); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create profile."); setBusy(false); }
  };
  return <main className="profile-gate">
    <section className="profile-card">
      <a className="brand" href="#" aria-label="Leanr home"><span>LR</span> LEANR</a>
      <p className="eyebrow">WHO IS TRAINING?</p>
      <h1>Choose your<br /><em>profile.</em></h1>
      {profiles.length > 0 && <div className="profile-list">{profiles.map((profile) => <button key={profile.id} disabled={busy} onClick={() => onSelect(profile)}><span>{profile.name.slice(0, 1).toUpperCase()}</span><strong>{profile.name}</strong><b>→</b></button>)}</div>}
      <div className="new-profile">
        <label>NEW PROFILE<input autoComplete="name" maxLength={40} placeholder="Your name" value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") create(); }} /></label>
        <button disabled={busy || !name.trim()} onClick={create}>{busy ? "CREATING…" : "ADD PROFILE +"}</button>
      </div>
      {error && <p className="profile-error" role="alert">{error}</p>}
      <small>Profiles keep workout histories separate on this shared app. They are not password protected.</small>
    </section>
  </main>;
}

function StartView({ data, busy, onStart, onOpenSession, onSeeAll }: { data: Dashboard; busy: boolean; onStart: (day: DayType) => void; onOpenSession: (workoutId: number) => void; onSeeAll: () => void }) {
  const bestEntries = Object.entries(data.bests).sort((a, b) => b[1] - a[1]).slice(0, 4);
  return <div className="shell start-shell" id="top">
    <section className="hero">
      <p className="eyebrow">TRAINING LOG · READY WHEN YOU ARE</p>
      <h1>What are we<br /><em>training?</em></h1>
      <p className="subcopy">Pick a split. Your best numbers come with you.</p>
      <div className="day-grid">{DAY_OPTIONS.map((option) => <button key={option.value} className={`day-card ${option.className}`} disabled={busy} onClick={() => onStart(option.value)}>
        <span className="day-number">{option.number}</span><span className="day-icon">{option.icon}</span><strong>{option.title}</strong><small>{option.detail}</small><b>START SESSION <span>→</span></b>
      </button>)}</div>
    </section>
    <aside className="records-panel">
      <p className="eyebrow">ALL-TIME BESTS</p>
      <div className="records-title"><h2>THE BOARD</h2><button disabled={busy || !bestEntries.length} onClick={onSeeAll}>SEE ALL →</button></div>
      {bestEntries.length ? <div className="record-list">{bestEntries.map(([name, weight], index) => <div className="record" key={name}><span>0{index + 1}</span><p>{name}<small>PERSONAL BEST</small></p><strong>{weight}<small>{name === "Recumbent Bike" ? "LEVEL" : "LB"}</small></strong></div>)}</div> : <div className="empty-records"><strong>NO NUMBERS YET.</strong><p>Your best result for every exercise will appear here automatically.</p></div>}
      <div className="history-head"><span>SESSION LOG</span><b>{data.recentWorkouts.length}</b></div>
      {data.recentWorkouts.length ? <div className="history-list">{data.recentWorkouts.map((workout) => <button key={workout.id} disabled={busy} onClick={() => onOpenSession(workout.id)}><span>{new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(workout.startedAt))}</span><strong>{workout.dayType} day</strong><small>{workout.setCount} {workout.setCount === 1 ? "set" : "sets"} <b>→</b></small></button>)}</div> : <p className="no-history">Completed workouts will appear here.</p>}
    </aside>
  </div>;
}

function RecordsView({ records, onBack }: { records: ExerciseRecord[]; onBack: () => void }) {
  const [selected, setSelected] = useState<ExerciseRecord | null>(null);
  if (selected) return <RecordDetail record={selected} onBack={() => setSelected(null)} />;
  return <div className="workout-shell records-view" id="top">
    <button className="back-button" onClick={onBack}>← BACK TO TRAINING</button>
    <section className="records-hero"><p className="eyebrow">ALL-TIME BESTS</p><h1>YOUR<br /><em>records.</em></h1><p>{records.length} {records.length === 1 ? "exercise" : "exercises"} with logged results.</p></section>
    {records.length ? <div className="all-records">{records.map((record, index) => <button key={record.exercise} onClick={() => setSelected(record)}>
      <span>{String(index + 1).padStart(2, "0")}</span><div><strong>{record.exercise}</strong><small>{record.sessionCount} {record.sessionCount === 1 ? "SESSION" : "SESSIONS"} · {record.setCount} {record.cardio ? "RIDES" : "SETS"}</small></div><b>{record.maxWeight}<small>{record.cardio ? "LEVEL" : "LB"}</small></b><i>→</i>
    </button>)}</div> : <div className="empty-session"><strong>NO RECORDS YET</strong><p>Log your first set to start building your personal-best board.</p></div>}
  </div>;
}

function RecordDetail({ record, onBack }: { record: ExerciseRecord; onBack: () => void }) {
  const units = record.cardio ? { weight: "LEVEL", reps: "MIN", volume: "LEVEL-MIN" } : { weight: "LB", reps: "REPS", volume: "LB × REPS" };
  const stats = record.cardio
    ? [["HIGHEST RESISTANCE", record.maxWeight, units.weight], ["LONGEST RIDE", record.maxReps, units.reps], ["BEST WORK SCORE", record.maxVolume, units.volume]]
    : [["HEAVIEST WEIGHT", record.maxWeight, units.weight], ["MOST REPS", record.maxReps, units.reps], ["BEST SET VOLUME", record.maxVolume, units.volume], ["EST. 1 REP MAX", record.estimatedOneRepMax!, units.weight]];
  return <div className="workout-shell record-detail" id="top">
    <button className="back-button" onClick={onBack}>← ALL RECORDS</button>
    <section className="records-hero"><p className="eyebrow">PERSONAL BESTS</p><h1>{record.exercise}</h1><p>Last performed {new Intl.DateTimeFormat("en", { month: "long", day: "numeric", year: "numeric" }).format(new Date(record.lastPerformed))}</p></section>
    <div className="record-stats">{stats.map(([label, value, unit]) => <article key={String(label)}><span>{label}</span><strong>{value}</strong><small>{unit}</small></article>)}</div>
    <div className="record-history"><div className="history-head"><span>RECENT RESULTS</span><b>{record.setCount}</b></div>{record.recentSets.map((set) => <div key={set.id}><span>{new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(set.createdAt))}</span><strong>{set.weight} <small>{units.weight}</small></strong><b>×</b><strong>{set.reps} <small>{units.reps}</small></strong></div>)}</div>
  </div>;
}

function SessionDetailView({ session, busy, onBack, onUpdate }: { session: SessionDetail; busy: boolean; onBack: () => void; onUpdate: (payload: object) => void }) {
  const [dayType, setDayType] = useState<DayType>(session.workout.dayType);
  const [date, setDate] = useState(session.workout.startedAt.slice(0, 10));
  const exercises = Array.from(new Set([...session.sets.map((set) => set.exercise), ...Object.keys(session.efforts)]));
  const saveSession = () => onUpdate({ action: "updateWorkout", workoutId: session.workout.id, dayType, startedAt: `${date}T12:00:00.000Z` });

  return <div className="workout-shell history-detail" id="top">
    <button className="back-button" disabled={busy} onClick={onBack}>← BACK TO SESSION LOG</button>
    <section className="detail-head">
      <div><p className="eyebrow">SAVED SESSION</p><h1>{session.workout.dayType.toUpperCase()} <em>DAY</em></h1></div>
      <div className="session-editor">
        <label>SESSION TYPE<select value={dayType} onChange={(event) => setDayType(event.target.value as DayType)}><option value="upper">Upper body</option><option value="lower">Lower body</option><option value="full">Full body</option><option value="cardio">Cardio</option></select></label>
        <label>DATE<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
        <button disabled={busy} onClick={saveSession}>SAVE DETAILS</button>
      </div>
    </section>
    {exercises.length ? <div className="exercise-stack">{exercises.map((exercise, index) => {
      const sets = session.sets.filter((set) => set.exercise === exercise);
      return <article className="exercise-card saved-exercise" key={exercise}>
        <div className="exercise-title"><span>{String(index + 1).padStart(2, "0")}</span><div><h2>{exercise}</h2><p>{sets.length} LOGGED {sets.length === 1 ? "SET" : "SETS"}</p></div></div>
        <EffortPicker exercise={exercise} effort={session.efforts[exercise]} busy={busy} onEffort={(effort) => onUpdate({ action: "setEffort", workoutId: session.workout.id, exercise, effort })} />
        {sets.length > 0 && <div className="saved-set-list">{sets.map((set, setIndex) => <SavedSetEditor key={set.id} set={set} index={setIndex + 1} cardio={session.workout.dayType === "cardio"} busy={busy} onSave={(weight, reps) => onUpdate({ action: "updateSet", workoutId: session.workout.id, setId: set.id, weight, reps })} onRemove={() => onUpdate({ action: "removeSet", workoutId: session.workout.id, setId: set.id })} />)}</div>}
      </article>;
    })}</div> : <div className="empty-session"><strong>NO EXERCISE DATA</strong><p>This saved session has no logged sets or effort ratings.</p></div>}
  </div>;
}

function SavedSetEditor({ set, index, cardio, busy, onSave, onRemove }: { set: LoggedSet; index: number; cardio: boolean; busy: boolean; onSave: (weight: number, reps: number) => void; onRemove: () => void }) {
  const [weight, setWeight] = useState(String(set.weight));
  const [reps, setReps] = useState(String(set.reps));
  return <div className="saved-set-row">
    <span>SET {index}</span>
    <label>{cardio ? "RESISTANCE" : "WEIGHT"} <input type="number" inputMode="decimal" min="0" step={cardio ? "1" : "2.5"} value={weight} onChange={(event) => setWeight(event.target.value)} /> {cardio ? "LEVEL" : "LB"}</label>
    <label>{cardio ? "MINUTES" : "REPS"} <input type="number" inputMode="numeric" min="1" value={reps} onChange={(event) => setReps(event.target.value)} /></label>
    <button className="save-set" disabled={busy || Number(weight) <= 0 || Number(reps) <= 0} onClick={() => onSave(Number(weight), Number(reps))}>SAVE</button>
    <button className="remove-set" type="button" disabled={busy} onClick={onRemove} aria-label={`Remove set ${index}`}>×</button>
  </div>;
}

function EffortPicker({ exercise, effort, busy, onEffort }: { exercise: string; effort?: Effort; busy: boolean; onEffort: (effort: Effort) => void }) {
  return <div className="effort-picker" role="group" aria-label={`Effort for ${exercise}`}>
    <span>HOW DID IT FEEL?</span>
    <div>{EFFORTS.map((option) => <button key={option.value} type="button" aria-pressed={effort === option.value} className={effort === option.value ? `selected ${option.value}` : ""} disabled={busy} onClick={() => onEffort(option.value)}>{option.label}</button>)}</div>
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
      {exercises.map((exercise, index) => <ExerciseCard key={exercise} index={index + 1} exercise={exercise} cardio={workout.dayType === "cardio"} best={data.bests[exercise]} lastWeight={data.lastWeights[exercise]} sets={data.sets.filter((set) => set.exercise === exercise)} effort={data.efforts[exercise]} busy={busy} onAdd={onAdd} onRemove={onRemove} onEffort={onEffort} />)}
    </div>
  </div>;
}

function ExerciseCard({ index, exercise, cardio, best, lastWeight, sets, effort, busy, onAdd, onRemove, onEffort }: { index: number; exercise: string; cardio: boolean; best?: number; lastWeight?: number; sets: LoggedSet[]; effort?: Effort; busy: boolean; onAdd: (exercise: string, weight: number, reps: number) => void; onRemove: (setId: number) => void; onEffort: (exercise: string, effort: Effort) => void }) {
  const suggested = lastWeight || best || (cardio ? 1 : 45);
  const [weight, setWeight] = useState(String(suggested));
  const [reps, setReps] = useState(cardio ? "20" : "10");
  const sessionBest = useMemo(() => Math.max(0, ...sets.map((set) => set.weight)), [sets]);
  const submit = () => {
    const w = Number(weight), r = Number(reps);
    if (w > 0 && r > 0) onAdd(exercise, w, r);
  };
  return <article className="exercise-card">
    <div className="exercise-title"><span>{String(index).padStart(2, "0")}</span><div><h2>{exercise}</h2><p>ALL-TIME BEST <b>{best ? `${best} ${cardio ? "LEVEL" : "LB"}` : "—"}</b></p></div>{sessionBest > 0 && <mark>Today {sessionBest} {cardio ? "level" : "lb"}</mark>}</div>
    <EffortPicker exercise={exercise} effort={effort} busy={busy} onEffort={(value) => onEffort(exercise, value)} />
    {sets.length > 0 && <div className="set-list">{sets.map((set, i) => <div key={set.id}><span>{cardio ? "RIDE" : "SET"} {i + 1}</span><strong>{set.weight} <small>{cardio ? "LEVEL" : "LB"}</small></strong><b>×</b><strong>{set.reps} <small>{cardio ? "MIN" : "REPS"}</small></strong>{best === set.weight && <em>BEST</em>}<button className="remove-set" type="button" disabled={busy} onClick={() => onRemove(set.id)} aria-label={`Remove ${cardio ? "ride" : "set"} ${i + 1} from ${exercise}`}>×</button></div>)}</div>}
    <div className="set-form">
      <label>{cardio ? "RESISTANCE" : "WEIGHT"} <span><input inputMode="decimal" type="number" min="0" step={cardio ? "1" : "2.5"} value={weight} onChange={(e) => setWeight(e.target.value)} /> {cardio ? "LEVEL" : "LB"}</span></label>
      <label>{cardio ? "MINUTES" : "REPS"} <span><input inputMode="numeric" type="number" min="1" value={reps} onChange={(e) => setReps(e.target.value)} /></span></label>
      <button disabled={busy || !weight || !reps} onClick={submit}>LOG SET <span>＋</span></button>
    </div>
  </article>;
}
