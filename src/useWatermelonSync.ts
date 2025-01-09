// Copyright DWJ 2024.
// Distributed under the Boost Software License, Version 1.0.
// https://www.boost.org/LICENSE_1_0.txt

import { ApiWmdbItem1, ExtendedApi, Fetch } from "@dwidge/crud-api-react";
import { unixSeconds } from "@dwidge/utils-js";
import { SyncPullArgs, SyncPushArgs } from "@nozbe/watermelondb/sync";
import { OnSync } from "./Sync.js";
import { fetchItemsInChunks } from "./fetchItemsInChunks.js";
import { ParseItem } from "./useWatermelonLocal.js";

export type WatermelonSync<T extends Partial<ApiWmdbItem1>> = {
  pullChanges: (
    fetch: Fetch,
    { lastPulledAt, schemaVersion, migration }: SyncPullArgs,
    onSync?: OnSync,
  ) => Promise<{
    changes: {
      [x: string]: {
        created: Partial<T>[];
        updated: Partial<T>[];
        deleted: string[];
      };
    };
    timestamp: number;
  }>;
  pushChanges: (
    fetch: Fetch,
    { changes, lastPulledAt }: SyncPushArgs,
    onSync?: OnSync,
  ) => Promise<void>;
};

export const useWatermelonSync = <T extends ApiWmdbItem1>(
  parse: ParseItem<Partial<T>>,
  useApi: (f: Fetch) => ExtendedApi<T>,
  table: string,
): WatermelonSync<T> => {
  const pullChanges = async (
    fetch: Fetch,
    { lastPulledAt, schemaVersion, migration }: SyncPullArgs,
    onSync?: OnSync,
  ) => {
    const api = useApi(fetch);
    const limit = 1000;
    const items = (await fetchItemsInChunks(api, limit)).map(parse);

    const {
      created = [],
      updated = [],
      deleted = [],
    } = Object.groupBy(items, (item) =>
      lastPulledAt
        ? deletedAfter(lastPulledAt)(item)
          ? "deleted"
          : isDeleted(item)
            ? "ignored"
            : updatedAfter(lastPulledAt)(item)
              ? "updated"
              : createdAfter(lastPulledAt)(item)
                ? "created"
                : "ignored"
        : isDeleted(item)
          ? "ignored"
          : "created",
    );

    const badRows = items.filter((v) => !v.createdAt || !v.updatedAt);
    if (badRows.length)
      console.warn(
        "pullChangesE1: Column createdAt and updatedAt must not be empty: Table [" +
          table +
          "] has " +
          badRows.length +
          " invalid rows",
      );

    onSync?.(table, {
      created: created.length,
      updated: updated.length,
      deleted: deleted.length,
    });

    return {
      changes: {
        [table]: {
          created,
          updated,
          deleted: deleted
            .map((v) => v.id)
            .filter((id): id is string => id != null),
        },
      },
      timestamp: unixSeconds(),
    };
  };

  const pushChanges = async (
    fetch: Fetch,
    { changes, lastPulledAt }: SyncPushArgs,
    onSync?: OnSync,
  ) => {
    const api = useApi(fetch);
    const { created = [], updated = [], deleted = [] } = changes[table] || {};

    onSync?.(table, {
      created: created.length,
      updated: updated.length,
      deleted: deleted.length,
    });

    const creates = created.map(parse);
    const updates = updated.map(parse);
    const deletes = deleted.map((id) => ({ id })).map(parse);

    if (creates.length > 0) await api.createList(creates);
    if (updates.length > 0) await api.updateList(updates);
    if (deleted.length > 0) await api.deleteList(deletes);
  };

  return {
    pullChanges,
    pushChanges,
  };
};

const createdAfter =
  (timestamp: number) =>
  ({ createdAt }: Omit<Partial<ApiWmdbItem1>, "id">) =>
    !createdAt || createdAt > timestamp;
const updatedAfter =
  (timestamp: number) =>
  ({ updatedAt }: Omit<Partial<ApiWmdbItem1>, "id">) =>
    updatedAt && updatedAt > timestamp;
const deletedAfter =
  (timestamp: number) =>
  ({ deletedAt }: Omit<Partial<ApiWmdbItem1>, "id">) =>
    deletedAt && deletedAt > timestamp;
const isDeleted = deletedAfter(0);
