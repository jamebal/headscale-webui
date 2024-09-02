<script setup lang="ts">
import type { FormInst } from 'naive-ui'
import { format } from 'date-fns'
import { useAppStore } from '@/store/app'
import type { PreAuthKeyFormData } from '@/service'
import { createPreAuthKey } from '@/service'
import { handleTagCreate } from '@/utils/tags'

const props = defineProps(
  {
    show: {
      type: Boolean,
      default: false,
    },
    user: {
      type: String,
      default: '',
    },
  },
)

const emit = defineEmits(['update:show'])

const appStore = useAppStore()

const { t } = useI18n()

const formModal = ref<PreAuthKeyFormData>({
  user: null,
  reusable: false,
  ephemeral: false,
  expiration: null,
  aclTags: [],
})

const modalVisible = ref(props.show)
const isLoading = ref(false)
const timestamp = ref()
const tags = ref<{ label: string, value: string }[]>([])

function closeModal() {
  modalVisible.value = false
}

watch(modalVisible, (newVal) => {
  emit('update:show', newVal)
})

watch(() => props.show, (newVal) => {
  modalVisible.value = newVal
  formModal.value.user = props.user
  timestamp.value = new Date().getTime() + 1000 * 60 * 60 * 24
  formModal.value.reusable = false
  formModal.value.ephemeral = false
  formModal.value.aclTags = []
  formModal.value.expiration = getExpiration()
})

const rules = computed(() => {
  return {
    user: {
      required: true,
      trigger: 'blur',
      message: t('app.registerNodeRuleUsername'),
    },
    key: {
      required: true,
      trigger: 'blur',
      message: t('app.registerNodeRuleKey'),
    },
  }
})

const formRef = ref<FormInst | null>(null)

function getExpiration() {
  if (!timestamp.value) {
    return null
  }
  const timezoneOffset = new Date(timestamp.value).getTimezoneOffset() * 60000
  return format(timestamp.value + timezoneOffset, 'yyyy-MM-dd\'T\'HH:mm:ss.SSS\'Z\'')
}

function handleSubmit() {
  formModal.value.expiration = getExpiration()
  formModal.value.aclTags = tags.value.map(tag => tag.value)

  formRef.value?.validate(async (errors) => {
    if (errors)
      return
    isLoading.value = true
    const result = await createPreAuthKey(formModal.value)
    if (!result || !result.isSuccess) {
      isLoading.value = false
      return
    }
    window.$message.success(t('app.registerNodeSuccesses'))
    appStore.sendMessage({ event: 'refreshPreAuthKeyList', data: {} })
    isLoading.value = false
    closeModal()
  })
}
function dateDisabled(timestamp: number) {
  return timestamp < new Date().getTime() + 1000 * 60 * 60
}
const handleCreate: (label: string) => { label: string, value: string } = label => handleTagCreate(label, tags, t)
</script>

<template>
  <n-modal
    v-model:show="modalVisible"
    :mask-closable="false"
    preset="card"
    :title="`${t('app.createPreAuthKey')} - ${user}`"
    class="w-720px"
    :segmented="{
      content: true,
      action: true,
    }"
  >
    <n-form ref="formRef" label-placement="left" :rules="rules" :model="formModal" label-align="left" :label-width="90">
      <n-form-item :label="t('app.expiry')" path="expire">
        <n-date-picker v-model:value="timestamp" :actions="['clear']" type="date" :default-calendar-start-time="timestamp" :is-date-disabled="dateDisabled" />
      </n-form-item>
      <n-form-item :label="t('app.reusable')" path="reusable">
        <n-switch v-model:value="formModal.reusable" />
      </n-form-item>
      <n-form-item :label="t('app.ephemeral')" path="ephemeral">
        <n-switch v-model:value="formModal.ephemeral" />
      </n-form-item>
      <n-form-item :label="t('app.aclTags')" path="aclTags">
        <n-dynamic-tags v-model:value="tags" type="info" @create="handleCreate" />
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
