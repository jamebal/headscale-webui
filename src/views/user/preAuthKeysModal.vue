<script setup lang="ts">
import type { DataTableColumns } from 'naive-ui'
import { NButton, NTag, NTime } from 'naive-ui'
import { onMounted } from 'vue'
import { useAppStore } from '@/store'
import type { PreAuthKeyData } from '@/service'
import { fetchPreAuthKeyList } from '@/service'
import CopyText from '@/components/custom/CopyText.vue'
import CreatePreAuthKeyModal from '@/views/user/createPreAuthKeyModal.vue'
import NovaIcon from '@/components/common/NovaIcon.vue'
import { showExpirePreAuthKeyDialog } from '@/views/user/expirePreAuthKeyDialog'
import PreAuthKeyDetails from '@/views/user/preAuthKeyDetails.vue'

const props = defineProps(
  {
    show: {
      type: Boolean,
      default: false,
    },
    user: {
      type: String,
      default: '',
    },
  },
)

const emit = defineEmits(['update:show'])

const appStore = useAppStore()

const dialog = useDialog()

const { t } = useI18n()

const formModal = ref<any>({
  name: '',
})

const hideInvalid = ref(true)

const modalVisible = ref(props.show)

watch(() => props.show, (newVal) => {
  modalVisible.value = newVal
})

const preAuthKeyList = ref<PreAuthKeyData[]>([])
const preAuthKeyListLoading = ref(false)
const createPreAuthKeyModalVisible = ref(false)

watch(() => appStore.message, (newMessage) => {
  if (newMessage?.event === 'refreshPreAuthKeyList') {
    getPreAuthKeys(props.user)
  }
})

watch(modalVisible, (newVal) => {
  emit('update:show', newVal)
})

watch(() => props.show, (newVal) => {
  modalVisible.value = newVal
  formModal.value.name = ''
  setTimeout(() => {
    getPreAuthKeys(props.user)
  }, 0)
})

function getPreAuthKeys(user: string) {
  if (!user) {
    preAuthKeyList.value = []
    return
  }
  preAuthKeyListLoading.value = true
  fetchPreAuthKeyList(user).then((res) => {
    preAuthKeyListLoading.value = false
    if (!res.isSuccess) {
      return
    }
    preAuthKeyList.value = res.data.preAuthKeys

    if (hideInvalid.value) {
      const currentTime = new Date().getTime()
      preAuthKeyList.value = preAuthKeyList.value.filter(preAuthKey => new Date(preAuthKey.expiration).getTime() > currentTime)
    }
  })
}

function afterLeave() {
  preAuthKeyList.value = []
}

function handleHideInvalidChange() {
  getPreAuthKeys(props.user)
}

const columns = computed((): DataTableColumns<PreAuthKeyData> => [
  {
    title: 'id',
    key: 'id',
    align: 'center',
    width: '50px',
  },
  {
    title: 'Key',
    key: 'key',
    align: 'center',
    render(rowData) {
      return h(CopyText, {
        value: rowData.key,
        actualValue: rowData.key,
        maxLength: '100px',
      }, {
      })
    },
  },
  {
    title: t('app.reusable'),
    key: 'reusable',
    align: 'center',
    width: '100px',
    render(rowData) {
      return h(NTag, {
        style: {
          marginRight: '6px',
        },
        type: rowData.reusable ? 'info' : 'default',
        bordered: true,
      }, {
        default: () => t(`common.${rowData.reusable ? 'yes' : 'no'}`),
      })
    },
  },
  {
    title: t('app.ephemeral'),
    key: 'ephemeral',
    align: 'center',
    width: '100px',
    render(rowData) {
      return h(NTag, {
        style: {
          marginRight: '6px',
        },
        type: rowData.ephemeral ? 'info' : 'default',
        bordered: true,
      }, {
        default: () => t(`common.${rowData.ephemeral ? 'yes' : 'no'}`),
      })
    },
  },
  {
    title: t('app.used'),
    key: 'used',
    align: 'center',
    width: '100',
    render(rowData) {
      return h(NTag, {
        style: {
          marginRight: '6px',
        },
        type: rowData.used ? 'info' : 'default',
        bordered: true,
      }, {
        default: () => t(`common.${rowData.used ? 'yes' : 'no'}`),
      })
    },
  },
  {
    title: t('app.expiry'),
    key: 'expiration',
    width: 100,
    render(rowData) {
      const expiryTime = new Date(rowData.expiration).getTime()
      if (expiryTime < new Date().getTime()) {
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
    render(row) {
      return h(
        'div',
        { style: { display: 'flex', justifyContent: 'space-evenly' } },
        [
          h(PreAuthKeyDetails, {
            preAuthKeyData: row,
          }),
          h(NButton, {
            secondary: true,
            size: 'small',
            type: 'warning',
            onClick() {
              showExpirePreAuthKeyDialog(dialog, t, row.user, row.key)
            },
          }, {
            default: () => t('app.expire'),
          }),
        ],
      )
    },
  },
])

onMounted(() => {
  getPreAuthKeys(props.user)
})
</script>

<template>
  <n-modal
    v-model:show="modalVisible"
    :mask-closable="false"
    preset="card"
    :title="`${t('app.preAuthKeys')} - ${user}`"
    class="w-850px"
    :segmented="{
      content: 'soft',
      footer: 'soft',
    }"
    @after-leave="afterLeave"
  >
    <div class="flex gap-4">
      <n-space vertical justify="center">
        <div>
          {{ t('app.hideInvalid') }}
          <n-switch v-model:value="hideInvalid" @update:value="handleHideInvalidChange" />
        </div>
      </n-space>
      <NSpace class="ml-a">
        <NButton strong type="primary" class="ml-a" @click="createPreAuthKeyModalVisible = !createPreAuthKeyModalVisible">
          <template #icon>
            <NovaIcon icon="carbon:add-large" />
          </template>
          {{ t('app.createPreAuthKey') }}
        </NButton>
      </NSpace>
    </div>
    <template #footer>
      <n-data-table
        style="height: 500px"
        flex-height
        striped
        :loading="preAuthKeyListLoading"
        :columns="columns"
        :data="preAuthKeyList"
      />
      <CreatePreAuthKeyModal v-model:show="createPreAuthKeyModalVisible" :user="user" />
    </template>
  </n-modal>
</template>

<style scoped>

</style>
