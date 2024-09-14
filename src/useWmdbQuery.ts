// Copyright DWJ 2024.
// Distributed under the Boost Software License, Version 1.0.
// https://www.boost.org/LICENSE_1_0.txt

// Modified from:
// https://github.com/Nozbe/WatermelonDB/issues/1796

import { useDatabase } from "@nozbe/watermelondb/react";
import type { Model, Q, TableName } from "@nozbe/watermelondb";
import { useEffect, useState } from "react";

/**
 * A custom hook to query items from the WatermelonDB database.
 *
 * @template T - The type of the model.
 * @param {TableName<T>} tableName - The name of the table to query.
 * @param {Q.Clause[]} [query=[]] - An array of query clauses.
 * @returns {T[] | undefined} - An array of items or undefined.
 */
export const useWmdbQuery = <T extends Model>(
  tableName: TableName<T>,
  query: Q.Clause[] = []
): T[] | undefined => {
  const [items, setItems] = useState<T[]>();
  const db = useDatabase();

  useEffect(() => {
    const subscription = db
      .get<T>(tableName)
      .query(query)
      .observe()
      .subscribe((items) => {
        setItems(items);
      });

    return () => {
      subscription.unsubscribe();
    };
  }, [db]);

  return items;
};
