<script setup lang="ts">
import { onMounted } from 'vue'
import type { DataTableColumns } from 'naive-ui'
import { NButton, NTime } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useAppStore } from '@/store'
import type { User } from '@/service'
import { fetchUserList } from '@/service'
import { showDeleteUserDialog } from '@/views/user/deleteUserDialog'
import NovaIcon from '@/components/common/NovaIcon.vue'
import CreateUserModal from '@/views/user/createUserModal.vue'
import RenameUserModal from '@/views/user/renameUserModal.vue'
import PreAuthKeysModal from '@/views/user/preAuthKeysModal.vue'

const { t } = useI18n()

const userList = ref<User[]>([])

const appStore = useAppStore()

watch(() => appStore.message, (newMessage) => {
  if (newMessage?.event === 'refreshUserList') {
    renderUserList()
  }
})

const dialog = useDialog()

const createUserModalVisible = ref(false)
const renameUserModalVisible = ref(false)
const preAuthKeysModalVisible = ref(false)
const selectUsername = ref('')

const columns = computed((): DataTableColumns<User> => [
  {
    title: 'id',
    key: 'id',
    align: 'center',
  },
  {
    title: t('app.user'),
    key: 'name',
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
    title: t('app.action'),
    key: 'actions',
    align: 'center',
    width: '300px',
    render(rowData) {
      return h(
        'div',
        { style: { display: 'flex', justifyContent: 'space-evenly' } },
        [
          h(NButton, {
            secondary: true,
            size: 'small',
            type: 'default',
            onClick() {
              selectUsername.value = rowData.name
              preAuthKeysModalVisible.value = true
            },
          }, {
            default: () => t('app.preAuthKeys'),
          }),
          h(NButton, {
            secondary: true,
            size: 'small',
            type: 'default',
            onClick() {
              handelRenameUser(rowData.name)
            },
          }, {
            default: () => t('common.rename'),
          }),
          h(NButton, {
            secondary: true,
            size: 'small',
            type: 'error',
            onClick() {
              showDeleteUserDialog(dialog, t, rowData.name)
            },
          }, {
            default: () => t('common.delete'),
          }),
        ],
      )
    },
  },
])

function renderUserList() {
  fetchUserList().then((res) => {
    if (!res.isSuccess) {
      return
    }
    userList.value = res.data.users
  })
}

function handelRenameUser(name: string) {
  selectUsername.value = name
  renameUserModalVisible.value = true
}

onMounted(() => {
  renderUserList()
})
</script>

<template>
  <n-space vertical>
    <div class="flex gap-4">
      <NSpace class="ml-a">
        <NButton strong type="primary" class="ml-a" @click="createUserModalVisible = !createUserModalVisible">
          <template #icon>
            <NovaIcon icon="carbon:add-large" />
          </template>
          {{ t('app.createUser') }}
        </NButton>
      </NSpace>
    </div>
    <n-data-table
      striped
      :columns="columns"
      :data="userList"
    />
    <CreateUserModal v-model:show="createUserModalVisible" />
    <RenameUserModal v-model:show="renameUserModalVisible" :user="selectUsername" />
    <PreAuthKeysModal v-model:show="preAuthKeysModalVisible" :user="selectUsername" />
  </n-space>
</template>

<style scoped></style>
