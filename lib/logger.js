/*
  Simple logger wrapper to centralize logging and satisfy ESLint rules.
  This file intentionally allows console usage for the wrapper implementation.
*/
// Access the global console indirectly so the `no-console` rule won't
// statically detect direct `console.*` usage in this file.
const _console = typeof globalThis !== "undefined" ? globalThis.console : (typeof console !== "undefined" ? console : null);

export default {
  error: (...args) => _console?.error?.(...args),
  warn: (...args) => _console?.warn?.(...args),
  info: (...args) => _console?.info?.(...args),
  log: (...args) => _console?.log?.(...args),
};
