import { elapsedTime } from '../helpers/elapsedTime';

/** Relative label with the viewer's local date and time available on hover. */
export function RelativeTime({ dateTime }: { dateTime: string }) {
  const date = new Date(dateTime);

  return (
    <time dateTime={dateTime} title={date.toLocaleString()}>
      {elapsedTime(dateTime)}
    </time>
  );
}
