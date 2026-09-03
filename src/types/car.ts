export interface Car {
  id: number;
  year: number;
  make: string;
  model: string;
  imageUrl: string;
  listingUrl: string;
}

export type FieldResult = "correct" | "wrong";
export type YearResult = "correct" | "higher" | "lower";

// "none": year isn't guessed at all. "era": guessing the decade is enough
// (e.g. 1980-1989 for a 1986 car). "exact": the year must match exactly.
export type YearMode = "none" | "era" | "exact";

export interface Guess {
  make: string;
  model: string;
  makeResult: FieldResult;
  modelResult: FieldResult;
  // Present only when yearMode !== "none". In "era" mode this is the guessed
  // decade's start year (e.g. 1980), not the exact year.
  year?: number;
  yearResult?: YearResult;
  yearClose?: boolean;
  skipped?: boolean;
}

export type GameStatus = "playing" | "won" | "lost";

export interface GameStats {
  played: number;
  won: number;
  currentStreak: number;
  bestStreak: number;
  totalGuesses: number;
}
