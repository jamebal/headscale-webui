<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import { $t } from '@/utils'

defineProps({
  dropdownOptions: {
    type: Array as () => Array<{ label: string, key: string }>,
    required: true,
  },
})

const emit = defineEmits(['copied'])

const { copy } = useClipboard()

function handleSelect(key: string) {
  copy(key)
  window.$message.success($t('components.copyText.message'))
  emit('copied', key)
}
</script>

<template>
  <n-dropdown
    trigger="click"
    :options="dropdownOptions"
    @select="handleSelect"
  >
    <n-button text>
      <slot />
      <icon-park-outline-down style="margin-left: 5px;" />
    </n-button>
  </n-dropdown>
</template>
