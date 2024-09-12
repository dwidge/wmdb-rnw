// Copyright DWJ 2024.
// Distributed under the Boost Software License, Version 1.0.
// https://www.boost.org/LICENSE_1_0.txt

// Modified from:
// https://github.com/Nozbe/WatermelonDB/issues/1796

import { type LokiAdapterOptions } from "@nozbe/watermelondb/adapters/lokijs";
import SQLiteAdapter from "@nozbe/watermelondb/adapters/sqlite";
import { SQLiteAdapterOptions } from "@nozbe/watermelondb/adapters/sqlite/type";

export const createAdapterSQLite = (
  options: Pick<
    SQLiteAdapterOptions,
    // Accept only the options shared between SQLiteAdapterOptions and LokiAdapterOptions
    Extract<keyof SQLiteAdapterOptions, keyof LokiAdapterOptions>
  >
) =>
  new SQLiteAdapter({
    jsi: false,
    ...options,
  });
