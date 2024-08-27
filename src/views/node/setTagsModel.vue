<script setup lang="ts">
import type { NodeData } from '@/service/api/node'
import { setTagsOfNode } from '@/service/api/node'
import { useAppStore } from '@/store/app'

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

const tags = ref<{ label: string, value: string }[]>([])

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
  tags.value = props.nodeData.forcedTags.map(tag => ({ label: tag, value: tag }))
})

const handleCreate: (label: string) => { label: string, value: string } = (label) => {
  const newValue = `tag:${label.trim().replace(/\s+/g, '')}`
  return { label: newValue, value: newValue }
}

async function handleSubmit() {
  const tagsValue = tags.value.map(tag => tag.value)
  isLoading.value = true
  const result = await setTagsOfNode(props.nodeData.id, { tags: tagsValue })
  if (!result || !result.isSuccess) {
    isLoading.value = false
    return
  }
  window.$message.success(`${t('app.changeOwner')} ${t('common.success')}`)
  appStore.sendMessage({ event: 'refreshNodeList', data: {} })
  isLoading.value = false
  closeModal()
}
</script>

<template>
  <n-modal
    v-model:show="modalVisible"
    :mask-closable="false"
    preset="card"
    :title="`${t('app.setTags')}: ${nodeData.givenName}`"
    class="w-520px"
    :segmented="{
      content: true,
      action: true,
    }"
  >
    <n-dynamic-tags v-model:value="tags" type="info" @create="handleCreate" />
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
