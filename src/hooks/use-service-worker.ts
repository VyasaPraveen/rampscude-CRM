"use client";

import { useEffect } from "react";

/** How often to ask the browser to re-check /sw.js for a newer build. */
const UPDATE_CHECK_MS = 60_000;

export function useServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;

    let interval: ReturnType<typeof setInterval> | undefined;

    // When a freshly installed worker takes control (i.e. a new build shipped),
    // reload once so an open tab / installed PWA never stays on a stale version.
    let reloading = false;
    const onControllerChange = () => {
      if (reloading || !navigator.serviceWorker.controller) return;
      reloading = true;
      window.location.reload();
    };
    // Only auto-reload when this page was already controlled — the very first
    // install has no prior controller and must not trigger a reload loop.
    const hadController = Boolean(navigator.serviceWorker.controller);
    if (hadController) navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        void registration.update();
        interval = setInterval(() => void registration.update(), UPDATE_CHECK_MS);
      })
      .catch(() => undefined);

    return () => {
      if (interval) clearInterval(interval);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);
}
