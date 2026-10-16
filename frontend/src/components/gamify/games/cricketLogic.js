// Pure rules for the cricket batting game: how a swing's timing, the shot direction
// and the line of the ball turn into runs or a wicket.

export const BALLS = 12; // two overs
export const WICKETS = 3;

// Timing windows in seconds either side of the ideal contact moment.
export const WINDOW = { six: 0.06, four: 0.13, run: 0.24, edge: 0.36 };

// err: swing time minus the moment the ball reached the bat (negative = early).
// aim: -1 (off side) | 0 (straight) | 1 (leg side). line: where the ball is
// pitched: -1 | 0 (on the stumps) | 1. rand: injectable for tests.
export function judge(err, aim, line, rand = Math.random) {
  const a = Math.abs(err);
  if (a > WINDOW.edge) {
    const bowled = line === 0 && rand() < 0.85;
    return { runs: 0, wicket: bowled, kind: bowled ? 'bowled' : 'miss', dir: 0, msg: bowled ? 'Bowled! Right through the gate' : (err < 0 ? 'Swing and a miss' : 'Too late, it sneaks past') };
  }
  // hitting across the line of the ball spoils the shot
  const crossed = line !== 0 && aim === -line;
  let runs;
  let kind = 'run';
  if (a <= WINDOW.six) { runs = 6; kind = 'six'; } else if (a <= WINDOW.four) { runs = 4; kind = 'four'; } else if (a <= WINDOW.run) { const r = rand(); runs = r < 0.5 ? 1 : r < 0.85 ? 2 : 3; } else {
    if (rand() < 0.45) return { runs: 0, wicket: true, kind: 'caught', dir: aim, msg: 'Edged and caught!' };
    return { runs: 1, wicket: false, kind: 'run', dir: aim, msg: 'Thick edge, they scamper a single' };
  }
  if (crossed) {
    if (runs === 6) { runs = 4; kind = 'four'; } else if (runs === 4) { runs = 2; kind = 'run'; } else runs = 1;
  }
  const msg = runs === 6 ? 'SIX! Out of the ground' : runs === 4 ? 'FOUR! Cracked through the field' : runs === 0 ? 'Dot ball' : `${runs} run${runs > 1 ? 's' : ''}`;
  return { runs, wicket: false, kind, dir: aim, msg };
}

// A ball nobody swung at: stumps are hit only when it was pitched on the line.
export function leave(line, rand = Math.random) {
  const bowled = line === 0 && rand() < 0.85;
  return { runs: 0, wicket: bowled, kind: bowled ? 'bowled' : 'leave', dir: 0, msg: bowled ? 'Bowled! You left a straight one' : 'Left alone, wide of the stumps' };
}

// Next delivery: faster balls come later in the innings.
export function nextBall(index, rand = Math.random) {
  const line = [-1, 0, 0, 1][Math.floor(rand() * 4)];
  const base = index < 4 ? 1.5 : index < 8 ? 1.25 : 1.05;
  const dur = base + (rand() - 0.5) * 0.3;
  return { line, dur };
}
