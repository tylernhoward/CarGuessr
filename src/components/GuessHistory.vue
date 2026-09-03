<script setup lang="ts">
import type { Guess, YearMode } from "../types/car";

const props = defineProps<{ guesses: Guess[]; yearMode: YearMode }>();

function yearArrow(g: Guess) {
  if (g.yearResult === "higher") return "↑";
  if (g.yearResult === "lower") return "↓";
  return "";
}

function yearLabel(g: Guess) {
  if (g.year === undefined) return "";
  return props.yearMode === "era" ? `${g.year}s` : String(g.year);
}
</script>

<template>
  <ul v-if="guesses.length" class="guess-history">
    <li v-for="(g, i) in guesses" :key="i" class="guess-row">
      <span v-if="g.skipped" class="chip skipped full-width">No Idea</span>
      <template v-else>
        <span class="chip" :class="g.makeResult">{{ g.make }}</span>
        <span class="chip" :class="g.modelResult">{{ g.model }}</span>
        <span
          v-if="g.yearResult"
          class="chip"
          :class="[
            g.yearResult === 'correct' ? 'correct' : g.yearClose ? 'close' : 'wrong',
          ]"
        >
          {{ yearLabel(g) }} <span v-if="yearArrow(g)" class="arrow">{{ yearArrow(g) }}</span>
        </span>
      </template>
    </li>
  </ul>
</template>

<style scoped>
.guess-history {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.guess-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.chip {
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  flex: 1 1 100px;
  text-align: center;
  border: 1px solid transparent;
}

.chip.correct {
  background: var(--correct-bg);
  color: var(--correct);
  border-color: var(--correct);
}

.chip.wrong {
  background: var(--wrong-bg);
  color: var(--wrong);
  border-color: var(--wrong);
}

.chip.close {
  background: var(--close-bg);
  color: var(--close);
  border-color: var(--close);
}

.chip.skipped {
  background: var(--panel);
  color: var(--text);
  border-color: var(--border);
  font-style: italic;
}

.chip.full-width {
  flex: 1 1 100%;
}

.arrow {
  font-weight: 900;
}
</style>
