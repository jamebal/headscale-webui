<script setup lang="ts">
import { darkTheme } from 'naive-ui'
import { useAppStore } from './store'
import { naiveI18nOptions } from '@/utils'

const appStore = useAppStore()

const naiveLocale = computed(() => {
  return naiveI18nOptions[appStore.lang] ? naiveI18nOptions[appStore.lang] : naiveI18nOptions.enUS
},
)
</script>

<template>
  <n-config-provider
    class="wh-full" inline-theme-disabled :theme="appStore.colorMode === 'dark' ? darkTheme : null"
    :locale="naiveLocale.locale" :date-locale="naiveLocale.dateLocale" :theme-overrides="appStore.theme"
  >
    <naive-provider>
      <router-view />
    </naive-provider>
  </n-config-provider>
</template>

<style lang="scss">
.v-binder-follower-content {
  .n-cascader-menu .n-cascader-submenu:not(:first-child) {
    width: 360px !important;
  }
}
</style>
