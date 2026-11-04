"use client";
import dynamic from "next/dynamic";

// WebGL only runs in the browser, so the film loads client-side.
const Film = dynamic(() => import("./Film"), { ssr: false, loading: () => <div className="fixed inset-0 bg-black" /> });

export function FilmLoader() {
  return <Film />;
}
