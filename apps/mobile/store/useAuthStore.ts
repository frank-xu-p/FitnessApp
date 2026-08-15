import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { WeightUnit } from "../lib/units";

export type User = {
  id: string;
  email: string;
  name?: string;
  image?: string;
};

type AuthState = {
  user: User | null;
  sessionCookie: string | null;
  apiUrl: string;
  displayUnit: WeightUnit;
  defaultBarWeightKg: number;
  customPlates: number[];
  setUser: (user: User | null) => void;
  setSessionCookie: (cookie: string | null) => void;
  setDisplayUnit: (unit: WeightUnit) => void;
  setBarWeight: (kg: number) => void;
  setCustomPlates: (plates: number[]) => void;
  signOut: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      sessionCookie: null,
      apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8787",
      displayUnit: "kg",
      defaultBarWeightKg: 20,
      customPlates: [25, 20, 15, 10, 5, 2.5, 1.25],
      setUser: (user) => set({ user }),
      setSessionCookie: (sessionCookie) => set({ sessionCookie }),
      setDisplayUnit: (displayUnit) => set({ displayUnit }),
      setBarWeight: (defaultBarWeightKg) => set({ defaultBarWeightKg }),
      setCustomPlates: (customPlates) => set({ customPlates }),
      signOut: () => set({ user: null, sessionCookie: null }),
    }),
    {
      name: "fitness-auth-store",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        sessionCookie: state.sessionCookie,
        displayUnit: state.displayUnit,
        defaultBarWeightKg: state.defaultBarWeightKg,
        customPlates: state.customPlates,
      }),
    }
  )
);
