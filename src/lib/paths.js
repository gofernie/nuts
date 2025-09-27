// Minimal, robust path helpers that DON'T require generated variants

const val = (s) => (s ?? "").toString().trim();

/** Normalizes hero image paths (defaults to /img/hero). */
export function heroPath(s) {
  const v = val(s);
  if (!v) return "";
  if (v.startsWith("http")) return v;   // external
  if (v.startsWith("/")) return v;      // absolute
  if (/^images\//i.test(v)) return `/${v}`;
  if (/^img\//i.test(v)) return `/${v}`;
  if (/^hero\//i.test(v)) return `/img/${v}`;
  return `/img/hero/${v}`;
}

/** Thumbnails (cards) – keep original path; no variants. */
export function thumbPath(s) {
  const v = val(s);
  if (!v) return "";
  if (v.startsWith("http")) return v;
  if (v.startsWith("/")) return v;
  if (/^images?\//i.test(v)) return `/${v}`;
  if (/^img\//i.test(v)) return `/${v}`;
  return `/img/${v}`;
}
