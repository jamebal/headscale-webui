<script setup lang="ts">
import { format } from 'date-fns'

import type { MessageRenderMessage } from 'naive-ui'
import { NAlert } from 'naive-ui'
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

const { success } = useMessage()

const renderMessage: MessageRenderMessage = (props) => {
  const { type } = props
  return h(
    NAlert,
    {
      closable: props.closable,
      onClose: props.onClose,
      type: type === 'loading' ? 'default' : type,
      title: `${t('app.createApiKey')} ${t('common.success')}`,
      style: {
        boxShadow: 'var(--n-box-shadow)',
        maxWidth: 'calc(100vw - 32px)',
        width: '520px',
      },
    },
    {
      default: () => props.content,
    },
  )
}

const modalVisible = ref(props.show)
const isLoading = ref(false)

function closeModal() {
  modalVisible.value = false
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

  success(result.data.apiKey, {
    render: renderMessage,
    closable: true,
    duration: 0,
  })

  isLoading.value = false
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
    class="w-360px"
    :segmented="{
      content: true,
      action: true,
    }"
  >
    <n-form label-placement="left" label-align="left" :label-width="90">
      <n-form-item :label="t('app.expiry')" path="expire">
        <n-date-picker v-model:value="timestamp" :actions="null" type="date" :default-calendar-start-time="timestamp" :is-date-disabled="dateDisabled" />
      </n-form-item>
    </n-form>
    <template #action>
      <n-space justify="center">
        <NButton @click="closeModal()">
          {{ t('common.cancel') }}
        </NButton>
        <NButton type="primary" :loading="isLoading" :disabled="isLoading" @click="handleSubmit">
          {{ t('common.confirm') }}
        </NButton>
      </n-space>
    </template>
  </n-modal>
</template>

<style scoped>

</style>
