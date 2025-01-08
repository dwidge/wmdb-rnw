// Copyright DWJ 2024.
// Distributed under the Boost Software License, Version 1.0.
// https://www.boost.org/LICENSE_1_0.txt

import { ApiItem, assert, BaseApiHooks } from "@dwidge/crud-api-react";
import {
  AsyncDispatch,
  AsyncState,
  useAsyncSaveState,
  useMemoValue,
} from "@dwidge/hooks-react";
import { BigIntBase32, getUnixTimestamp } from "@dwidge/randid";
import { dropUndefined, mergeObject } from "@dwidge/utils-js";
import type { Database } from "@nozbe/watermelondb";
import { Model, Q } from "@nozbe/watermelondb";
import { useWmdbQuery } from "./useWmdbQuery";

export type ConvertItem<A, D> = (v: A) => D;
export type AssertItem<T> = ConvertItem<T, T>;
export type ParseItem<T> = ConvertItem<any, T>;

export const useWatermelonLocal = <
  W extends Model,
  T extends ApiItem,
  PK = Pick<T, "id">,
>(
  parse: ParseItem<Partial<T>>,
  allColumns: string[],
  table: string,
  database: Database,
): BaseApiHooks<T, PK> => {
  type PT = Partial<T>;
  const useList = (
    filter: T = {} as T,
    { columns = allColumns } = {},
    items = useGetList(filter, { columns }),
    setItems = useSetList(),
    delItems = useDeleteList(),
  ): [
    items?: PT[],
    setItems?: (v: PT[]) => Promise<PT[]>,
    delItems?: (v: PT[]) => Promise<PT[]>,
  ] => [items, setItems, delItems];

  assert(Array.isArray(allColumns), "useWatermelonLocalE1");

  const useGetList = (
    filter: PT = {} as PT,
    { columns = allColumns } = {},
  ): PT[] | undefined => (
    assert(Array.isArray(columns), "useGetListE1"),
    useMemoValue(
      (v) => v?.map(parse),
      [
        useWmdbQuery<W>(
          table,
          [
            ...Object.entries(dropUndefined(filter)).map(([k, v]) =>
              Array.isArray(v)
                ? Q.or(...v.map((val) => Q.where(k, val)))
                : Q.where(k, v),
            ),
            ...(columns.includes("deletedAt")
              ? []
              : [Q.where("deletedAt2", null)]),
          ],
          columns,
        ),
      ],
    )
  );

  const useSetList = () => updateItems;
  const useCreateList = () => createItems;
  const useUpdateList = () => updateItems;
  const useDeleteList = () => deleteItems;

  const useItem = (
    filter?: T,
    { columns = allColumns } = {},
    getItem = useGetItem(filter, { columns }),
    setItem = useSetItem(),
  ): AsyncState<PT | null> =>
    useAsyncSaveState([
      getItem,
      setItem,
    ]) as unknown as AsyncState<Partial<T> | null>;

  const useGetItem = (
    filter?: T,
    { columns = allColumns } = {},
  ): PT | null | undefined =>
    useMemoValue(
      (v) => (v === undefined ? undefined : (v[0] ?? null)),
      [useGetList(filter, { columns })],
    );

  const createItem = async (item: PT) => (await createItems([item]))[0];
  // const updateItem = async (item: PT) => (await updateItems([item]))[0];
  const deleteItem = async (item: PT) => (await deleteItems([item]))[0];

  const useSetItem =
    (
      { id }: PT = {} as PT,
    ): AsyncDispatch<React.SetStateAction<PT | null>> | undefined =>
    async (
      v: React.SetStateAction<PT | null>,
      next = typeof v === "function" ? v({} as PT) : v,
    ) =>
      next != null
        ? id
          ? updateItem({ id, ...next })
          : createItem({ ...next })
        : id
          ? deleteItem({ id } as PT)
          : null;

  const deleteItemWmdbSingle = async (item: PT) =>
    (await deleteItemsWmdb([item]))[0];

  const useCreateItem = () => createItem;
  const useUpdateItem = () => updateItem;
  const useDeleteItem = () => deleteItem;

  const createItems = async (items: PT[]) => {
    let created: PT[] = [];
    await database.write(() => {
      const collection = database.get<W>(table);
      const preparedCreates = items.map(parse).map((item) =>
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

  const updateItem = async ({ id, ...item }: PT) =>
    id == null
      ? createItem(item as Partial<T>)
      : parse(
          await database.write(() =>
            database
              .get<W>(table)
              .find(BigIntBase32.parse(id))
              .then((r) =>
                r.update((v) =>
                  mergeObject(v, {
                    updatedAt2: getUnixTimestamp(),
                    ...parse(item),
                  }),
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
    updateItems(items.map((v) => ({ ...v, deletedAt2: getUnixTimestamp() })));

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
