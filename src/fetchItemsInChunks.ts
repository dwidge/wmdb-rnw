import { ApiRecord, ExtendedApi } from "@dwidge/crud-api-react";

export const fetchItemsInChunks = async <T extends ApiRecord>(
  api: ExtendedApi<T>,
  limit: number,
) => {
  let items: T[] = [];
  let offset = 0;
  let responseItems;

  do {
    responseItems = await api.getList(undefined, { offset, limit });
    items = items.concat(responseItems);
    offset += limit;
  } while (responseItems.length === limit);

  return items;
};
