import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

const CLEAN_UI_KEY = "fitnessapp.cleanUI";

type ThemeContextValue = {
  /** True = the calm, Strong-like "Clean" interface. False = legacy neon UI. */
  cleanUI: boolean;
  ready: boolean;
  setCleanUI: (v: boolean) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  cleanUI: true,
  ready: false,
  setCleanUI: () => undefined,
});

function getStorage() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("@react-native-async-storage/async-storage").default as {
      getItem(k: string): Promise<string | null>;
      setItem(k: string, v: string): Promise<void>;
    };
  } catch {
    return null;
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [cleanUI, setCleanUIState] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getStorage()
      ?.getItem(CLEAN_UI_KEY)
      .then((v) => {
        if (v === "0") setCleanUIState(false);
        else if (v === "1") setCleanUIState(true);
        // default: clean UI on
      })
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, []);

  const setCleanUI = useCallback((v: boolean) => {
    setCleanUIState(v);
    getStorage()
      ?.setItem(CLEAN_UI_KEY, v ? "1" : "0")
      .catch(() => undefined);
  }, []);

  return (
    <ThemeContext.Provider value={{ cleanUI, ready, setCleanUI }}>
      {children}
    </ThemeContext.Provider>
  );
}

/** Whether the Clean (Strong-like) interface is enabled. */
export function useCleanUI(): boolean {
  return useContext(ThemeContext).cleanUI;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

/**
 * Pick a NativeWind class string by theme. Keeps one JSX tree working in
 * both the Clean and legacy interfaces.
 */
export function cx(
  cleanUI: boolean,
  cleanCls: string,
  legacyCls: string,
): string {
  return cleanUI ? cleanCls : legacyCls;
}

/** Shared Clean-interface design tokens. */
export const Clean = {
  /** App/screen background */
  bg: "bg-black",
  /** Card surface */
  card: "bg-[#141414]",
  /** Sunken input surface */
  input: "bg-[#1C1C1E]",
  /** Hairline divider/border */
  hairline: "border-[#2C2C2E]",
  /** Primary text */
  text: "text-white",
  /** Secondary text */
  subtext: "text-[#98989F]",
  /** Faint text */
  faint: "text-[#636366]",
  /** Single accent (Strong-like blue) */
  accent: "#0A84FF",
  accentText: "text-[#0A84FF]",
  /** Primary button */
  primaryBtn: "bg-[#0A84FF]",
  /** Quiet button surface */
  quietBtn: "bg-[#1C1C1E]",
} as const;
