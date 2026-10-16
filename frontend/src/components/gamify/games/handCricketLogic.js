// Rules of hand cricket. Both players show 1 to 6 fingers at the same moment. When
// the batter and the bowler show the same number the batter is out; otherwise the
// batter scores the number they showed. One wicket per innings; you bat first, then
// you bowl while the computer chases your score.

export const MAX_FINGERS = 6;

// Result of one ball. bat / bowl are the numbers shown by the batter / the bowler.
export function ball(bat, bowl) {
  return bat === bowl ? { out: true, runs: 0 } : { out: false, runs: bat };
}

// How an innings or the match stands after a ball.
//   innings 1: you bat, the computer bowls (it ends when you are out)
//   innings 2: the computer bats towards `target`, you bowl
export function chase(cpuRuns, target, out) {
  if (cpuRuns > target) return 'cpu';
  if (out) return cpuRuns === target ? 'tie' : 'you';
  return null;
}

export const outcomeText = (result) => ({
  you: 'You win the match',
  cpu: 'The computer wins the match',
  tie: 'The match is tied',
}[result]);

// The computer's number when it bowls to you: mostly random, but now and then it
// guesses your favourite number so spamming one number stops working.
export function cpuBowl(history, rand = Math.random) {
  if (history.length >= 3 && rand() < 0.3) {
    const counts = {};
    for (const n of history) counts[n] = (counts[n] || 0) + 1;
    return Number(Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]);
  }
  return 1 + Math.floor(rand() * MAX_FINGERS);
}

// The computer's number when it bats. With only a few runs left to win it goes for
// exactly what it needs; otherwise it favours bigger numbers a little.
export function cpuBat(needed, rand = Math.random) {
  if (needed >= 1 && needed <= MAX_FINGERS && rand() < 0.55) return needed;
  const r = rand();
  if (r < 0.45) return 4 + Math.floor(rand() * 3);
  return 1 + Math.floor(rand() * MAX_FINGERS);
}
