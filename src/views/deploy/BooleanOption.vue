<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

type BooleanOptionState = 'unset' | 'true' | 'false'

interface Props {
  label: string
  help?: string
  modelValue: boolean | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean | null]
}>()

const { t } = useI18n()
const rootRef = ref<HTMLElement | null>(null)

const selectValue = computed<BooleanOptionState>(() => {
  if (props.modelValue === null)
    return 'unset'

  return props.modelValue ? 'true' : 'false'
})

const stateOptions = computed(() => [
  { label: t('app.deployOptions.unspecified'), value: 'unset' },
  { label: t('common.enable'), value: 'true' },
  { label: t('common.disable'), value: 'false' },
] satisfies Array<{ label: string, value: BooleanOptionState }>)

function handleUpdate(value: unknown) {
  switch (value) {
    case 'unset':
      emit('update:modelValue', null)
      break
    case 'true':
      emit('update:modelValue', true)
      break
    case 'false':
      emit('update:modelValue', false)
      break
  }
}

function syncSelectAriaLabel() {
  void nextTick(() => {
    const trigger = rootRef.value?.querySelector<HTMLElement>(
      '.n-base-selection-label[tabindex="0"], .n-base-selection-tags[tabindex="0"]',
    )
    trigger?.setAttribute('aria-label', props.label)
  })
}

onMounted(syncSelectAriaLabel)
watch(() => props.label, syncSelectAriaLabel)
</script>

<template>
  <div ref="rootRef" class="boolean-option">
    <div class="boolean-option-label">
      <span p-2>{{ label }}</span>
      <help-info v-if="help" :message="help" />
    </div>
    <n-select
      :value="selectValue"
      :options="stateOptions"
      :aria-label="label"
      @update:value="handleUpdate"
    />
  </div>
</template>
