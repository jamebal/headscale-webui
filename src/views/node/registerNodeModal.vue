<script setup lang="ts">
import type { FormInst } from 'naive-ui'
import { type FormNode, registerNode } from '@/service/api/node'
import type { User } from '@/service/api/user'
import { useAppStore } from '@/store/app'

const props = defineProps(
  {
    show: {
      type: Boolean,
      default: false,
    },
    userList: {
      type: Array as PropType<User[]>,
      default: () => [],
    },
    defaultUser: {
      type: String,
      default: '',
    },
  },
)

const emit = defineEmits(['update:show'])

const appStore = useAppStore()

const { t } = useI18n()

const formModal = ref<FormNode>({
  user: null,
  key: null,
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
  formModal.value.user = props.defaultUser || null
})

const userOptions = computed(() => props.userList.map(user => ({
  label: user.name,
  value: user.name,
})))

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

function handleSubmit() {
  formRef.value?.validate(async (errors) => {
    if (errors)
      return
    isLoading.value = true
    const result = await registerNode(formModal.value)
    if (!result || !result.isSuccess) {
      isLoading.value = false
      return
    }
    window.$message.success(t('app.registerNodeSuccesses'))
    appStore.sendMessage({ event: 'refreshNodeList', data: {} })
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
    :title="t('app.registerNode')"
    class="w-720px"
    :segmented="{
      content: true,
      action: true,
    }"
  >
    <n-form ref="formRef" label-placement="left" :rules="rules" :model="formModal" label-align="left" :label-width="90">
      <n-form-item :label="t('app.username')" path="user">
        <n-select v-model:value="formModal.user" :options="userOptions" />
      </n-form-item>
      <n-form-item label="mkey" path="key">
        <n-input v-model:value="formModal.key" placeholder="mkey:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
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
