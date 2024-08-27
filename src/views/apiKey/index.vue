<script setup lang="ts">
import { onMounted } from 'vue'
import type { DataTableColumns } from 'naive-ui'
import { NButton, NTag, NTime } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { type ApiKeyData, fetchApiKeyList } from '@/service/api/apiKey'
import { useAppStore } from '@/store'
import NovaIcon from '@/components/common/NovaIcon.vue'
import CreateApiKeyModel from '@/views/apiKey/createApiKeyModel.vue'
import { showExpireApiKeyDialog } from '@/views/apiKey/expireApiKeyDialog'
import { showDeleteApiKeyDialog } from '@/views/apiKey/deleteApiKeyDialog'
import { local } from '@/utils'

const { t } = useI18n()

const apiKeyList = ref<ApiKeyData[]>([])

const appStore = useAppStore()

const dialog = useDialog()

watch(() => appStore.message, (newMessage) => {
  if (newMessage?.event === 'refreshApiKeyList') {
    renderApiKeyList()
  }
})

const createApiKeyModelVisible = ref(false)

const columns = computed((): DataTableColumns<ApiKeyData> => [
  {
    title: 'id',
    key: 'id',
    align: 'center',
  },
  {
    title: t('app.prefix'),
    key: 'prefix',
    render(rowData) {
      // lwnXxhGYTQ.wS5QNkqRxqYyWsR5iv_DjYykN8wCf5OvQpJqVNWzf0c
      const serverUrl = local.get('accessToken')
      if (serverUrl?.startsWith(rowData.prefix)) {
        return h(NTag, {
          style: {
            marginRight: '6px',
          },
          type: 'success',
          bordered: true,
        }, {
          default: () => rowData.prefix,
        })
      }
      return rowData.prefix
    },
  },
  {
    title: t('app.createdTime'),
    key: 'createdAt',
    render(rowData) {
      return h(NTime, {
        time: new Date(rowData.createdAt),
      })
    },
  },
  {
    title: t('app.expiry'),
    key: 'expiration',
    render(rowData) {
      const expiryTime = new Date(rowData.expiration).getTime()
      if (expiryTime > 0 && expiryTime < new Date().getTime()) {
        return h(NTag, {
          style: {
            marginRight: '6px',
          },
          type: 'error',
          bordered: true,
        }, {
          default: () => t('app.expired'),
        })
      }
      return h(NTime, {
        type: 'relative',
        time: new Date(rowData.expiration),
      })
    },
  },
  {
    title: t('app.action'),
    key: 'actions',
    align: 'center',
    width: '180px',
    render(row) {
      return h(
        'div',
        { style: { display: 'flex', justifyContent: 'space-evenly' } },
        [
          h(NButton, {
            secondary: true,
            size: 'small',
            type: 'warning',
            onClick() {
              showExpireApiKeyDialog(dialog, t, row.prefix)
            },
          }, {
            default: () => t('app.expire'),
          }),
          h(NButton, {
            secondary: true,
            size: 'small',
            type: 'error',
            onClick() {
              showDeleteApiKeyDialog(dialog, t, row.prefix)
            },
          }, {
            default: () => t('common.delete'),
          }),
        ],
      )
    },
  },
])

function renderApiKeyList() {
  fetchApiKeyList().then((res) => {
    if (!res.isSuccess) {
      return
    }
    apiKeyList.value = res.data.apiKeys
  })
}

onMounted(() => {
  renderApiKeyList()
})
</script>

<template>
  <n-space vertical>
    <div class="flex gap-4">
      <NSpace class="ml-a">
        <NButton strong type="primary" class="ml-a" @click="createApiKeyModelVisible = !createApiKeyModelVisible">
          <template #icon>
            <NovaIcon icon="carbon:add-large" />
          </template>
          {{ t('app.createApiKey') }}
        </NButton>
      </NSpace>
    </div>
    <n-data-table
      striped
      :columns="columns"
      :data="apiKeyList"
    />
    <CreateApiKeyModel v-model:show="createApiKeyModelVisible" />
  </n-space>
</template>

<style scoped></style>
