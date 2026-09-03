<script setup lang="ts">
import { computed, nextTick, ref } from "vue";

const props = defineProps<{
  id: string;
  modelValue: string;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
  locked?: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const MAX_SUGGESTIONS = 8;

const inputRef = ref<HTMLInputElement | null>(null);
const isOpen = ref(false);
const highlightedIndex = ref(-1);

const filteredOptions = computed(() => {
  const query = props.modelValue.trim().toLowerCase();
  if (!query) return props.options.slice(0, MAX_SUGGESTIONS);

  const startsWith: string[] = [];
  const contains: string[] = [];
  for (const opt of props.options) {
    const lower = opt.toLowerCase();
    if (lower.startsWith(query)) startsWith.push(opt);
    else if (lower.includes(query)) contains.push(opt);
  }
  return [...startsWith, ...contains].slice(0, MAX_SUGGESTIONS);
});

function openDropdown() {
  if (props.disabled || props.locked) return;
  isOpen.value = true;
  highlightedIndex.value = -1;
}

function closeDropdown() {
  isOpen.value = false;
  highlightedIndex.value = -1;
}

function handleInput(e: Event) {
  emit("update:modelValue", (e.target as HTMLInputElement).value);
  openDropdown();
}

function selectOption(option: string) {
  emit("update:modelValue", option);
  closeDropdown();
  nextTick(() => inputRef.value?.focus());
}

function handleKeydown(e: KeyboardEvent) {
  if (!isOpen.value && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
    openDropdown();
    return;
  }
  if (!isOpen.value) return;

  if (e.key === "ArrowDown") {
    e.preventDefault();
    highlightedIndex.value = Math.min(
      highlightedIndex.value + 1,
      filteredOptions.value.length - 1
    );
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    highlightedIndex.value = Math.max(highlightedIndex.value - 1, 0);
  } else if (e.key === "Enter") {
    if (highlightedIndex.value >= 0 && filteredOptions.value[highlightedIndex.value]) {
      e.preventDefault();
      selectOption(filteredOptions.value[highlightedIndex.value]);
    } else {
      closeDropdown();
    }
  } else if (e.key === "Escape") {
    closeDropdown();
  }
}

// mousedown fires before the input's blur, so selecting via click/tap beats
// the blur-close below (touch devices fire this too, unlike click-only handlers).
function handleOptionPointerDown(option: string, e: Event) {
  e.preventDefault();
  selectOption(option);
}

function handleBlur() {
  // Delay so a click/tap on an option (mousedown already handled above) isn't
  // cut off by the input losing focus first.
  setTimeout(closeDropdown, 120);
}
</script>

<template>
  <div class="autocomplete" :class="{ locked }">
    <input
      :id="id"
      ref="inputRef"
      :value="modelValue"
      type="text"
      autocomplete="off"
      role="combobox"
      aria-autocomplete="list"
      aria-haspopup="listbox"
      :aria-expanded="isOpen"
      :aria-controls="`${id}-listbox`"
      :placeholder="placeholder"
      :disabled="disabled || locked"
      @input="handleInput"
      @focus="openDropdown"
      @blur="handleBlur"
      @keydown="handleKeydown"
    />
    <span v-if="locked" class="lock-badge" aria-hidden="true">✓</span>
    <ul
      v-if="isOpen && filteredOptions.length"
      :id="`${id}-listbox`"
      class="dropdown"
      role="listbox"
    >
      <li
        v-for="(option, i) in filteredOptions"
        :id="`${id}-option-${i}`"
        :key="option"
        role="option"
        :aria-selected="i === highlightedIndex"
        :class="{ highlighted: i === highlightedIndex }"
        @mousedown="handleOptionPointerDown(option, $event)"
      >
        {{ option }}
      </li>
    </ul>
  </div>
</template>

<style scoped>
.autocomplete {
  position: relative;
}

input {
  width: 100%;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--panel);
  color: var(--text-h);
  /* iOS Safari auto-zooms the page on focus if a focused input's font-size
     is under 16px - keep this at 16px+ everywhere, including mobile. */
  font-size: 16px;
}

input:focus {
  outline: 2px solid var(--accent);
  outline-offset: -1px;
}

.locked input {
  border-color: var(--correct);
  background: var(--correct-bg);
  color: var(--correct);
  font-weight: 700;
  opacity: 1;
  padding-right: 32px;
}

.lock-badge {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--correct);
  font-weight: 700;
  pointer-events: none;
}

.dropdown {
  position: absolute;
  z-index: 10;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  margin: 0;
  padding: 4px;
  list-style: none;
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: var(--shadow);
  max-height: 220px;
  overflow-y: auto;
}

.dropdown li {
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  color: var(--text-h);
}

.dropdown li.highlighted,
.dropdown li:hover {
  background: var(--accent-bg);
}
</style>
