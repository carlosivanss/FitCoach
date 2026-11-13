export type AppRole = "patient" | "trainer" | "admin";
export type ClientStatus = "invited" | "active" | "paused" | "archived";

export interface ClientSummary {
  id: number;
  fullName: string;
  email: string | null;
  status: ClientStatus;
  goal: string | null;
  lastWorkoutAt: string | null;
}

export interface ProgressPoint {
  date: string;
  value: number;
}

export const APP_NAME = "FitCoach";
