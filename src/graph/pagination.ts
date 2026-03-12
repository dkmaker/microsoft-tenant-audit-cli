import { Client, PageIterator, type PageCollection } from "@microsoft/microsoft-graph-client";

export type ApiVersion = "v1.0" | "beta";

export async function getAllItems<T>(
  client: Client,
  endpoint: string,
  apiVersion: ApiVersion = "v1.0",
): Promise<T[]> {
  const items: T[] = [];

  let request = client.api(endpoint);
  if (apiVersion === "beta") {
    request = request.version("beta");
  }

  const response: PageCollection = await request.get();

  const callback = (item: T): boolean => {
    items.push(item);
    return true;
  };

  const pageIterator = new PageIterator(client, response, callback);
  await pageIterator.iterate();

  return items;
}
