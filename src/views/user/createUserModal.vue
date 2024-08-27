<script setup lang="ts">
import type { FormInst } from 'naive-ui'
import { createUser } from '@/service'

import { useAppStore } from '@/store'

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

const formModal = ref<any>({
  name: '',
})

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

const rules = computed(() => {
  return {
    name: {
      required: true,
      trigger: 'blur',
      message: t('common.inputPlaceholder'),
    },
  }
})

const formRef = ref<FormInst | null>(null)

function handleSubmit() {
  formRef.value?.validate(async (errors) => {
    console.log(errors)
    if (errors)
      return
    isLoading.value = true
    const result = await createUser(formModal.value.name)
    if (!result || !result.isSuccess) {
      isLoading.value = false
      return
    }
    appStore.sendMessage({ event: 'refreshUserList', data: {} })
    window.$message.success(`${t('app.createUser')} ${t('common.success')}`)
    isLoading.value = false
    closeModal()
  })
}
</script>

<template>
  <n-modal
    v-model:show="modalVisible"
    :mask-closable="false"
    preset="card"
    :title="t('app.createUser')"
    class="w-520px"
    :segmented="{
      content: true,
      action: true,
    }"
  >
    <n-form ref="formRef" label-placement="left" :rules="rules" :model="formModal" label-align="left" :label-width="90">
      <n-form-item path="name" :label="t('app.username')">
        <n-input v-model:value="formModal.name" />
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
