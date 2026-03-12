export interface LoggerPort {
  logInformation: (...args: unknown[]) => void;
  logWarning: (...args: unknown[]) => void;
}
