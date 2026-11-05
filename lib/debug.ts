/** QA: ?off=bloom,optics,... switches render passes off, to find what a frame costs. */
export const OFF = new Set(
  (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("off") ?? "" : "").split(",").filter(Boolean),
);
