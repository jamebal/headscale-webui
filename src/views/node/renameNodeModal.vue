<script setup lang="ts">
import type { FormInst } from 'naive-ui'
import { type NodeData, renameNode } from '@/service/api/node'

import { useAppStore } from '@/store'

const props = defineProps(
  {
    show: {
      type: Boolean,
      default: false,
    },
    nodeData: {
      type: Object as PropType<NodeData>,
      required: true,
    },
  },
)

const emit = defineEmits(['update:show'])

const appStore = useAppStore()

const { t } = useI18n()

const formModal = ref<any>({
  nodeId: null,
  newName: null,
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
  formModal.value.newName = props.nodeData?.givenName
  formModal.value.nodeId = props.nodeData?.id
})

const rules = computed(() => {
  return {
    user: {
      required: true,
      trigger: 'blur',
      message: t('common.inputPlaceholder'),
    },
  }
})

const formRef = ref<FormInst | null>(null)

function handleSubmit() {
  formRef.value?.validate(async (errors) => {
    if (errors)
      return
    isLoading.value = true
    const result = await renameNode(formModal.value)
    if (!result || !result.isSuccess) {
      isLoading.value = false
      return
    }
    appStore.sendMessage({ event: 'refreshNodeList', data: {} })
    window.$message.success(`${t('app.renameNode')} ${t('common.success')}`)
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
    :title="t('app.renameNode')"
    class="w-520px"
    :segmented="{
      content: true,
      action: true,
    }"
  >
    <n-form ref="formRef" label-placement="left" :rules="rules" :model="formModal" label-align="left" :label-width="90">
      <n-form-item path="newName">
        <n-input v-model:value="formModal.newName" />
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
