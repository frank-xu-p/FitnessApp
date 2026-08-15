export type TableName = "users" | "exercises" | "workouts" | "sets";

export type Mutation = {
  tableName: TableName;
  recordId: string;
  operation: "insert" | "update" | "delete";
  clientTimestamp: number;
  deviceId: string;
  payload: Record<string, unknown>;
};
