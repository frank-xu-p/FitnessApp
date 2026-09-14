\---

name: react-native-architecture

description: "Enforces production-grade React Native \& Expo architectural patterns: atomic component separation, Zustand store modularity, performance optimization (FlashList/memoization), type safety, and clean directory structures. Use whenever structuring new features, stores, or complex screens."

\---



\# React Native \& Expo Architecture Standards



\## When to use this skill

\- Use when scaffolding new modules, refactoring components over 150 lines, designing state machines/stores, or optimizing list rendering and re-renders.



\## Architectural Guidelines



1\. \*\*Component Modularity \& File Size:\*\*

&#x20;  - Keep screen components thin (layout/composition only).

&#x20;  - Extract UI into self-contained presentational sub-components when a file exceeds \~150 lines (e.g., `SetRow.tsx`, `PlateVisualizer.tsx`, `RestTimerBar.tsx`).

&#x20;  - Group feature files by domain: `/features/workout/{components, hooks, stores, types}`.



2\. \*\*State Management (Zustand):\*\*

&#x20;  - Separate transient UI state (modals open, active inputs) from persisted domain state (active workout, history).

&#x20;  - Use atomic selectors (`useWorkoutStore(state => state.activeWorkout)`) instead of consuming entire store objects to avoid unnecessary re-renders.

&#x20;  - Colocate actions within the store slice rather than passing inline setters down deep component trees.



3\. \*\*Performance \& List Rendering:\*\*

&#x20;  - Use `@shopify/flash-list` or optimized `FlatList` with `getItemLayout` and `keyExtractor` for long lists (exercise pickers, workout history).

&#x20;  - Memoize expensive computations (e.g., greedy plate distribution, 1RM formulas) with `useMemo`.

&#x20;  - Wrap interactive rows in `React.memo` with custom comparison props when rendering large sets or exercise tables.



4\. \*\*Type Safety \& Schema Integrity:\*\*

&#x20;  - Derive TypeScript types directly from Drizzle schemas or Zod validation schemas wherever possible.

&#x20;  - Avoid `any` types; strictly type navigation routes, store actions, and database mutation payloads.

