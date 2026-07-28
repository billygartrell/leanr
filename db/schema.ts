import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const workouts = sqliteTable("workouts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  dayType: text("day_type", { enum: ["upper", "lower"] }).notNull(),
  startedAt: text("started_at").notNull(),
  endedAt: text("ended_at"),
});

export const workoutSets = sqliteTable("workout_sets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workoutId: integer("workout_id")
    .notNull()
    .references(() => workouts.id, { onDelete: "cascade" }),
  exercise: text("exercise").notNull(),
  weight: real("weight").notNull(),
  reps: integer("reps").notNull(),
  createdAt: text("created_at").notNull(),
});
