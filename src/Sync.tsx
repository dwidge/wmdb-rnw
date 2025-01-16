// Copyright DWJ 2024.
// Distributed under the Boost Software License, Version 1.0.
// https://www.boost.org/LICENSE_1_0.txt

import {
  createContext,
  useContext,
  useState,
  PropsWithChildren,
  useCallback,
  useRef,
  MutableRefObject,
  useEffect,
} from "react";

export type OnSync = (
  table: string,
  stats: { created: number; updated: number; deleted: number },
) => void;

const defaultOnPull: OnSync = (table: string, { created, updated, deleted }) =>
  console.log("PullChanges", table, created, updated, deleted);
const defaultOnPush: OnSync = (table: string, { created, updated, deleted }) =>
  console.log("PushChanges", table, created, updated, deleted);

export interface SyncContextValue {
  busy: boolean;
  setBusy: React.Dispatch<React.SetStateAction<boolean>>;
  online: boolean;
  setOnline: React.Dispatch<React.SetStateAction<boolean>>;
  syncTables: () => undefined | ((context: SyncContextValue) => Promise<void>);
  notify: (message: string) => void;
  log: (message: string, ...v: unknown[]) => void;
  onPull?: OnSync;
  onPush?: OnSync;
  onError?: (e: Error) => void;
  busyRef: MutableRefObject<boolean>;
  lastSyncTime: number | null;
  setLastSyncTime: React.Dispatch<React.SetStateAction<number | null>>;
  syncIntervalSeconds?: number;
}

const SyncContext = createContext<SyncContextValue | undefined>(undefined);

const syncTablesMock = () => async () => {
  console.log("syncTablesMock1: Syncing tables...");
  return new Promise<void>((resolve) => setTimeout(resolve, 1000));
};
const notifyDefault = (message: string) =>
  console.log("SyncProvider1:", message);

export const SyncProvider: React.FC<
  PropsWithChildren<
    Partial<
      Pick<
        SyncContextValue,
        | "syncTables"
        | "notify"
        | "log"
        | "onPull"
        | "onPush"
        | "onError"
        | "syncIntervalSeconds"
      >
    >
  >
> = ({
  children,
  syncTables = syncTablesMock,
  notify = notifyDefault,
  log = (...v) => console.log(...v),
  onPull = defaultOnPull,
  onPush = defaultOnPush,
  syncIntervalSeconds = 10,
}) => {
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(false);
  const busyRef = useRef(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);

  const value: SyncContextValue = {
    busy,
    setBusy,
    online,
    setOnline,
    syncTables,
    notify,
    log,
    onPull,
    onPush,
    busyRef,
    lastSyncTime,
    setLastSyncTime,
    syncIntervalSeconds,
  };

  useIntervalSync(value);
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
};

export const useSyncContext = () => {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error("useSyncContext must be used within a SyncProvider");
  }
  return context;
};

export const useSyncTrigger = (context = useSyncContext()) => {
  const {
    setBusy,
    setOnline,
    busy: isBusy,
    syncTables,
    notify,
    log,
    busyRef,
    setLastSyncTime,
  } = context;
  const syncTablesF = syncTables();

  const triggerSync = useCallback(async () => {
    log("useSyncDb1: Sync try");
    let success = false;

    if (busyRef.current) {
      log("useSyncDb1: Sync already in progress, ignoring trigger.");
      return false;
    }

    if (!syncTablesF) {
      log("useSyncDb2: Sync disabled, ignoring trigger.");
      return false;
    }

    log("useSyncDb2: Sync start");
    busyRef.current = true;
    setBusy(true);

    try {
      await syncTablesF(context);
      notify("Synchronized");
      setOnline(true);
      success = true;
    } catch (e) {
      log("useSyncDbE1: Sync failed", e);
      notify("Offline");
      setOnline(false);
      success = false;
    } finally {
      setBusy(false);
      busyRef.current = false;
      log("useSyncDb3: Sync end");
      setLastSyncTime(Math.floor(Date.now() / 1000));
    }

    return success;
  }, [syncTablesF, setBusy, setOnline, notify, log, busyRef, setLastSyncTime]);

  return syncTablesF && !isBusy ? triggerSync : undefined;
};

export const useSyncMode = () => {
  const { online, busy, lastSyncTime } = useSyncContext();
  return { online, busy, lastSyncTime };
};

export const useIntervalSync = (context = useSyncContext()) => {
  const { syncIntervalSeconds, log } = context;
  const triggerSync = useSyncTrigger(context);

  useEffect(() => {
    if (triggerSync && syncIntervalSeconds && syncIntervalSeconds > 0) {
      log(
        `useAutoSync: Setting up sync interval for ${syncIntervalSeconds} seconds`,
      );
      const intervalId = setInterval(triggerSync, syncIntervalSeconds * 1000);
      return () => {
        log("useAutoSync: Clearing sync interval");
        clearInterval(intervalId);
      };
    } else {
      if (syncIntervalSeconds && syncIntervalSeconds <= 0) {
        log(
          "useAutoSync: syncIntervalSeconds should be greater than 0 to enable auto sync.",
        );
      }
    }
  }, [triggerSync, syncIntervalSeconds]);
};

export const useEventSync = (
  condition = false,
  context = useSyncContext(),
  triggerSync = useSyncTrigger(context),
  { log } = context,
) => {
  useEffect(() => {
    if (condition && triggerSync) {
      log("useEventSync1: Performing sync.");
      triggerSync();
    }
  }, [condition]);
  return triggerSync;
};
