// /src/lib/paths.js

const val = (s) => (s ?? "").toString().trim();

/** Prefer /img/* by default (your project structure), but accept others. */
export function heroPath(s) {
  const v = val(s);
  if (!v) return "";
  if (v.startsWith("http")) return v;     // full URL
  if (v.startsWith("/")) return v;        // already absolute

  // Explicit buckets
  if (/^images\//i.test(v)) return `/${v}`;
  if (/^img\//i.test(v)) return `/${v}`;
  if (/^hero\//i.test(v)) return `/img/${v}`;      // normalize hero/* under /img
  if (/^cards?\//i.test(v)) return `/img/${v}`;

  // 👍 Default: assume /img/hero/*
  return `/img/hero/${v}`;
}

export function imgPath(s) {
  const v = val(s);
  if (!v) return "";
  if (v.startsWith("http")) return v;
  if (v.startsWith("/")) return v;

  if (/^images?\//i.test(v)) return `/${v}`;
  if (/^img\//i.test(v)) return `/${v}`;

  // generic default for card/thumb assets
  return `/img/${v}`;
}
