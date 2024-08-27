<script setup lang="ts">
import { format } from 'date-fns'

import { NButton } from 'naive-ui'
import { useClipboard } from '@vueuse/core'
import { useAppStore } from '@/store'
import { createApiKey } from '@/service/api/apiKey'

const props = defineProps(
  {
    show: {
      type: Boolean,
      default: false,
    },
  },
)

const emit = defineEmits(['update:show'])

const appStore = useAppStore()

const { t } = useI18n()

const { copy } = useClipboard()

const modalVisible = ref(props.show)
const isLoading = ref(false)

const apiKey = ref('')

function closeModal() {
  modalVisible.value = false
  apiKey.value = ''
}

watch(modalVisible, (newVal) => {
  emit('update:show', newVal)
})

watch(() => props.show, (newVal) => {
  modalVisible.value = newVal
})

const timestamp = ref(new Date().getTime() + 1000 * 60 * 60 * 24 * 90)

async function handleSubmit() {
  const timezoneOffset = new Date(timestamp.value).getTimezoneOffset() * 60000
  const expire = format(timestamp.value + timezoneOffset, 'yyyy-MM-dd\'T\'HH:mm:ss.SSS\'Z\'')
  isLoading.value = true
  const result = await createApiKey(expire)
  if (!result || !result.isSuccess) {
    isLoading.value = false
    return
  }
  appStore.sendMessage({ event: 'refreshApiKeyList', data: {} })

  apiKey.value = result.data.apiKey

  isLoading.value = false
}

function copyApiKey() {
  copy(apiKey.value)
  window.$message.success(t('components.copyText.message'))
  closeModal()
}

function dateDisabled(timestamp: number) {
  return timestamp < new Date().getTime() + 1000 * 60 * 60 * 24
}
</script>

<template>
  <n-modal
    v-model:show="modalVisible"
    :mask-closable="false"
    preset="card"
    :title="t('app.createApiKey')"
    class="w-590px"
    :segmented="{
      content: true,
      action: true,
    }"
    @after-leave="closeModal"
  >
    <n-alert v-if="apiKey" :title="`${t('app.createApiKey')} ${t('common.success')}`" type="success" style="margin-bottom: 20px">
      {{ apiKey }}
    </n-alert>
    <n-space justify="center">
      <n-form label-placement="left" label-align="left" :label-width="90">
        <n-form-item :label="t('app.expiry')" path="expire">
          <n-date-picker v-model:value="timestamp" :actions="null" type="date" :default-calendar-start-time="timestamp" :is-date-disabled="dateDisabled" />
        </n-form-item>
      </n-form>
    </n-space>
    <template #action>
      <n-space justify="center">
        <NButton @click="closeModal()">
          {{ t('common.cancel') }}
        </NButton>
        <NButton v-if="!apiKey" type="primary" :loading="isLoading" :disabled="isLoading" @click="handleSubmit">
          {{ t('common.confirm') }}
        </NButton>
        <NButton v-if="apiKey" @click="copyApiKey">
          {{ t('components.copyText.tooltip') }}
        </NButton>
      </n-space>
    </template>
  </n-modal>
</template>

<style scoped>

</style>
