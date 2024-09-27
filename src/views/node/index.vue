<script setup lang="ts">
import { onMounted } from 'vue'
import type { DataTableColumns } from 'naive-ui'
import { NButton, NTag, NTime } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import type { NodeData } from '@/service/api/node'
import type { RouteData } from '@/service/api/route'
import { fetchNodeList } from '@/service/api/node'
import { fetchRouteList } from '@/service/api/route'
import type { User } from '@/service/api/user'
import { fetchUserList } from '@/service/api/user'
import IconCopy from '~icons/icon-park-outline/copy'
import CopyDropDown from '@/components/custom/CopyDropDown.vue'
import NovaIcon from '@/components/common/NovaIcon.vue'
import RegisterNodeModel from '@/views/node/registerNodeModal.vue'
import NodeDetails from '@/views/node/nodeDetails.vue'
import NodeActions from '@/views/node/nodeActions.vue'
import { useAppStore } from '@/store'
import { showBackfillipsDialog } from '@/views/node/backfillIpsDialog'
import NodeSubNetDetails from '@/views/node/nodeSubNetDetails.vue'
import ExitNodeDetails from '@/views/node/exitNodeDetails.vue'

const dialog = useDialog()

const { t } = useI18n()

const nodeList = ref<NodeData[]>([])

const routeList = ref<RouteData[]>([])

const userList = ref<User[]>([])

const registerModalVisible = ref(false)

const appStore = useAppStore()

watch(() => appStore.message, (newMessage) => {
  if (newMessage?.event === 'refreshNodeList') {
    renderNodeList()
  }
})

function createOption(label: string, key: string) {
  return {
    label,
    key,
    icon: () => h(IconCopy),
  }
}

const onlineNumber = computed(() => {
  return nodeList.value.filter(node => node.online).length
})

const selectUser = ref('')

const userOptions = computed(() => {
  const options = userList.value.map(user => ({
    label: user.name,
    value: user.name,
  }))
  // 在数组的开头添加 "All" 选项
  options.unshift({
    label: 'All',
    value: '',
  })
  return options
})

const columns = computed((): DataTableColumns<NodeData> => [
  {
    title: 'id',
    key: 'id',
    align: 'center',
  },
  {
    title: t('app.name'),
    key: 'name',
    render(rowData) {
      let routes = []
      let exitNodes = []
      if (rowData.routes && rowData.routes.length > 0) {
        routes = rowData.routes.filter(route => route.isPrimary)
        exitNodes = rowData.routes.filter(route => !route.isPrimary && route.prefix === '0.0.0.0/0')
      }
      return h(
        'div',
        { style: { whiteSpace: 'pre-line' } },
        [
          h('span', rowData.givenName),
          h('br'),
          h('span', { style: { color: 'var(--test-color-fringe)' } }, rowData.name),
          routes.length > 0
            ? h(NodeSubNetDetails, {
              routes,
            })
            : '',
          exitNodes.length > 0
            ? h(ExitNodeDetails, {
              routes: exitNodes,
            })
            : '',
        ],
      )
    },
  },
  {
    title: t('app.owner'),
    key: 'user.name',
  },
  {
    title: t('app.ipAddresses'),
    key: 'ipAddresses',
    render(row) {
      const dropdownOptions = [
        createOption(row.givenName, row.givenName),
        ...row.ipAddresses.map(ip => createOption(ip, ip)),
      ]
      return h(
        'div',
        { style: { } },
        [
          h(CopyDropDown, {
            dropdownOptions,
          }, {
            default: () => row.ipAddresses[0],
          }),
          h('br'),
        ],
      )
    },
  },
  {
    title: t('app.lastSeen'),
    key: 'lastSeen',
    render(rowData) {
      const expiryTime = new Date(rowData.expiry).getTime()
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
      if (rowData.online) {
        return h(NTag, {
          style: {
            marginRight: '6px',
          },
          type: 'success',
          bordered: true,
        }, {
          default: () => t('app.online'),
        })
      }
      else {
        return h(NTime, {
          type: 'relative',
          time: new Date(rowData.lastSeen),
          style: {
            color: 'var(--test-color-fringe)',
          },
        })
      }
    },
    defaultSortOrder: false,
    sorter: (a, b) => new Date(a.lastSeen).getTime() - new Date(b.lastSeen).getTime(),
  },
  {
    title: t('app.action'),
    key: 'actions',
    align: 'center',
    width: '200px',
    render(row) {
      return h(
        'div',
        { style: { display: 'flex', justifyContent: 'space-evenly' } },
        [
          h(NodeDetails, {
            nodeData: row,
            refresh: () => {
              renderNodeList()
            },
          }),
          h(NodeActions, {
            nodeData: row,
            userList: userList.value,
          }),
        ],
      )
    },
  },
])

function addRoutePrefixToNodes() {
  nodeList.value.forEach((node) => {
    node.routes = []
    routeList.value.forEach((route) => {
      if (route.node.id === node.id) {
        node.routes.push(route)
      }
    })
  })
}

function handleSelectUser(value: string) {
  selectUser.value = value
  renderNodeList()
}

function renderNodeList() {
  fetchNodeList(selectUser.value).then((res) => {
    if (!res.isSuccess) {
      return
    }
    nodeList.value = res.data.nodes
    fetchRouteList().then((res) => {
      if (!res.isSuccess) {
        return
      }
      routeList.value = res.data.routes
      addRoutePrefixToNodes()
    })
  })
}

function backfillips() {
  showBackfillipsDialog(dialog, t)
}

onMounted(() => {
  renderNodeList()
  fetchUserList().then((res) => {
    if (!res.isSuccess) {
      return
    }
    userList.value = res.data.users
  })
})
</script>

<template>
  <n-space vertical>
    <div class="flex gap-4">
      <NTag :bordered="false" round>
        {{ `${nodeList.length} ${t('app.nodes')}` }}
      </NTag>
      <NTag :bordered="false" type="success" round>
        {{ `${onlineNumber} ${t('app.onlines')}` }}
      </NTag>
      <n-select v-model:value="selectUser" :options="userOptions" style="width: 200px" @update:value="handleSelectUser" />
      <NButton strong type="primary" @click="backfillips">
        {{ t('app.backfillips') }}
      </NButton>
      <NSpace class="ml-a">
        <NButton strong type="primary" class="ml-a" @click="registerModalVisible = !registerModalVisible">
          <template #icon>
            <NovaIcon icon="carbon:add-large" />
          </template>
          {{ t('app.registerNode') }}
        </NButton>
      </NSpace>
    </div>
    <n-data-table
      size="small"
      striped
      :columns="columns"
      :data="nodeList"
    />
    <RegisterNodeModel v-model:show="registerModalVisible" :default-user="selectUser" :user-list="userList" />
  </n-space>
</template>

<style scoped></style>
