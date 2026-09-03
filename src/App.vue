<script setup lang="ts">
import CarImage from "./components/CarImage.vue";
import GuessForm from "./components/GuessForm.vue";
import GuessHistory from "./components/GuessHistory.vue";
import ResultReveal from "./components/ResultReveal.vue";
import { useGame } from "./composables/useGame";
import type { YearMode } from "./types/car";

const {
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
  submitGuess,
  skipGuess,
  newCar,
  refreshCar,
  setYearMode,
} = useGame();

const yearModeOptions: { value: YearMode; label: string; color: "green" | "yellow" | "red" }[] = [
  { value: "none", label: "No Year", color: "green" },
  { value: "era", label: "Era", color: "yellow" },
  { value: "exact", label: "Exact Year", color: "red" },
];

function handleSubmit(payload: { make: string; model: string; year: number | null }) {
  submitGuess(payload.make, payload.model, payload.year);
}
</script>

<template>
  <header class="app-header">
    <h1>CarGuessr 🚗</h1>
    <div class="header-right">
      <span class="stat">{{ stats.won }}/{{ stats.played }} won</span>
      <span class="stat">🔥 {{ stats.currentStreak }}</span>
      <button class="new-car-btn-header" @click="refreshCar">New 🔄</button>
    </div>
  </header>

  <main class="game">
    <div class="mode-switch" role="group" aria-label="Year guessing mode">
      <button
        v-for="opt in yearModeOptions"
        :key="opt.value"
        type="button"
        class="mode-btn"
        :class="[opt.color, { active: yearMode === opt.value }]"
        @click="setYearMode(opt.value)"
      >
        {{ opt.label }}
      </button>
    </div>

    <CarImage
      :car="currentCar"
      :zoom-scale="zoomScale"
      :focus-point="focusPoint"
      :status="status"
    />

    <p class="guesses-remaining">
      {{ status === "playing" ? `${guessesRemaining} guesses left` : "" }}
    </p>

    <GuessForm
      v-if="status === 'playing'"
      :disabled="status !== 'playing'"
      :car-id="currentCar.id"
      :year-mode="yearMode"
      :locked-make="lockedMake"
      :locked-model="lockedModel"
      :locked-year="lockedYear"
      :last-guess="guesses.length ? guesses[guesses.length - 1] : null"
      @submit="handleSubmit"
      @skip="skipGuess"
    />

    <ResultReveal
      v-else
      :car="currentCar"
      :status="status"
      :guess-count="guesses.length"
      @continue="newCar"
    />

    <GuessHistory :guesses="guesses" :year-mode="yearMode" />
  </main>
</template>

<style scoped>
.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 16px;
  padding: 16px 24px;
  border-bottom: 1px solid var(--border);
}

.app-header h1 {
  font-size: 20px;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.stat {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}

.new-car-btn-header {
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid var(--accent);
  background: transparent;
  color: var(--accent);
  font-weight: 700;
  cursor: pointer;
}

.new-car-btn-header:hover {
  background: var(--accent-bg);
}

.game {
  flex: 1;
  width: 100%;
  max-width: 640px;
  margin: 0 auto;
  padding: 24px 16px 48px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.guesses-remaining {
  text-align: center;
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  margin: 0;
  min-height: 1.2em;
}

.mode-switch {
  display: flex;
  gap: 6px;
  align-self: center;
  padding: 4px;
  border-radius: 10px;
  background: var(--panel);
  border: 1px solid var(--border);
}

.mode-btn {
  padding: 6px 12px;
  border-radius: 7px;
  border: 1px solid transparent;
  background: transparent;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.mode-btn.green {
  color: var(--correct);
}

.mode-btn.yellow {
  color: var(--close);
}

.mode-btn.red {
  color: var(--wrong);
}

.mode-btn.green:hover {
  border-color: var(--correct);
}

.mode-btn.yellow:hover {
  border-color: var(--close);
}

.mode-btn.red:hover {
  border-color: var(--wrong);
}

.mode-btn.green.active {
  background: var(--correct);
  color: white;
}

.mode-btn.yellow.active {
  background: #fbbf24;
  color: #1a1a1a;
}

.mode-btn.red.active {
  background: var(--wrong);
  color: white;
}
</style>
