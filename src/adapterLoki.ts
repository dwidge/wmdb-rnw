// Copyright DWJ 2024.
// Distributed under the Boost Software License, Version 1.0.
// https://www.boost.org/LICENSE_1_0.txt

// Modified from:
// https://github.com/Nozbe/WatermelonDB/issues/1796

import LokiJSAdapter, {
  type LokiAdapterOptions,
} from "@nozbe/watermelondb/adapters/lokijs";
import { type SQLiteAdapterOptions } from "@nozbe/watermelondb/adapters/sqlite/type";

export const createAdapterLoki = (
  options: Pick<
    LokiAdapterOptions,
    // Accept only the options shared between LokiAdapterOptions and SQLiteAdapterOptions
    Extract<keyof LokiAdapterOptions, keyof SQLiteAdapterOptions>
  >
) =>
  new LokiJSAdapter({
    useWebWorker: false,
    useIncrementalIndexedDB: true,
    ...options,
  });
