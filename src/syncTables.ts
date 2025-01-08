// Copyright DWJ 2024.
// Distributed under the Boost Software License, Version 1.0.
// https://www.boost.org/LICENSE_1_0.txt

import { Fetch } from "@dwidge/crud-api-react";
import { Database } from "@nozbe/watermelondb";
import { synchronize } from "@nozbe/watermelondb/sync";
import merge from "ts-deepmerge";
import { WatermelonSync } from "./useWatermelonSync";
import { OnSync, SyncContextValue } from "./Sync";

export const syncTables = async (
  fetch: Fetch,
  database: Database,
  tables: WatermelonSync<any>[],
  { onPull, onPush }: SyncContextValue,
) =>
  synchronize({
    database,
    pullChanges: async ({ lastPulledAt, schemaVersion, migration }) =>
      merge(
        ...(await Promise.all(
          tables.map((f) =>
            f.pullChanges(
              fetch,
              {
                lastPulledAt,
                schemaVersion,
                migration,
              },
              onPull,
            ),
          ),
        )),
      ),
    pushChanges: async ({ changes, lastPulledAt }) => {
      await Promise.all(
        tables.map((f) =>
          f.pushChanges(fetch, { changes, lastPulledAt }, onPush),
        ),
      );
    },
    migrationsEnabledAtVersion: 1,
  }).catch(catchDiagnosticError);

const catchDiagnosticError = (e) => {
  if (e instanceof Error) {
    const m = e.message.toString();
    if (m == "Cannot read properties of null (reading 'find')") {
      console.log(
        "catchDiagnosticErrorE1: Database has changed but did not migrate, please logout or reset the wmdb SQLLite/IndexDB",
      );
      throw new Error(
        "catchDiagnosticErrorE1: Database has changed but did not migrate, please logout or reset the wmdb SQLLite/IndexDB",
        { cause: e },
      );
    }
  }
  throw e;
};
