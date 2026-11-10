<script setup>
import { ref } from 'vue'

// Same DOM as the React fixture: the specs run unchanged on both.
const name = ref('')
const greeting = ref('')
const greet = () => {
  greeting.value = `Hello, ${name.value}!`
}
</script>

<template>
  <main>
    <h1>Kit fixture</h1>
    <label for="name">Name</label>
    <input id="name" v-model="name" data-testid="name-input" />
    <button type="button" data-testid="greet-button" @click="greet">Greet</button>
    <p data-testid="greeting" aria-live="polite">{{ greeting }}</p>
  </main>
</template>
