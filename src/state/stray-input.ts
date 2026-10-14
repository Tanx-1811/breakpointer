/**
 * Input that reached the workspace although it was aimed at a preview frame.
 *
 * Chrome can stop routing input to cross-origin frames: when a frame moves or
 * changes size just as its page finishes loading, the browser can keep stale
 * hit-test data for the frames. Clicks, wheel turns and pointer moves over every
 * preview then reach the workspace instead, aimed at the <iframe> element, until
 * a frame moves again. Moving the frames by a fraction of a pixel and back makes
 * Chrome rebuild that data.
 *
 * Otherwise the workspace never gets a press or a wheel turn aimed at a preview.
 * It gets at most one pointer move, as the pointer crosses a frame's edge. So a
 * press, a wheel turn or a few moves in a row mean the frames need that refresh.
 */
export type StrayInputKind = 'press' | 'wheel' | 'move';

/** Moves in a row that count as stray (one comes as the pointer enters a frame)… */
export const STRAY_MOVES = 3;
/** …within this many milliseconds. */
export const MOVE_WINDOW_MS = 400;
/** At most one refresh in this long. */
export const REFRESH_COOLDOWN_MS = 1000;

export type StrayInputMonitor = {
  /** Records stray input at `time` (the event's timeStamp, ms); true when the frames should be refreshed now. */
  note: (kind: StrayInputKind, time: number) => boolean;
};

export function createStrayInputMonitor(): StrayInputMonitor {
  let moves: number[] = [];
  let lastRefresh = Number.NEGATIVE_INFINITY;
  return {
    note(kind, time) {
      if (kind === 'move') {
        moves = [...moves.filter((at) => time - at < MOVE_WINDOW_MS), time];
        if (moves.length < STRAY_MOVES) return false;
      }
      if (time - lastRefresh < REFRESH_COOLDOWN_MS) return false;
      moves = [];
      lastRefresh = time;
      return true;
    },
  };
}
