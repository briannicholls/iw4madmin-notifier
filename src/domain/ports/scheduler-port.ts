export interface SchedulerPort {
  requestNotifyAfterDelay: (delayMs: number, callback: () => void) => void;
}
