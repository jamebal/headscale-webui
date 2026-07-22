<script setup lang="ts">
import { onMounted } from 'vue'
import type { DataTableColumns } from 'naive-ui'
import { NButton, NTag } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/store'
import type { RouteData } from '@/service/api/route'
import { buildApprovedRoutes, deriveRoutes } from '@/service/api/route'
import { fetchNodeList, setApprovedRoutes } from '@/service/api/node'

const props = defineProps(
  {
    routes: {
      type: Array as PropType<RouteData[]>,
      required: false,
    },
    hideNodeName: {
      type: Boolean,
      default: false,
    },
    exitNode: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
)

const emit = defineEmits<{
  (event: 'routesUpdated', routes: RouteData[]): void
}>()

const { t } = useI18n()

const routeList = ref<RouteData[]>([])
const updatingRouteKey = ref('')

const appStore = useAppStore()

watch(() => appStore.message, (newMessage) => {
  if (newMessage?.event === 'refreshRouteList') {
    renderRouteList()
  }
})

async function toggleRoute(route: RouteData) {
  const approved = !route.approved
  const routes = buildApprovedRoutes(route.node, route.prefix, approved)
  updatingRouteKey.value = route.key
  const result = await setApprovedRoutes(route.node.id, routes)
  updatingRouteKey.value = ''
  if (!result?.isSuccess) {
    return
  }
  const updatedRoutes = routeList.value.map(item => item.node.id === route.node.id
    ? {
        ...item,
        node: { ...item.node, approvedRoutes: routes },
        approved: routes.includes(item.prefix),
      }
    : item)
  routeList.value = updatedRoutes
  emit('routesUpdated', updatedRoutes)
  window.$message.success(`${t(`common.${approved ? 'enable' : 'disable'}`)} ${t('common.success')}`)
  appStore.sendMessage({ event: 'refreshNodeList', data: {} })
}

const columns = computed((): DataTableColumns<RouteData> => {
  const baseColumns: DataTableColumns<RouteData> = [
    {
      title: t('app.node'),
      key: 'node.givenName',
    },
    {
      title: t('app.prefix'),
      key: 'prefix',
    },
    {
      title: t('app.enabled'),
      key: 'approved',
      render(rowData) {
        return h(NTag, {
          type: rowData.approved ? 'info' : 'default',
          bordered: true,
        }, {
          default: () => t(`common.${rowData.approved ? 'enable' : 'disable'}`),
        })
      },
    },
    {
      title: t('app.action'),
      key: 'actions',
      align: 'center',
      width: '120px',
      render(rowData) {
        return h(NButton, {
          secondary: true,
          size: 'small',
          loading: updatingRouteKey.value === rowData.key,
          type: rowData.approved ? 'warning' : 'info',
          onClick() {
            toggleRoute(rowData)
          },
        }, {
          default: () => t(`common.${rowData.approved ? 'disable' : 'enable'}`),
        })
      },
    },
  ]
  if (props.hideNodeName) {
    baseColumns.splice(0, 1)
  }
  return baseColumns
})

async function renderRouteList() {
  if (props.routes) {
    routeList.value = props.routes
    return
  }
  const result = await fetchNodeList('')
  if (!result?.isSuccess) {
    return
  }
  routeList.value = deriveRoutes(result.data.nodes)
}

watch(() => props.routes, () => {
  renderRouteList()
}, { deep: true })

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
      :row-key="(row: RouteData) => row.key"
    />
  </n-space>
</template>

<style scoped></style>
