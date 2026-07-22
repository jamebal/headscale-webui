<script setup lang="ts">
import { computed } from 'vue'
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

function handleUpdate(value: BooleanOptionState) {
  const modelValues: Record<BooleanOptionState, boolean | null> = {
    unset: null,
    true: true,
    false: false,
  }

  emit('update:modelValue', modelValues[value])
}
</script>

<template>
  <div class="boolean-option">
    <div class="boolean-option-label">
      <span>{{ label }}</span>
      <help-info v-if="help" :message="help" />
    </div>
    <n-select
      :value="selectValue"
      :options="stateOptions"
      @update:value="handleUpdate"
    />
  </div>
</template>
