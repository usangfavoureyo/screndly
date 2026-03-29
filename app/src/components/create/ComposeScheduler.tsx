export function ComposeScheduler() {
  // Scheduled compose publishing now runs from the backend cron worker.
  // Keeping this component mounted avoids changing the app shell.
  return null;
}
