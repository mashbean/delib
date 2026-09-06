export const CAPABILITY_QUERY_KEYS = Object.freeze(["admin", "token", "adminToken", "access"]);

/** Resolve a station URL within one fixed service origin. No open proxy or redirect. */
export function buildToolUrl(stationUrl, station, serviceOrigin) {
  const source = new URL(stationUrl);
  const origin = new URL(serviceOrigin).origin;
  const prefix = source.pathname.split("/")[1];
  if (![station.slug, ...station.aliases].includes(prefix)) throw new Error("Unknown station route");
  let path = source.pathname.slice(prefix.length + 1) || "/";
  // Encoded separators and dot segments must never change the selected origin.
  if (path.startsWith("//") || /%2f|%5c|\\/i.test(path)) throw new Error("Invalid activity path");
  if (station.slug === "rank") path = "/integrations/power-ranker";
  else if (path === "/" && source.searchParams.get("lang") === "en") {
    if (station.slug === "polis") path = "/en";
    if (station.slug === "call-in") path = "/en/";
  }
  const target = new URL(path, origin);
  if (target.origin !== origin) throw new Error("Activity must stay on the selected service");
  target.search = source.search;
  target.hash = source.hash;
  // Older links sometimes put management keys in the query. Move them to the
  // browser-only fragment before loading the service and replace the station
  // URL too. Never copy them to the hub or the next tool.
  const fragment = new URLSearchParams(target.hash.replace(/^#/, ""));
  const capabilityKey = station.slug === "polis" ? "token" : station.slug === "call-in" ? "access" : "admin";
  for (const key of CAPABILITY_QUERY_KEYS) {
    const value = target.searchParams.get(key);
    if (value && !fragment.has(capabilityKey)) fragment.set(capabilityKey, value);
    target.searchParams.delete(key);
  }
  if (CAPABILITY_QUERY_KEYS.some((key) => source.searchParams.has(key))) {
    target.hash = fragment.toString();
  }
  return target;
}

export function stationNavigationUrl(slug, language) {
  return `/${slug}?lang=${language === "en" ? "en" : "zh"}`;
}

export function activityToStationUrl(activityUrl, station, serviceOrigin, hubOrigin, language) {
  const activity = new URL(activityUrl);
  if (activity.origin !== new URL(serviceOrigin).origin || activity.username || activity.password) {
    throw new Error("Use a link from this tool");
  }
  const target = new URL(`/${station.slug}${activity.pathname === "/" ? "" : activity.pathname}`, hubOrigin);
  target.search = activity.search;
  target.searchParams.set("lang", language === "en" ? "en" : "zh");
  target.hash = activity.hash;
  const resolved = buildToolUrl(target.href, station, serviceOrigin);
  for (const key of CAPABILITY_QUERY_KEYS) target.searchParams.delete(key);
  target.hash = resolved.hash;
  return target;
}
