import posthog from "./posthog.js";

function write(level, message, attributes) {
  posthog?.logger?.[level]?.(message, attributes);
}

export const posthogLogger = {
  info(message, attributes = {}) {
    write("info", message, attributes);
  },
  warn(message, attributes = {}) {
    write("warn", message, attributes);
  },
};
