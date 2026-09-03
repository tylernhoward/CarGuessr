<script setup lang="ts">
import { computed, ref, watch } from "vue";
import carsRaw from "../data/cars.json";
import type { Car, Guess, YearMode } from "../types/car";
import AutocompleteInput from "./AutocompleteInput.vue";

const cars = carsRaw as Car[];

const props = defineProps<{
  disabled: boolean;
  carId: number;
  yearMode: YearMode;
  lockedMake: string | null;
  lockedModel: string | null;
  lockedYear: number | null;
  lastGuess: Guess | null;
}>();
const emit = defineEmits<{
  submit: [payload: { make: string; model: string; year: number | null }];
  skip: [];
}>();

const allMakes = computed(() =>
  [...new Set(cars.map((c) => c.make))].sort((a, b) => a.localeCompare(b))
);

const yearBounds = computed(() => {
  const years = cars.map((c) => c.year);
  return { min: Math.min(...years), max: Math.max(...years) };
});

const eraOptions = computed(() => {
  const startDecade = Math.floor(yearBounds.value.min / 10) * 10;
  const endDecade = Math.floor(yearBounds.value.max / 10) * 10;
  const options: number[] = [];
  for (let d = startDecade; d <= endDecade; d += 10) options.push(d);
  return options;
});

// Era mode has no free-text "unset" state worth showing - default straight to
// a decade instead of a placeholder option, so the select always displays a
// real, submittable value. 1970s if the dataset spans that far, else the
// earliest available decade.
function defaultYearValue(): number | null {
  if (props.lockedYear !== null) return props.lockedYear;
  if (props.yearMode !== "era") return null;
  return eraOptions.value.includes(1970) ? 1970 : eraOptions.value[0] ?? null;
}

const makeInput = ref(props.lockedMake ?? "");
const modelInput = ref(props.lockedModel ?? "");
const yearInput = ref<number | null>(defaultYearValue());

// Props update asynchronously (on the parent's next reactive flush), so a
// field that just got guessed correctly can't be re-filled synchronously
// right after emitting - watch instead of writing this inline in handleSubmit.
watch(
  () => props.lockedMake,
  (v) => (makeInput.value = v ?? "")
);
watch(
  () => props.lockedModel,
  (v) => (modelInput.value = v ?? "")
);
watch(
  () => props.lockedYear,
  () => (yearInput.value = defaultYearValue())
);
// Switching year mode starts a fresh car (see useGame.setYearMode), so the
// field just needs to reset alongside it.
watch(
  () => props.yearMode,
  () => (yearInput.value = defaultYearValue())
);
// The car can change out from under an in-progress guess (header "New" while
// mid-game) - clear any unlocked, still-typed text so it doesn't linger.
watch(
  () => props.carId,
  () => resetUnlockedFields()
);

const modelOptions = computed(() => {
  const matchedMake = allMakes.value.find(
    (m) => m.toLowerCase() === makeInput.value.trim().toLowerCase()
  );
  const pool = matchedMake
    ? cars.filter((c) => c.make === matchedMake)
    : cars;
  return [...new Set(pool.map((c) => c.model))].sort((a, b) => a.localeCompare(b));
});

// Reflects how the last submitted guess went, not the fields being typed
// right now - "good" means at least one part landed, "bad" means it all missed.
const lastGuessOutcome = computed<"good" | "bad" | null>(() => {
  const g = props.lastGuess;
  if (!g) return null;
  if (g.skipped) return "bad";
  const anyCorrect =
    g.makeResult === "correct" || g.modelResult === "correct" || g.yearResult === "correct";
  return anyCorrect ? "good" : "bad";
});

const canSubmit = computed(
  () =>
    !props.disabled &&
    makeInput.value.trim().length > 0 &&
    modelInput.value.trim().length > 0 &&
    (props.yearMode === "none" || yearInput.value !== null)
);

// Clear only the fields that aren't already locked in - a field locked from
// an earlier guess must survive this round even though the watchers above
// won't re-fire for it (its locked value hasn't actually changed).
function resetUnlockedFields() {
  if (props.lockedMake === null) makeInput.value = "";
  if (props.lockedModel === null) modelInput.value = "";
  if (props.lockedYear === null) yearInput.value = defaultYearValue();
}

function handleSubmit() {
  if (!canSubmit.value) return;
  emit("submit", {
    make: makeInput.value.trim(),
    model: modelInput.value.trim(),
    year: props.yearMode === "none" ? null : yearInput.value,
  });
  resetUnlockedFields();
}

function handleSkip() {
  if (props.disabled) return;
  emit("skip");
  resetUnlockedFields();
}
</script>

<template>
  <form class="guess-form" @submit.prevent="handleSubmit">
    <div class="inputs-row" :class="{ 'no-year': yearMode === 'none' }">
      <div class="field">
        <label for="make">Make</label>
        <AutocompleteInput
          id="make"
          v-model="makeInput"
          :options="allMakes"
          placeholder="Porsche"
          :disabled="disabled"
          :locked="lockedMake !== null"
        />
      </div>

      <div class="field">
        <label for="model">Model</label>
        <AutocompleteInput
          id="model"
          v-model="modelInput"
          :options="modelOptions"
          placeholder="911 Carrera"
          :disabled="disabled"
          :locked="lockedModel !== null"
        />
      </div>

      <div v-if="yearMode === 'exact'" class="field field-year">
        <label for="year">Year</label>
        <div class="year-wrap" :class="{ locked: lockedYear !== null }">
          <input
            id="year"
            v-model.number="yearInput"
            type="number"
            :min="yearBounds.min"
            :max="yearBounds.max"
            placeholder="1986"
            :disabled="disabled || lockedYear !== null"
          />
          <span v-if="lockedYear !== null" class="lock-badge" aria-hidden="true">✓</span>
        </div>
      </div>

      <div v-else-if="yearMode === 'era'" class="field field-year">
        <label for="year">Era</label>
        <div class="year-wrap era-wrap" :class="{ locked: lockedYear !== null }">
          <select
            id="year"
            v-model="yearInput"
            :disabled="disabled || lockedYear !== null"
          >
            <option v-for="d in eraOptions" :key="d" :value="d">{{ d }}s</option>
          </select>
          <span v-if="lockedYear !== null" class="lock-badge" aria-hidden="true">✓</span>
        </div>
      </div>
    </div>

    <div class="actions-row">
      <button type="button" class="skip-btn" :disabled="disabled" @click="handleSkip">
        No Idea ❓
      </button>
      <button
        type="submit"
        class="submit-btn"
        :class="lastGuessOutcome"
        :disabled="!canSubmit"
      >
        <template v-if="lastGuessOutcome === 'good'">Guess ✓</template>
        <template v-else-if="lastGuessOutcome === 'bad'">Guess ✗</template>
        <template v-else>Guess</template>
      </button>
    </div>
  </form>
</template>

<style scoped>
.guess-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.inputs-row {
  display: grid;
  grid-template-columns: 2fr 2fr 1fr;
  gap: 8px;
  align-items: end;
}

.inputs-row.no-year {
  grid-template-columns: 1fr 1fr;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.year-wrap {
  position: relative;
}

.year-wrap input,
.year-wrap select {
  width: 100%;
  padding: 10px 8px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--panel);
  color: var(--text-h);
  /* iOS Safari auto-zooms the page on focus if a focused input's font-size
     is under 16px - keep this at 16px+ everywhere, including mobile. */
  font-size: 16px;
  box-sizing: border-box;
  min-width: 0;
}

.year-wrap input:focus,
.year-wrap select:focus {
  outline: 2px solid var(--accent);
  outline-offset: -1px;
}

.year-wrap.locked input,
.year-wrap.locked select {
  border-color: var(--correct);
  background: var(--correct-bg);
  color: var(--correct);
  font-weight: 700;
  opacity: 1;
  padding-right: 26px;
}

.era-wrap select {
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  padding-right: 26px;
  cursor: pointer;
}

.era-wrap select:disabled {
  cursor: default;
}

.era-wrap::after {
  content: "";
  position: absolute;
  right: 11px;
  top: 45%;
  width: 7px;
  height: 7px;
  border-right: 2px solid var(--text);
  border-bottom: 2px solid var(--text);
  transform: translateY(-50%) rotate(45deg);
  pointer-events: none;
}

.era-wrap.locked::after {
  display: none;
}

.year-wrap .lock-badge {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--correct);
  font-weight: 700;
  pointer-events: none;
}

.actions-row {
  display: flex;
  gap: 8px;
}

.submit-btn,
.skip-btn {
  flex: 1;
  padding: 11px 16px;
  border-radius: 8px;
  font-weight: 700;
  cursor: pointer;
}

.submit-btn {
  border: none;
  background: var(--info);
  color: white;
  transition: background-color 0.2s;
}

.submit-btn.good {
  background: var(--correct);
}

.submit-btn.bad {
  background: var(--wrong);
}

.submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.skip-btn {
  border: 1px solid var(--border);
  background: var(--panel);
  color: var(--text);
  font-weight: 600;
}

.skip-btn:hover:not(:disabled) {
  background: var(--border);
}

.skip-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 400px) {
  .inputs-row {
    gap: 6px;
  }

  label {
    font-size: 11px;
  }

  :deep(.autocomplete input),
  .year-wrap input,
  .year-wrap select {
    padding: 8px 6px;
    /* Stay at 16px (not smaller) - anything under that re-triggers iOS
       Safari's zoom-on-focus behavior. */
  }
}
</style>
