import { computed, reactive, ref } from "vue";
import carsRaw from "../data/cars.json";
import type { Car, GameStats, GameStatus, Guess, YearMode } from "../types/car";

const cars = carsRaw as Car[];

const MAX_GUESSES = 5;
// Index 0 = before any guess, index MAX_GUESSES = fully revealed.
const ZOOM_STAGES = [4.5, 3.2, 2.3, 1.6, 1.2, 1.0];

const STATS_KEY = "carguessr.stats";
const YEAR_MODE_KEY = "carguessr.yearMode";

function loadStats(): GameStats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (raw) return JSON.parse(raw) as GameStats;
  } catch {
    // ignore corrupt/unavailable storage
  }
  return { played: 0, won: 0, currentStreak: 0, bestStreak: 0, totalGuesses: 0 };
}

function saveStats(stats: GameStats) {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    // ignore unavailable storage
  }
}

function loadYearMode(): YearMode {
  try {
    const raw = localStorage.getItem(YEAR_MODE_KEY);
    if (raw === "none" || raw === "era" || raw === "exact") return raw;
  } catch {
    // ignore unavailable storage
  }
  return "exact";
}

function saveYearMode(mode: YearMode) {
  try {
    localStorage.setItem(YEAR_MODE_KEY, mode);
  } catch {
    // ignore unavailable storage
  }
}

// Deterministic pseudo-random focus point per car id, kept away from the edges
// so the initial zoomed crop usually lands somewhere on the car.
function focusPointFor(id: number): { x: number; y: number } {
  const a = Math.sin(id * 12.9898) * 43758.5453;
  const b = Math.sin(id * 78.233) * 12321.987;
  const frac = (n: number) => n - Math.floor(n);
  return {
    x: 20 + frac(a) * 60,
    y: 20 + frac(b) * 60,
  };
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function decadeOf(year: number): number {
  return Math.floor(year / 10) * 10;
}

function pickRandomCar(excludeId?: number): Car {
  if (cars.length === 1) return cars[0];
  let candidate: Car;
  do {
    candidate = cars[Math.floor(Math.random() * cars.length)];
  } while (candidate.id === excludeId);
  return candidate;
}

const currentCar = ref<Car>(pickRandomCar());
const guesses = ref<Guess[]>([]);
const status = ref<GameStatus>("playing");
const stats = reactive<GameStats>(loadStats());
const yearMode = ref<YearMode>(loadYearMode());

const focusPoint = computed(() => focusPointFor(currentCar.value.id));

const zoomScale = computed(() => {
  if (status.value !== "playing") return ZOOM_STAGES[MAX_GUESSES];
  return ZOOM_STAGES[guesses.value.length];
});

const guessesRemaining = computed(() => MAX_GUESSES - guesses.value.length);

// Once a field has been guessed correctly, it stays "locked in" for the rest
// of the game so the player only has to keep working on what's still wrong.
const lockedMake = computed(() =>
  guesses.value.some((g) => g.makeResult === "correct") ? currentCar.value.make : null
);
const lockedModel = computed(() =>
  guesses.value.some((g) => g.modelResult === "correct") ? currentCar.value.model : null
);
// In "exact" mode this is the exact year; in "era" mode it's the decade start
// (e.g. 1980) so the era field can be pre-selected/locked to the right option.
const lockedYear = computed(() => {
  if (yearMode.value === "none") return null;
  if (!guesses.value.some((g) => g.yearResult === "correct")) return null;
  return yearMode.value === "era" ? decadeOf(currentCar.value.year) : currentCar.value.year;
});

function finishTurn(won: boolean) {
  if (won) {
    status.value = "won";
  } else if (guesses.value.length >= MAX_GUESSES) {
    status.value = "lost";
  }

  if (status.value !== "playing") {
    stats.played += 1;
    stats.totalGuesses += guesses.value.length;
    if (status.value === "won") {
      stats.won += 1;
      stats.currentStreak += 1;
      stats.bestStreak = Math.max(stats.bestStreak, stats.currentStreak);
    } else {
      stats.currentStreak = 0;
    }
    saveStats(stats);
  }
}

// yearInput is ignored in "none" mode, an exact year in "exact" mode, and a
// decade start (e.g. 1980 for "1980s") in "era" mode.
function submitGuess(makeInput: string, modelInput: string, yearInput: number | null) {
  if (status.value !== "playing") return;

  const car = currentCar.value;
  const makeResult = normalize(makeInput) === normalize(car.make) ? "correct" : "wrong";
  const modelResult = normalize(modelInput) === normalize(car.model) ? "correct" : "wrong";

  const guess: Guess = { make: makeInput, model: modelInput, makeResult, modelResult };

  let yearOk = true;
  if (yearMode.value === "exact" && yearInput !== null) {
    if (yearInput === car.year) {
      guess.yearResult = "correct";
    } else {
      guess.yearResult = yearInput < car.year ? "higher" : "lower";
      guess.yearClose = Math.abs(yearInput - car.year) <= 2;
    }
    guess.year = yearInput;
    yearOk = guess.yearResult === "correct";
  } else if (yearMode.value === "era" && yearInput !== null) {
    const actualDecade = decadeOf(car.year);
    if (yearInput === actualDecade) {
      guess.yearResult = "correct";
    } else {
      guess.yearResult = yearInput < actualDecade ? "higher" : "lower";
      guess.yearClose = Math.abs(yearInput - actualDecade) === 10;
    }
    guess.year = yearInput;
    yearOk = guess.yearResult === "correct";
  }

  guesses.value.push(guess);

  const won = makeResult === "correct" && modelResult === "correct" && yearOk;
  finishTurn(won);
}

// A guaranteed miss: burns an attempt and zooms out like a wrong guess, but
// never wins and never locks in any field.
function skipGuess() {
  if (status.value !== "playing") return;

  const guess: Guess = {
    make: "",
    model: "",
    makeResult: "wrong",
    modelResult: "wrong",
    skipped: true,
  };

  guesses.value.push(guess);
  finishTurn(false);
}

// Advances to a new car without touching stats - this is what "Continue"
// (shown after a win/loss) uses, so a finished round's result sticks.
function newCar() {
  currentCar.value = pickRandomCar(currentCar.value.id);
  guesses.value = [];
  status.value = "playing";
}

function resetStats() {
  stats.played = 0;
  stats.won = 0;
  stats.currentStreak = 0;
  stats.totalGuesses = 0;
  saveStats(stats);
}

// The header's "Refresh" button: a deliberate restart, whether that means
// bailing on the car currently being guessed or just wanting a clean slate.
// Unlike "Continue", this resets the streak and win/loss ratio.
function refreshCar() {
  resetStats();
  newCar();
}

function setYearMode(mode: YearMode) {
  if (mode === yearMode.value) return;
  yearMode.value = mode;
  saveYearMode(mode);
  refreshCar();
}

export function useGame() {
  return {
    currentCar,
    guesses,
    status,
    stats,
    yearMode,
    zoomScale,
    focusPoint,
    guessesRemaining,
    lockedMake,
    lockedModel,
    lockedYear,
    maxGuesses: MAX_GUESSES,
    submitGuess,
    skipGuess,
    newCar,
    refreshCar,
    setYearMode,
  };
}
