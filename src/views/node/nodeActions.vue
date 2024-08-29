<script setup lang="ts">
import { NButton } from 'naive-ui'
import type { DropdownOption } from 'naive-ui/es/dropdown/src/interface'
import { showDeleteNodeDialog } from './deleteNodeDialog'
import type { NodeData } from '@/service/api/node'
import RenameNodeModel from '@/views/node/renameNodeModal.vue'
import ChangeOwnerModel from '@/views/node/changeOwnerModal.vue'
import type { User } from '@/service/api/user'
import { showLogoutNodeDialog } from '@/views/node/logoutNodeDialog'
import SetTagsModel from '@/views/node/setTagsModel.vue'

const props = defineProps(
  {
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

const dialog = useDialog()

const { t } = useI18n()

const renameModalVisible = ref(false)
const changeOwnerModalVisible = ref(false)
const setTagsModalVisible = ref(false)

const options = computed((): DropdownOption[] => [
  {
    label: t('app.renameNode'),
    key: 'renameNode',
  },
  {
    label: t('app.changeOwner'),
    key: 'changeOwner',
  },
  {
    label: t('app.setTags'),
    key: 'setTags',
  },
  {
    type: 'divider',
    key: 'd1',
  },
  {
    label: t('app.deleteNode'),
    key: 'delete',
    props: {
      style: 'color: #d03050',
    },
  },
  {
    label: t('app.logout'),
    key: 'logout',
    props: {
      style: 'color: #f0a020',
    },
  },
])

function handleAction(key: string) {
  switch (key) {
    case 'renameNode':
      renameModalVisible.value = true
      break
    case 'changeOwner':
      changeOwnerModalVisible.value = true
      break
    case 'setTags':
      setTagsModalVisible.value = true
      break
    case 'logout':
      showLogoutNodeDialog(dialog, t, props.nodeData)
      break
    case 'delete':
      showDeleteNodeDialog(dialog, t, props.nodeData)
      break
  }
}
</script>

<template>
  <n-dropdown :options="options" trigger="click" @select="handleAction">
    <NButton size="small" secondary>
      <NovaIcon icon="carbon:overflow-menu-horizontal" />
    </NButton>
  </n-dropdown>
  <RenameNodeModel v-model:show="renameModalVisible" :node-data="nodeData" />
  <ChangeOwnerModel v-model:show="changeOwnerModalVisible" :node-data="nodeData" :user-list="userList" />
  <SetTagsModel v-model:show="setTagsModalVisible" :node-data="nodeData" />
</template>

<style scoped>

</style>
