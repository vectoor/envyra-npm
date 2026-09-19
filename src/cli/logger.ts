/**
 * Minimal logger interface so CLI commands stay testable: tests inject a
 * capturing logger, the real binary injects the console.
 */
export interface Logger {
  log(message: string): void;
  error(message: string): void;
}

export const consoleLogger: Logger = {
  log: (message) => console.log(message),
  error: (message) => console.error(message),
};
