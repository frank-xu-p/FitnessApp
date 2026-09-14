import { eq, isNull, asc } from "drizzle-orm";
import * as SecureStore from "expo-secure-store";
import { db } from "./client";
import { users, exercises, workouts, sets, syncQueue } from "./schema";
import { getDeviceId } from "../lib/device";
import type { TableName } from "@fitness-app/db-schema";

const tables = { users, exercises, workouts, sets };

export type LocalMutation = {
  id: string;
  tableName: TableName;
  recordId: string;
  operation: "insert" | "update" | "delete";
  payload: Record<string, unknown>;
  clientTimestamp: number;
  deviceId: string;
};

export type RemoteMutation = {
  tableName: TableName;
  recordId: string;
  payload: Record<string, unknown>;
};

export async function logMutation(
  tableName: TableName,
  recordId: string,
  operation: "insert" | "update" | "delete",
  payload: Record<string, unknown>
) {
  const deviceId = await getDeviceId();
  const now = Date.now();
  await db.insert(syncQueue).values({
    id: generateSyncId(),
    tableName,
    recordId,
    operation,
    payload: { ...payload, clientTimestamp: now, deviceId },
    clientTimestamp: now,
    deviceId,
  });
}

function generateSyncId(): string {
  return `sq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function getPendingMutations() {
  return db
    .select()
    .from(syncQueue)
    .where(isNull(syncQueue.syncedAt))
    .orderBy(asc(syncQueue.clientTimestamp));
}

export async function applyRemoteMutation(mutation: RemoteMutation) {
  const table = tables[mutation.tableName];
  const existingRows = await db
    .select()
    .from(table)
    .where(eq(table.id, mutation.recordId))
    .limit(1);
  const existing = existingRows[0];

  const remoteTimestamp = Number(mutation.payload.clientTimestamp ?? 0);
  if (existing && existing.clientTimestamp > remoteTimestamp) {
    return;
  }

  const row = mutation.payload as any;
  if (row.isDeleted || row.is_deleted) {
    await db.delete(table).where(eq(table.id, mutation.recordId));
    return;
  }

  await db.insert(table).values(row).onConflictDoUpdate({
    target: table.id,
    set: row,
  });
}

export async function pushLocalChanges(apiUrl: string, sessionCookie?: string | null) {
  const pending = await getPendingMutations();
  if (pending.length === 0) return { accepted: 0, rejected: [] as LocalMutation[] };

  const mutations = pending.map((item) => ({
    tableName: item.tableName,
    recordId: item.recordId,
    operation: item.operation,
    clientTimestamp: item.clientTimestamp,
    deviceId: item.deviceId,
    payload: item.payload,
  }));

  const response = await fetch(`${apiUrl}/api/sync/push`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(sessionCookie ? { Cookie: sessionCookie } : {}),
    },
    body: JSON.stringify({ mutations }),
  });

  if (!response.ok) {
    const error = await response.text();
    await markPendingAsFailed(pending, error);
    throw new Error(`Sync push failed: ${response.status} ${error}`);
  }

  const { accepted, rejected } = (await response.json()) as {
    accepted: number;
    rejected: { recordId: string; tableName: TableName }[];
  };

  const rejectedIds = new Set(rejected.map((r: { recordId: string; tableName: TableName }) => `${r.tableName}:${r.recordId}`));
  const now = Date.now();

  for (const item of pending) {
    if (rejectedIds.has(`${item.tableName}:${item.recordId}`)) {
      await db
        .update(syncQueue)
        .set({ retryCount: item.retryCount + 1 })
        .where(eq(syncQueue.id, item.id));
    } else {
      await db
        .update(syncQueue)
        .set({ syncedAt: now })
        .where(eq(syncQueue.id, item.id));
    }
  }

  return { accepted, rejected };
}

export async function pullRemoteChanges(
  apiUrl: string,
  sessionCookie: string | null,
  since: number
) {
  const response = await fetch(`${apiUrl}/api/sync/pull?since=${since}`, {
    headers: sessionCookie ? { Cookie: sessionCookie } : {},
  });

  if (!response.ok) {
    throw new Error(`Sync pull failed: ${response.status}`);
  }

  const { mutations } = (await response.json()) as { mutations: RemoteMutation[] };
  for (const mutation of mutations) {
    await applyRemoteMutation(mutation);
  }

  return mutations;
}


export async function sync(apiUrl: string, sessionCookie?: string | null) {
  await pushLocalChanges(apiUrl, sessionCookie);
  const lastSync = await getLastSyncTimestamp();
  const mutations = await pullRemoteChanges(apiUrl, sessionCookie ?? null, lastSync);
  await updateLastSyncTimestamp(Date.now());
  return { pushed: true, pulled: mutations.length };
}

async function markPendingAsFailed(
  pending: Awaited<ReturnType<typeof getPendingMutations>>,
  error: string
) {
  for (const item of pending) {
    await db
      .update(syncQueue)
      .set({ retryCount: item.retryCount + 1, error: error.slice(0, 500) })
      .where(eq(syncQueue.id, item.id));
  }
}

const LAST_SYNC_KEY = "fitness-last-sync";

export async function getLastSyncTimestamp(): Promise<number> {
  const value = await SecureStore.getItemAsync(LAST_SYNC_KEY);
  return value ? Number(value) : 0;
}

export async function updateLastSyncTimestamp(timestamp: number) {
  await SecureStore.setItemAsync(LAST_SYNC_KEY, String(timestamp));
}
