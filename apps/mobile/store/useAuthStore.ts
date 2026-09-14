import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { WeightUnit } from "../lib/units";
import {
  DEFAULT_BAR_BY_UNIT,
  DEFAULT_INVENTORY_BY_UNIT,
  cloneInventory,
  createPlateId,
  type PlateDenomination,
} from "../lib/plates";

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
  barByUnit: Record<WeightUnit, number>;
  inventoryByUnit: Record<WeightUnit, PlateDenomination[]>;
  setUser: (user: User | null) => void;
  setSessionCookie: (cookie: string | null) => void;
  setDisplayUnit: (unit: WeightUnit) => void;
  setBarWeight: (weight: number) => void;
  setInventory: (inventory: PlateDenomination[]) => void;
  addPlate: (weight?: number) => void;
  updatePlate: (id: string, patch: Partial<Pick<PlateDenomination, "weight" | "count">>) => void;
  removePlate: (id: string) => void;
  signOut: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      sessionCookie: null,
      apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8787",
      displayUnit: "kg",
      barByUnit: { ...DEFAULT_BAR_BY_UNIT },
      inventoryByUnit: {
        kg: cloneInventory(DEFAULT_INVENTORY_BY_UNIT.kg),
        lb: cloneInventory(DEFAULT_INVENTORY_BY_UNIT.lb),
      },
      setUser: (user) => set({ user }),
      setSessionCookie: (sessionCookie) => set({ sessionCookie }),
      setDisplayUnit: (displayUnit) => set({ displayUnit }),
      setBarWeight: (weight) => {
        const unit = get().displayUnit;
        set({
          barByUnit: {
            ...get().barByUnit,
            [unit]: weight,
          },
        });
      },
      setInventory: (inventory) => {
        const unit = get().displayUnit;
        set({
          inventoryByUnit: {
            ...get().inventoryByUnit,
            [unit]: inventory.map((item) => ({ ...item })),
          },
        });
      },
      addPlate: (weight) => {
        const unit = get().displayUnit;
        const current = get().inventoryByUnit[unit];
        const nextWeight = weight ?? (unit === "lb" ? 2.5 : 1.25);
        set({
          inventoryByUnit: {
            ...get().inventoryByUnit,
            [unit]: [
              ...current,
              { id: createPlateId(unit, nextWeight), weight: nextWeight, count: 2 },
            ],
          },
        });
      },
      updatePlate: (id, patch) => {
        const unit = get().displayUnit;
        set({
          inventoryByUnit: {
            ...get().inventoryByUnit,
            [unit]: get().inventoryByUnit[unit].map((item) =>
              item.id === id ? { ...item, ...patch } : item
            ),
          },
        });
      },
      removePlate: (id) => {
        const unit = get().displayUnit;
        set({
          inventoryByUnit: {
            ...get().inventoryByUnit,
            [unit]: get().inventoryByUnit[unit].filter((item) => item.id !== id),
          },
        });
      },
      signOut: () => set({ user: null, sessionCookie: null }),
    }),
    {
      name: "fitness-auth-store",
      version: 2,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        sessionCookie: state.sessionCookie,
        displayUnit: state.displayUnit,
        barByUnit: state.barByUnit,
        inventoryByUnit: state.inventoryByUnit,
      }),
      migrate: (persisted) => {
        const state = persisted as Record<string, unknown>;
        return {
          sessionCookie: state.sessionCookie ?? null,
          displayUnit: state.displayUnit === "lb" ? "lb" : "kg",
          barByUnit: {
            kg: DEFAULT_BAR_BY_UNIT.kg,
            lb: DEFAULT_BAR_BY_UNIT.lb,
            ...((state.barByUnit as Record<string, number> | undefined) ?? {}),
          },
          inventoryByUnit: {
            kg: cloneInventory(DEFAULT_INVENTORY_BY_UNIT.kg),
            lb: cloneInventory(DEFAULT_INVENTORY_BY_UNIT.lb),
            ...((state.inventoryByUnit as Record<string, PlateDenomination[]> | undefined) ?? {}),
          },
        };
      },
    }
  )
);
