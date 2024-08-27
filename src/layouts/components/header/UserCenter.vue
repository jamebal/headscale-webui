<script setup lang="ts">
import { useAuthStore } from '@/store'
import IconLogout from '~icons/icon-park-outline/logout'

const { t } = useI18n()

const { logout } = useAuthStore()

const options = computed(() => {
  return [
    {
      label: t('app.loginOut'),
      key: 'loginOut',
      icon: () => h(IconLogout),
    },
  ]
})
function handleSelect(key: string | number) {
  if (key === 'loginOut') {
    window.$dialog?.info({
      title: t('app.loginOutTitle'),
      content: t('app.loginOutContent'),
      positiveText: t('common.confirm'),
      negativeText: t('common.cancel'),
      onPositiveClick: () => {
        logout()
      },
    })
  }
}
</script>

<template>
  <n-dropdown
    trigger="click"
    :options="options"
    @select="handleSelect"
  >
    <CommonWrapper>
      <icon-park-outline-logout />
    </CommonWrapper>
  </n-dropdown>
</template>

<style scoped></style>
