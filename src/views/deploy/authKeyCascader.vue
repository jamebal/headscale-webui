<script setup lang="ts">
import type { CascaderOption } from 'naive-ui'
import { NTag } from 'naive-ui'
import type { PreAuthKeyData, User } from '@/service'
import { fetchPreAuthKeyList, fetchUserList, filterPreAuthKeysByUser } from '@/service'

const props = defineProps(
  {
    value: {
      type: String,
    },
  },
)

const emit = defineEmits(['update:value'])

const { t } = useI18n()

const authKeyCascaderOptions = ref([
  {
    label: 'jmal1',
    value: 'jmal1',
    depth: 1,
    isLeaf: true,
  },
])

const modelValue = ref(props.value)
const allPreAuthKeys = ref<PreAuthKeyData[]>()

watch(modelValue, (newVal) => {
  emit('update:value', newVal)
})

async function handleAuthKeyCascaderLoad(option: CascaderOption) {
  if (!allPreAuthKeys.value) {
    const result = await fetchPreAuthKeyList()
    if (!result.isSuccess) {
      option.children = []
      return
    }
    allPreAuthKeys.value = result.data.preAuthKeys
  }
  const userId = String(option.value)
  const preAuthKeys = filterPreAuthKeysByUser(allPreAuthKeys.value, userId)
    .filter((authKey) => {
      const expiryTime = new Date(authKey.expiration).getTime()
      return expiryTime >= new Date().getTime() && (!authKey.used || authKey.reusable)
    })
  option.children = preAuthKeys.map(authKey => ({
    label: authKey.key,
    value: authKey.key,
    key: true,
    used: authKey.used,
    reusable: authKey.reusable,
    ephemeral: authKey.ephemeral,
    isLeaf: true,
  }))
  option.children.unshift({
    label: `${preAuthKeys.length} Valid Key(s)`,
    value: '',
    isLeaf: true,
  })
}

function renderLabel(option: { value?: string | number, label?: string, key?: boolean | false, used?: boolean, reusable?: boolean, ephemeral?: boolean }) {
  const style = 'margin-left: 5px; cursor: default !important'
  const size = 'small'
  if (option.key) {
    return h('div', [
      h('span', `${option.label?.slice(0, 12)}...`),
      h(NTag, {
        size,
        style,
        disabled: !option.used,
        type: option.used ? 'info' : 'default',
      }, {
        default: () => t(`app.used`),
      }),
      h(NTag, {
        size,
        style,
        disabled: !option.reusable,
        type: option.reusable ? 'info' : 'default',
      }, {
        default: () => t(`app.reusable`),
      }),
      h(NTag, {
        size,
        style,
        disabled: !option.ephemeral,
        type: option.ephemeral ? 'info' : 'default',
      }, {
        default: () => t(`app.ephemeral`),
      }),
    ])
  }
  else {
    return option.label
  }
}

async function getUserList() {
  const res = await fetchUserList()
  if (!res || !res.isSuccess) {
    return
  }
  authKeyCascaderOptions.value = res.data.users.map((user: User) => ({
    label: user.name,
    value: user.id,
    depth: 1,
    isLeaf: false,
  }))
}

onMounted(() => {
  getUserList()
})
</script>

<template>
  <n-cascader
    v-model:value="modelValue"
    class="auth-key-cascader"
    :options="authKeyCascaderOptions"
    show-path
    check-strategy="child"
    remote
    :render-label="renderLabel"
    :on-load="handleAuthKeyCascaderLoad"
  />
</template>

<style scoped lang="scss">
</style>
