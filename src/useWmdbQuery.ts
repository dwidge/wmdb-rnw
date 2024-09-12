// Copyright DWJ 2024.
// Distributed under the Boost Software License, Version 1.0.
// https://www.boost.org/LICENSE_1_0.txt

// Modified from:
// https://github.com/Nozbe/WatermelonDB/issues/1796

import { useDatabase } from "@nozbe/watermelondb/react";
import type { Model, Q, TableName } from "@nozbe/watermelondb";
import { useEffect, useState } from "react";

export const useWmdbQuery = <T extends Model>(
  tableName: TableName<T>,
  query: Q.Clause[] = []
) => {
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
