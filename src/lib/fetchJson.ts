export async function getJson<T = unknown>(url: string): Promise<T> {
  if (!url) throw new Error("getJson: url is empty");
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`getJson: ${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}
