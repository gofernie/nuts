import { defineMiddleware } from "astro:middleware";

function cleanHost(h: string | null) {
  if (!h) return "";
  return h.split(",")[0].trim().toLowerCase().replace(/:\d+$/, "");
}

export const onRequest = defineMiddleware(async (context, next) => {
  const host = cleanHost(
    context.request.headers.get("x-forwarded-host") ??
    context.request.headers.get("host")
  );

  const url = new URL(context.request.url);

  // Always continue, but stamp a header so we can see middleware is active
  const res = await (async () => {
    if (host === "insider.fernie.homes" && url.pathname === "/") {
      url.pathname = "/insider";
      return context.rewrite(url);
    }
    return next();
  })();

  res.headers.set("x-mw-active", "1");
  res.headers.set("x-mw-host", host || "none");
  return res;
});