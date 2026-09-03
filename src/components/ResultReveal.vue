<script setup lang="ts">
import type { Car, GameStatus } from "../types/car";

const props = defineProps<{ car: Car; status: GameStatus; guessCount: number }>();
defineEmits<{ continue: [] }>();

const title = props.status === "won" ? "Nice work! 🏁" : "Out of guesses";
</script>

<template>
  <div class="result-reveal" :class="status">
    <h2>{{ title }}</h2>
    <p class="answer">{{ car.year }} {{ car.make }} {{ car.model }}</p>
    <p v-if="status === 'won'" class="subline">
      Guessed in {{ guessCount }} {{ guessCount === 1 ? "try" : "tries" }}
    </p>
    <a :href="car.listingUrl" target="_blank" rel="noopener noreferrer" class="listing-link">
      View the original listing on Bring a Trailer ↗
    </a>
    <div class="actions">
      <button class="continue-btn" @click="$emit('continue')">Continue ➡️</button>
    </div>
  </div>
</template>

<style scoped>
.result-reveal {
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--panel);
  padding: 20px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
}

.result-reveal.won {
  border-color: var(--correct);
}

.result-reveal.lost {
  border-color: var(--wrong);
}

.answer {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-h);
  margin: 0;
}

.subline {
  color: var(--text);
  margin: 0;
}

.listing-link {
  color: var(--accent);
  font-size: 14px;
  text-decoration: none;
}

.listing-link:hover {
  text-decoration: underline;
}

.actions {
  margin-top: 8px;
  display: flex;
  gap: 8px;
}

.continue-btn {
  padding: 10px 22px;
  border-radius: 8px;
  font-weight: 700;
  cursor: pointer;
  border: none;
  background: var(--accent);
  color: white;
}
</style>
