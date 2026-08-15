import { useEffect, useCallback, useState } from "react";
import NetInfo from "@react-native-community/netinfo";
import { sync } from "../db/sync";
import { useAuthStore } from "../store/useAuthStore";

export function useSync() {
  const { apiUrl, sessionCookie, user } = useAuthStore();
  const [status, setStatus] = useState<"idle" | "syncing" | "error" | "ok">("idle");
  const [lastSync, setLastSync] = useState<number | null>(null);

  const doSync = useCallback(async () => {
    if (!user || !sessionCookie) {
      setStatus("idle");
      return;
    }
    setStatus("syncing");
    try {
      await sync(apiUrl, sessionCookie);
      setStatus("ok");
      setLastSync(Date.now());
    } catch (err) {
      console.error("Sync failed", err);
      setStatus("error");
    }
  }, [apiUrl, sessionCookie, user]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && user && sessionCookie) {
        doSync();
      }
    });
    return () => unsubscribe();
  }, [doSync, user, sessionCookie]);

  return { status, lastSync, sync: doSync };
}
