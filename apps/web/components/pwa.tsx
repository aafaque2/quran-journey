"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useHydrated } from "@/lib/prefs-client";
import { INSTALL_PROMPT_GLOBAL } from "@/lib/install-prompt";
import { CheckIcon, CloseIcon } from "./icons";

/** Chromium's install offer (not in TypeScript's DOM types). */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
type WindowWithPrompt = Window & { [INSTALL_PROMPT_GLOBAL]?: BeforeInstallPromptEvent };

// The install offer is captured once, globally (first by a tiny script in <head>, see
// lib/install-prompt.ts, then by <AppSetup>), so any component can offer it later.
let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installedNow = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const offlineEnabled = process.env.NODE_ENV === "production";

/** Registers the service worker, keeps pages for offline reading, and holds the install offer. Mounted once, in the layout. */
export function AppSetup() {
  const pathname = usePathname();

  useEffect(() => {
    const w = window as WindowWithPrompt;
    if (w[INSTALL_PROMPT_GLOBAL]) {
      deferredPrompt = w[INSTALL_PROMPT_GLOBAL];
      delete w[INSTALL_PROMPT_GLOBAL];
      notify();
    }
    const onPrompt = (e: Event) => {
      e.preventDefault(); // offered in our own UI instead of the browser's banner
      deferredPrompt = e as BeforeInstallPromptEvent;
      delete w[INSTALL_PROMPT_GLOBAL];
      notify();
    };
    const onInstalled = () => {
      installedNow = true;
      deferredPrompt = null;
      notify();
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    if (offlineEnabled && "serviceWorker" in navigator) {
      const register = async () => {
        try {
          const firstVisit = !navigator.serviceWorker.controller;
          const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
          if (!firstVisit) return;
          // This page loaded before the worker existed: hand it the page and the build files it used.
          await navigator.serviceWorker.ready;
          const files = performance
            .getEntriesByType("resource")
            .map((e) => e.name)
            .filter((name) => name.startsWith(`${location.origin}/_next/static/`));
          registration.active?.postMessage({ type: "CACHE_URLS", urls: [location.pathname, ...files] });
        } catch {
          /* offline reading is a bonus; the site works without it */
        }
      };
      if (document.readyState === "complete") void register();
      else window.addEventListener("load", () => void register(), { once: true });
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // In-app links load a page's data, not the page, so the worker never sees it: ask it to keep a copy.
  useEffect(() => {
    if (offlineEnabled) navigator.serviceWorker?.controller?.postMessage({ type: "CACHE_URLS", urls: [pathname] });
  }, [pathname]);

  return null;
}

type InstallState = "standalone" | "installed" | "prompt" | "ios" | "manual";

function useInstallState(): InstallState | null {
  const hydrated = useHydrated();
  const snapshot = useSyncExternalStore<"installed" | "prompt" | "none">(
    subscribe,
    () => (installedNow ? "installed" : deferredPrompt ? "prompt" : "none"),
    () => "none",
  );
  if (!hydrated) return null;
  if (isStandalone()) return "standalone";
  if (snapshot !== "none") return snapshot;
  return isIos() ? "ios" : "manual";
}

async function promptInstall() {
  const event = deferredPrompt;
  if (!event) return;
  deferredPrompt = null; // an offer can be shown once
  await event.prompt();
  if ((await event.userChoice).outcome === "accepted") installedNow = true;
  notify();
}

/** Settings → "On your phone": the way to install in this browser. */
export function InstallApp() {
  const state = useInstallState();
  if (!state) return <div className="h-12" aria-busy="true" />;
  if (state === "standalone" || state === "installed")
    return (
      <p className="inline-flex items-center gap-2 text-sm text-ink-2">
        <CheckIcon className="h-4 w-4 text-accent" />
        {state === "standalone" ? "You're using the installed app." : "Installed. Open it from your home screen or app list."}
      </p>
    );
  if (state === "prompt")
    return (
      <button type="button" className="btn-primary" onClick={() => void promptInstall()}>
        Install the app
      </button>
    );
  if (state === "ios")
    return (
      <ol className="list-decimal space-y-1 ps-5 text-sm leading-relaxed text-ink-2">
        <li>Tap the Share button in the browser bar.</li>
        <li>Choose &ldquo;Add to Home Screen&rdquo;.</li>
        <li>Open it from your home screen: it runs full-screen, like an app.</li>
      </ol>
    );
  return (
    <p className="text-sm leading-relaxed text-ink-2">
      On Android, open this site in Chrome and choose &ldquo;Install app&rdquo; (or &ldquo;Add to Home screen&rdquo;) from the ⋮ menu. On a
      computer, Chrome and Edge show an install button in the address bar; in Safari on a Mac, choose File → Add to Dock.
    </p>
  );
}

type SaveStatus = { state: "saving" | "done"; done: number; failed: number; total: number } | { state: "unavailable" };

/** Settings → save every Part on this device for reading without a connection. */
export function SaveForOffline({ paths }: { paths: string[] }) {
  const hydrated = useHydrated();
  const [status, setStatus] = useState<SaveStatus | null>(null);

  const save = async () => {
    const worker = (await navigator.serviceWorker.getRegistration())?.active;
    if (!worker) return setStatus({ state: "unavailable" });
    // Ask the browser not to clear saved Parts when space runs low (granted silently to installed apps).
    void navigator.storage?.persist?.().catch(() => false);
    setStatus({ state: "saving", done: 0, failed: 0, total: paths.length });
    const channel = new MessageChannel();
    channel.port1.onmessage = (e: MessageEvent<{ type: string; done: number; failed: number; total: number }>) =>
      setStatus({ state: e.data.type === "DONE" ? "done" : "saving", done: e.data.done, failed: e.data.failed, total: e.data.total });
    worker.postMessage({ type: "CACHE_URLS", urls: paths }, [channel.port2]);
  };

  if (!hydrated) return <div className="h-12" aria-busy="true" />;
  if (!offlineEnabled || !("serviceWorker" in navigator))
    return <p className="text-sm text-ink-3">Offline reading isn&apos;t available in this browser.</p>;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" className="btn-secondary" onClick={() => void save()} disabled={status?.state === "saving"}>
        Save all {paths.length} Parts for offline reading
      </button>
      {status && (
        <p className="text-sm text-ink-2" aria-live="polite">
          {status.state === "unavailable"
            ? "Offline saving isn't ready yet. Reload the page and try again."
            : status.state === "saving"
              ? `Saving… ${status.done + status.failed} of ${status.total}`
              : status.failed
                ? `Saved ${status.done} of ${status.total}. ${status.failed} couldn't be saved: try again when you're online.`
                : `All ${status.total} Parts are saved on this device.`}
        </p>
      )}
    </div>
  );
}

const HINT_KEY = "qj.install-hint.dismissed";

/** A small, dismissible suggestion on the home page, shown only on phones that can install the app. */
export function InstallHint() {
  const state = useInstallState();
  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(HINT_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);
  if (dismissed || (state !== "prompt" && state !== "ios")) return null;
  if (!window.matchMedia("(max-width: 1023px)").matches) return null;
  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(HINT_KEY, "1");
    } catch {
      /* fine: it shows again next time */
    }
  };
  return (
    <div className="relative rounded-2xl border border-line bg-surface p-5 pe-11 text-sm leading-relaxed text-ink-2">
      <button type="button" className="icon-btn absolute end-2 top-2 h-8 w-8" onClick={dismiss} aria-label="Dismiss">
        <CloseIcon className="h-4 w-4" />
      </button>
      <p className="font-semibold text-ink">Read it like an app</p>
      <p className="mt-1">Add the journey to your home screen. It opens full-screen, and the Parts you&apos;ve read stay readable offline.</p>
      {state === "prompt" ? (
        <button type="button" className="btn-primary mt-3" onClick={() => void promptInstall()}>
          Install
        </button>
      ) : (
        <p className="mt-2">
          Tap Share, then <span className="font-medium text-ink">Add to Home Screen</span>.{" "}
          <Link href="/settings#install" className="text-accent underline-offset-2 hover:underline">
            More
          </Link>
        </p>
      )}
    </div>
  );
}

/** The offline page: lists the Parts saved on this device. */
export function SavedParts() {
  const [parts, setParts] = useState<number[] | null>(null);
  useEffect(() => {
    (async () => {
      if (!("caches" in window)) return setParts([]);
      const found = new Set<number>();
      for (const name of await caches.keys()) {
        if (!name.startsWith("qj-pages-")) continue;
        for (const request of await (await caches.open(name)).keys()) {
          const m = new URL(request.url).pathname.match(/^\/parts\/(\d+)$/);
          if (m) found.add(Number(m[1]));
        }
      }
      setParts([...found].sort((a, b) => a - b));
    })().catch(() => setParts([]));
  }, []);
  if (!parts) return null;
  if (!parts.length) return <p className="mt-6 text-ink-2">No Parts are saved on this device yet. Open a Part while online to keep it for later.</p>;
  return (
    <div className="mt-6">
      <p className="text-sm text-ink-3">Saved on this device:</p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {parts.map((n) => (
          <li key={n}>
            {/* A full page load, which the service worker answers from its saved copy. */}
            <a href={`/parts/${n}`} className="btn-secondary">
              Part {n}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
