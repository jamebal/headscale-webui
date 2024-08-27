<script setup lang="ts">
import { onMounted } from 'vue'
import type { DataTableColumns } from 'naive-ui'
import { NButton, NTag } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/store'
import type { RouteData } from '@/service'
import { disableRoute, enableRoute, fetchRouteList } from '@/service'
import {showDeleteRouteDialog} from "@/views/route/deleteRouteDialog";

const { t } = useI18n()

const routeList = ref<RouteData[]>([])

const appStore = useAppStore()

watch(() => appStore.message, (newMessage) => {
  if (newMessage?.event === 'refreshRouteList') {
    renderRouteList()
  }
})

const dialog = useDialog()

const enableBtnLoading = ref(false)

function enableOrDisableRoute(id: string) {
  const route = routeList.value.find(item => item.id === id)
  if (!route) {
    return
  }
  enableBtnLoading.value = true
  if (route.enabled) {
    disableRoute(id).then((res) => {
      enableBtnLoading.value = false
      if (!res.isSuccess) {
        return
      }
      window.$message.success(`${t('common.disable')} ${t('common.success')}`)
      renderRouteList()
    })
  }
  else {
    enableRoute(id).then((res) => {
      enableBtnLoading.value = false
      if (!res.isSuccess) {
        return
      }
      window.$message.success(`${t('common.enable')} ${t('common.success')}`)
      renderRouteList()
    })
  }
}

const columns = computed((): DataTableColumns<RouteData> => [
  {
    title: 'id',
    key: 'id',
    align: 'center',
  },
  {
    title: t('app.node'),
    key: 'node.givenName',
  },
  {
    title: t('app.prefix'),
    key: 'prefix',
  },
  {
    title: t('app.advertised'),
    key: 'advertised',
    render(rowData) {
      return h(NTag, {
        style: {
          marginRight: '6px',
        },
        type: rowData.advertised ? 'info' : 'default',
        bordered: true,
      }, {
        default: () => t(`common.${rowData.advertised ? 'yes' : 'no'}`),
      })
    },
  },
  {
    title: t('app.enabled'),
    key: 'enabled',
    render(rowData) {
      return h(NTag, {
        style: {
          marginRight: '6px',
        },
        type: rowData.enabled ? 'info' : 'default',
        bordered: true,
      }, {
        default: () => t(`common.${rowData.enabled ? 'enable' : 'disable'}`),
      })
    },
  },
  {
    title: t('app.isPrimary'),
    key: 'isPrimary',
    render(rowData) {
      return h(NTag, {
        style: {
          marginRight: '6px',
        },
        type: rowData.isPrimary ? 'info' : 'default',
        bordered: true,
      }, {
        default: () => t(`common.${rowData.isPrimary ? 'yes' : 'no'}`),
      })
    },
  },
  {
    title: t('app.action'),
    key: 'actions',
    align: 'center',
    width: '180px',
    render(rowData) {
      return h(
        'div',
        { style: { display: 'flex', justifyContent: 'space-evenly' } },
        [
          h(NButton, {
            secondary: true,
            size: 'small',
            loading: enableBtnLoading.value,
            type: rowData.enabled ? 'warning' : 'info',
            onClick() {
              enableOrDisableRoute(rowData.id)
            },
          }, {
            default: () => t(`common.${rowData.enabled ? 'disable' : 'enable'}`),
          }),
          h(NButton, {
            secondary: true,
            size: 'small',
            type: 'error',
            onClick() {
              showDeleteRouteDialog(dialog, t, rowData.id, rowData.prefix)
            },
          }, {
            default: () => t('common.delete'),
          }),
        ],
      )
    },
  },
])

function renderRouteList() {
  fetchRouteList().then((res) => {
    if (!res.isSuccess) {
      return
    }
    routeList.value = res.data.routes
  })
}

onMounted(() => {
  renderRouteList()
})
</script>

<template>
  <n-space vertical>
    <n-data-table
      striped
      :columns="columns"
      :data="routeList"
    />
  </n-space>
</template>

<style scoped></style>
