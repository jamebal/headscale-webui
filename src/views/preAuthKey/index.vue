<script setup lang="ts">
import { onMounted } from 'vue'
import type { DataTableColumns } from 'naive-ui'
import { NButton, NTag, NTime } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import type { PreAuthKeyData } from '@/service/api/preAuthKeys'
import { fetchPreAuthKeyList } from '@/service/api/preAuthKeys'
import type { User } from '@/service/api/user'
import { fetchUserList } from '@/service/api/user'
import { useAppStore } from '@/store'
import { showExpirePreAuthKeyDialog } from '@/views/preAuthKey/expirePreAuthKeyDialog'
import { showDeletePreAuthKeyDialog } from '@/views/preAuthKey/deletePreAuthKeyDialog'

const { t } = useI18n()
const dialog = useDialog()
const appStore = useAppStore()

const preAuthKeys = ref<PreAuthKeyData[]>([])
const users = ref<User[]>([])
const selectedUserId = ref('')
const hideInvalid = ref(true)
const loading = ref(false)

const userOptions = computed(() => [
  { label: 'All', value: '' },
  ...users.value.map(user => ({ label: user.name, value: user.id })),
])

function isValid(key: PreAuthKeyData) {
  const expiresAt = new Date(key.expiration).getTime()
  const notExpired = Number.isNaN(expiresAt) || expiresAt > Date.now()
  return notExpired && (!key.used || key.reusable)
}

const visiblePreAuthKeys = computed(() => preAuthKeys.value.filter((key) => {
  const belongsToUser = !selectedUserId.value || key.user.id === selectedUserId.value
  const passesValidityFilter = !hideInvalid.value || isValid(key)
  return belongsToUser && passesValidityFilter
}))

function booleanTag(value: boolean) {
  return h(NTag, {
    type: value ? 'info' : 'default',
    bordered: true,
  }, {
    default: () => t(`common.${value ? 'yes' : 'no'}`),
  })
}

const columns = computed((): DataTableColumns<PreAuthKeyData> => [
  { title: 'id', key: 'id', align: 'center' },
  { title: t('app.user'), key: 'user.name' },
  {
    title: t('app.key'),
    key: 'key',
    render: row => row.key,
  },
  {
    title: t('app.reusable'),
    key: 'reusable',
    render: row => booleanTag(row.reusable),
  },
  {
    title: t('app.ephemeral'),
    key: 'ephemeral',
    render: row => booleanTag(row.ephemeral),
  },
  {
    title: t('app.used'),
    key: 'used',
    render: row => booleanTag(row.used),
  },
  {
    title: t('app.aclTags'),
    key: 'aclTags',
    render: row => h('div', row.aclTags.map(tag => h(NTag, {
      size: 'small',
      type: 'info',
      style: { marginRight: '4px' },
    }, { default: () => tag }))),
  },
  {
    title: t('app.createdTime'),
    key: 'createdAt',
    render: row => h(NTime, { time: new Date(row.createdAt) }),
  },
  {
    title: t('app.expiry'),
    key: 'expiration',
    render: row => isValid(row)
      ? h(NTime, { type: 'relative', time: new Date(row.expiration) })
      : h(NTag, { type: 'error', bordered: true }, { default: () => t('app.expired') }),
  },
  {
    title: t('app.action'),
    key: 'actions',
    align: 'center',
    width: '180px',
    render: row => h('div', { style: { display: 'flex', justifyContent: 'space-evenly' } }, [
      h(NButton, {
        secondary: true,
        size: 'small',
        type: 'warning',
        onClick: () => showExpirePreAuthKeyDialog(dialog, t, row.id, row.key),
      }, { default: () => t('app.expire') }),
      h(NButton, {
        secondary: true,
        size: 'small',
        type: 'error',
        onClick: () => showDeletePreAuthKeyDialog(dialog, t, row.id, row.key),
      }, { default: () => t('common.delete') }),
    ]),
  },
])

async function renderPage() {
  loading.value = true
  const [keyResult, userResult] = await Promise.all([
    fetchPreAuthKeyList(),
    fetchUserList(),
  ])
  if (keyResult.isSuccess) {
    preAuthKeys.value = keyResult.data.preAuthKeys
  }
  if (userResult.isSuccess) {
    users.value = userResult.data.users
  }
  loading.value = false
}

watch(() => appStore.message, (message) => {
  if (message?.event === 'refreshPreAuthKeyList') {
    renderPage()
  }
})

onMounted(() => {
  renderPage()
})
</script>

<template>
  <n-space vertical>
    <div class="flex gap-4">
      <n-select v-model:value="selectedUserId" :options="userOptions" style="width: 200px" />
      <div class="flex items-center gap-2">
        {{ t('app.hideInvalid') }}
        <n-switch v-model:value="hideInvalid" />
      </div>
    </div>
    <n-data-table
      striped
      :loading="loading"
      :columns="columns"
      :data="visiblePreAuthKeys"
      :row-key="(row: PreAuthKeyData) => row.id"
    />
  </n-space>
</template>

<style scoped></style>
