/**
 * Chrome and Edge announce that the site can be installed with a `beforeinstallprompt` event, which
 * can fire before React has started. This inline <head> script keeps it on `window` (and stops the
 * browser's own install banner) until components/pwa.tsx takes it over and offers it in our UI.
 */
export const INSTALL_PROMPT_GLOBAL = "__qjInstallPrompt";

export const installPromptScript = `addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.${INSTALL_PROMPT_GLOBAL}=e});`;
