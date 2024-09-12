// Copyright DWJ 2024.
// Distributed under the Boost Software License, Version 1.0.
// https://www.boost.org/LICENSE_1_0.txt

import Constants, { ExecutionEnvironment } from "expo-constants";
import { createAdapterLoki } from "./adapterLoki.js";
import { createAdapterSQLite } from "./adapterSqlite.js";

export const createAdapter =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient
    ? createAdapterLoki
    : createAdapterSQLite;
