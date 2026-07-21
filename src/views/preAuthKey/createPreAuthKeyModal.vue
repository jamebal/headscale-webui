<script setup lang="ts">
import { format } from 'date-fns'
import { useClipboard } from '@vueuse/core'
import type { User } from '@/service/api/user'
import type { PreAuthKeyFormData } from '@/service/api/preAuthKeys'
import { createPreAuthKey } from '@/service/api/preAuthKeys'
import { handleTagCreate } from '@/utils/tags'

const props = defineProps({
  show: {
    type: Boolean,
    default: false,
  },
  users: {
    type: Array as PropType<User[]>,
    default: () => [],
  },
})

const emit = defineEmits(['update:show', 'created'])

const { t } = useI18n()
const { copy } = useClipboard()

const modalVisible = ref(props.show)
const isLoading = ref(false)
const createdKey = ref('')
const timestamp = ref<number>()
const tags = ref<Array<{ label: string, value: string }>>([])
const form = ref<PreAuthKeyFormData>({
  user: null,
  reusable: false,
  ephemeral: false,
  expiration: null,
  aclTags: [],
})

const userOptions = computed(() => props.users.map(user => ({
  label: user.name,
  value: user.id,
})))

function resetForm() {
  createdKey.value = ''
  form.value.user = props.users[0]?.id ?? null
  form.value.reusable = false
  form.value.ephemeral = false
  form.value.aclTags = []
  tags.value = []
  timestamp.value = Date.now() + 1000 * 60 * 60 * 24
}

function closeModal() {
  createdKey.value = ''
  modalVisible.value = false
}

watch(modalVisible, value => emit('update:show', value))

watch(() => props.show, (value) => {
  modalVisible.value = value
  if (value) {
    resetForm()
  }
  else {
    createdKey.value = ''
  }
})

function getExpiration() {
  if (!timestamp.value) {
    return null
  }
  const timezoneOffset = new Date(timestamp.value).getTimezoneOffset() * 60000
  return format(timestamp.value + timezoneOffset, 'yyyy-MM-dd\'T\'HH:mm:ss.SSS\'Z\'')
}

async function handleSubmit() {
  if (!form.value.user) {
    return
  }
  isLoading.value = true
  form.value.expiration = getExpiration()
  form.value.aclTags = tags.value.map(tag => tag.value)
  const result = await createPreAuthKey(form.value)
  isLoading.value = false
  if (!result?.isSuccess) {
    return
  }
  createdKey.value = result.data.preAuthKey.key
  emit('created')
}

function copyCreatedKey() {
  if (!createdKey.value) {
    return
  }
  copy(createdKey.value)
  window.$message.success(t('components.copyText.message'))
}

function dateDisabled(value: number) {
  return value < Date.now() + 1000 * 60 * 60
}

const handleCreate = (label: string) => handleTagCreate(label, tags, t)
</script>

<template>
  <n-modal
    v-model:show="modalVisible"
    :mask-closable="false"
    preset="card"
    :title="t('app.createPreAuthKey')"
    class="w-720px"
    :segmented="{ content: true, action: true }"
    @after-leave="createdKey = ''"
  >
    <n-alert
      v-if="createdKey"
      :title="`${t('app.createPreAuthKey')} ${t('common.success')}`"
      type="success"
    >
      <code data-testid="created-preauthkey">{{ createdKey }}</code>
    </n-alert>
    <n-form v-else label-placement="left" label-align="left" :label-width="100">
      <n-form-item :label="t('app.user')" required>
        <n-select v-model:value="form.user" :options="userOptions" />
      </n-form-item>
      <n-form-item :label="t('app.expiry')">
        <n-date-picker
          v-model:value="timestamp"
          :actions="['clear']"
          type="date"
          :default-calendar-start-time="timestamp"
          :is-date-disabled="dateDisabled"
        />
      </n-form-item>
      <n-form-item :label="t('app.reusable')">
        <n-switch v-model:value="form.reusable" />
      </n-form-item>
      <n-form-item :label="t('app.ephemeral')">
        <n-switch v-model:value="form.ephemeral" />
      </n-form-item>
      <n-form-item :label="t('app.aclTags')">
        <n-dynamic-tags v-model:value="tags" type="info" @create="handleCreate" />
      </n-form-item>
    </n-form>
    <template #action>
      <n-space justify="center">
        <NButton @click="closeModal">
          {{ createdKey ? t('common.close') : t('common.cancel') }}
        </NButton>
        <NButton
          v-if="!createdKey"
          type="primary"
          :loading="isLoading"
          :disabled="isLoading || !form.user"
          @click="handleSubmit"
        >
          {{ t('common.confirm') }}
        </NButton>
        <NButton v-else type="primary" @click="copyCreatedKey">
          {{ t('components.copyText.tooltip') }}
        </NButton>
      </n-space>
    </template>
  </n-modal>
</template>

<style scoped></style>
