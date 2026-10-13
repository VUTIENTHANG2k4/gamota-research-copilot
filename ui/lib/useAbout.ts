"use client";

import { useEffect, useState } from "react";
import { api, type About } from "./api";

let cached: Promise<About> | null = null;

/** GET /api/about once per page load; `null` while loading or when it failed (callers must handle that). */
export function useAbout(): About | null {
  const [about, setAbout] = useState<About | null>(null);
  useEffect(() => {
    let alive = true;
    if (!cached) cached = api.about();
    cached.then(
      (a) => alive && setAbout(a),
      () => {
        cached = null; // retry on next mount
      },
    );
    return () => {
      alive = false;
    };
  }, []);
  return about;
}
