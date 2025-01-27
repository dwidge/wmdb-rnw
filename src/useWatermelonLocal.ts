// Copyright DWJ 2024.
// Distributed under the Boost Software License, Version 1.0.
// https://www.boost.org/LICENSE_1_0.txt

import {
  assert,
  BaseApiHooks,
  QueryOptions,
  StringKey,
} from "@dwidge/crud-api-react";
import { AsyncDispatch, AsyncState, useMemoValue } from "@dwidge/hooks-react";
import { BigIntBase32, getUnixTimestamp } from "@dwidge/randid";
import { dropUndefined, mergeObject } from "@dwidge/utils-js";
import type { Database } from "@nozbe/watermelondb";
import { Model, Q } from "@nozbe/watermelondb";
import { useMemo } from "react";
import { useWmdbQuery } from "./useWmdbQuery.js";

export type ConvertItem<A, D> = (v: A) => D;
export type AssertItem<T> = ConvertItem<T, T>;
export type ParseItem<T> = ConvertItem<any, T>;

export const useWatermelonLocal = <
  W extends Model,
  T extends {
    id: string;
    updatedAt: number;
    createdAt: number;
    deletedAt: number | null;
  },
  PK = Pick<T, "id">,
>(
  parse: ParseItem<Partial<T>>,
  allColumns: string[],
  table: string,
  database: Database,
): BaseApiHooks<T, PK> => {
  type PT = Partial<T>;
  type K = StringKey<T>;
  assert(Array.isArray(allColumns), "useWatermelonLocalE1");
  const defaultGetColumns = allColumns.filter((v) => v !== "deletedAt") as K[];

  const useList = (
    filter?: T,
    options?: QueryOptions<K>,
    items = useGetList(filter, options),
    setItems = useSetList(filter),
    delItems = useDeleteList(),
  ): [
    items?: PT[],
    setItems?: (v: PT[]) => Promise<PT[]>,
    delItems?: (v: PT[]) => Promise<PT[]>,
  ] => [items, setItems, delItems];

  const useGetList = (
    filter?: PT,
    { columns = defaultGetColumns, ...options }: QueryOptions<K> = {},
  ): PT[] | undefined => (
    assert(Array.isArray(columns), "useGetListE1"),
    useMemoValue(
      (v, filter) => (
        v && v.length > 500
          ? console.warn(
              "useGetListE2: More than 500 items returned by query. Fix the query or add offset and limit to improve performance.",
              { filter, columns },
            )
          : {},
        filter ? v?.map(parse) : undefined
      ),
      [
        useWmdbQuery<W>(
          table,
          useMemo(
            () =>
              filter
                ? [
                    ...Object.entries(dropUndefined(filter ?? ({} as PT))).map(
                      ([k, v]) =>
                        Array.isArray(v)
                          ? Q.or(...v.map((val) => Q.where(k, val)))
                          : Q.where(k, v),
                    ),
                    ...(columns.includes("deletedAt" as StringKey<T>)
                      ? []
                      : [Q.where("deletedAt", null)]),
                  ]
                : [Q.where("id", null)],
            [JSON.stringify(filter ?? null), JSON.stringify(columns)],
          ),
          useMemo(
            () => ({ columns, ...options }) as any,
            [JSON.stringify({ columns, ...options })],
          ),
        ),
        JSON.stringify(filter ?? null),
      ] as const,
    )
  );

  const useSetList = (filter?: PT) => (items: PT[]) =>
    updateItems(
      items.map((v) => parse({ ...v, ...dropUndefined(filter ?? {}) })),
    );
  const useCreateList = (filter?: PT) => (items: PT[]) =>
    createItems(
      items.map((v) => parse({ ...v, ...dropUndefined(filter ?? {}) })),
    );
  const useUpdateList = () => (items: PT[]) => updateItems(items.map(parse));
  const useDeleteList = () => (items: PT[]) => deleteItems(items.map(parse));

  const useItem = (
    filter?: T,
    { columns = defaultGetColumns } = {},
    getItem = useGetItem(filter, { columns }),
    setItem = useSetItem(filter),
  ): AsyncState<PT | null> => [
    getItem,
    setItem
      ? (
          getValue,
          newValue = typeof getValue === "function"
            ? getValue(getItem ?? null)
            : getValue,
        ) => setItem({ ...getItem, ...newValue } as Partial<T> | null)
      : undefined,
  ];

  const useGetItem = (
    filter?: T,
    { columns = defaultGetColumns } = {},
  ): PT | null | undefined =>
    useMemoValue(
      (v, filter) => (v === undefined ? undefined : (v[0] ?? null)),
      [useGetList(filter, { columns }), JSON.stringify(filter)] as const,
    );

  const createItem = async (item: PT): Promise<PT> =>
    (await createItems([item]))[0]!;
  // const updateItem = async (item: PT) => (await updateItems([item]))[0];
  const deleteItem = async (item: PT): Promise<PT> =>
    (await deleteItems([item]))[0]!;

  const useSetItem =
    ({ id, ...filter }: PT = {} as PT): AsyncDispatch<PT | null> | undefined =>
    async (
      v: React.SetStateAction<PT | null>,
      next = typeof v === "function"
        ? v({ id, ...dropUndefined(filter) } as PT)
        : v,
    ) =>
      next != null
        ? updateItem({ id, ...next, ...dropUndefined(filter) })
        : id
          ? deleteItem({ id } as PT)
          : null;

  const deleteItemWmdbSingle = async (item: PT) =>
    (await deleteItemsWmdb([item]))[0];

  const useCreateItem = (filter?: PT) =>
    filter
      ? (item: PT) => createItem({ ...item, ...dropUndefined(filter) })
      : createItem;
  const useUpdateItem = () => updateItem;
  const useDeleteItem = () => deleteItem;

  const createItems = async (items: PT[]): Promise<PT[]> => {
    let created: PT[] = [];
    await database.write(() => {
      const collection = database.get<W>(table);
      const preparedCreates = items.map(parse).map(({ id, ...item }) =>
        collection.prepareCreate(
          (v) => (
            created.push(parse({ id: v.id })),
            mergeObject(v, {
              createdAt2: getUnixTimestamp(),
              updatedAt2: getUnixTimestamp(),
              ...item,
            })
          ),
        ),
      );
      return database.batch(...preparedCreates);
    });
    return created;
  };

  const updateItem = async ({ id, ...item }: PT): Promise<Partial<T>> =>
    id == null
      ? createItem(item as Partial<T>)
      : parse(
          await database.write(() =>
            database
              .get<W>(table)
              .find(BigIntBase32.parse(id))
              .then((r) =>
                r.update(
                  (v) => (
                    mergeObject(v, {
                      updatedAt2: getUnixTimestamp(),
                      ...item,
                    }),
                    v
                  ),
                ),
              ),
          ),
        );

  const updateItems = async (items: PT[]) => {
    const updated: PT[] = [];
    for (const item of items) {
      updated.push(await updateItem(item));
    }
    return updated;
  };

  // error - cant use async await inside database.write()
  const updateItemsWmdb = async (items: PT[]) => {
    let created: PT[] = [];
    await database.write(async () => {
      const records = await database
        .get<W>(table)
        .query(
          Q.where(
            "id",
            Q.oneOf(items.map((item) => BigIntBase32.parse(item.id as string))),
          ),
        )
        .fetch();

      const preparedUpdates = records.map((record) => {
        const matchingItem = items.find((item) => item.id === record.id);
        return record.prepareUpdate(
          (v) => (
            created.push(parse({ id: v.id })),
            mergeObject(v, {
              updatedAt2: getUnixTimestamp(),
              ...parse(matchingItem),
            })
          ),
        );
      });
      return database.batch(...preparedUpdates);
    });
    return created;
  };

  const deleteItems = async (items: PT[]) =>
    updateItems(
      items.map((v) => ({
        ...parse(v),
        deletedAt2: getUnixTimestamp(),
      })),
    );

  const deleteItemsWmdb = async (items: PT[]) => {
    return await database.write(async () => {
      const collection = database.get<W>(table);
      const records = await collection
        .query(
          Q.where(
            "id",
            Q.oneOf(items.map((item) => BigIntBase32.parse(item.id as string))),
          ),
        )
        .fetch();
      const preparedDeletes = records.map((record) =>
        record.prepareMarkAsDeleted(),
      );
      return database.batch(...preparedDeletes);
    });
  };

  return {
    useGetList,
    useSetList,
    useCreateList,
    useUpdateList,
    useDeleteList,
    useList,
    useGetItem,
    useSetItem,
    useCreateItem,
    useUpdateItem,
    useDeleteItem,
    useItem,
  } as any;
};
