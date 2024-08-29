<script setup lang="ts">
const props = defineProps<{
  maxLength?: string
  actualValue: string
}>()
const modelValue = defineModel<string>('value')
</script>

<template>
  <div v-if="modelValue" class="inline-flex items-center gap-0.5em">
    <n-ellipsis :style="{ 'max-width': props.maxLength || '12em' }">
      {{ modelValue }}
    </n-ellipsis>
    <n-tooltip trigger="hover">
      <template #trigger>
        <span v-copy="actualValue" class="cursor-pointer">
          <icon-park-outline-copy />
        </span>
      </template>
      {{ $t('components.copyText.tooltip') }}
    </n-tooltip>
  </div>
</template>
