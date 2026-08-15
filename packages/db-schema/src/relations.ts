import { relations } from "drizzle-orm";
import { workouts } from "./tables/workouts";
import { sets } from "./tables/sets";
import { exercises } from "./tables/exercises";
import { users } from "./tables/users";

export const usersRelations = relations(users, ({ many }) => ({
  workouts: many(workouts),
}));

export const workoutsRelations = relations(workouts, ({ one, many }) => ({
  user: one(users, { fields: [workouts.userId], references: [users.id] }),
  sets: many(sets),
}));

export const exercisesRelations = relations(exercises, ({ many }) => ({
  sets: many(sets),
}));

export const setsRelations = relations(sets, ({ one }) => ({
  workout: one(workouts, { fields: [sets.workoutId], references: [workouts.id] }),
  exercise: one(exercises, { fields: [sets.exerciseId], references: [exercises.id] }),
}));
