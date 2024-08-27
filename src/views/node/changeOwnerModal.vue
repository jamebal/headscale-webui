<script setup lang="ts">
import {moveNode, type NodeData} from '@/service/api/node'
import type { User } from '@/service/api/user'
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
    userList: {
      type: Array as PropType<User[]>,
      default: () => [],
    },
  },
)

const emit = defineEmits(['update:show'])

const appStore = useAppStore()

const { t } = useI18n()

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

const userOptions = computed(() => props.userList.map(user => ({
  label: user.name,
  value: user.name,
})))

const selectUser = ref('')

async function handleSubmit() {
  isLoading.value = true
  const result = await moveNode(selectUser.value, props.nodeData.id)
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
    :title="`${t('app.changeOwner')}: ${nodeData.givenName}`"
    class="w-520px"
    :segmented="{
      content: true,
      action: true,
    }"
  >
    <n-select v-model:value="selectUser" :options="userOptions" />
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
