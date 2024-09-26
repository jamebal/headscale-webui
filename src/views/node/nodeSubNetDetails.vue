<script setup lang="ts">
import RouteTable from '@/views/route/routeTable.vue'
import type { RouteData } from '@/service'

const props = defineProps(
  {
    routes: {
      type: Array as () => Array<RouteData>,
      required: true,
    },
  },
)

const routeCount = props.routes?.length
const enableCount = props.routes?.filter(route => route?.enabled)?.length

const { t } = useI18n()
</script>

<template>
  <n-popover trigger="hover" placement="bottom">
    <template #trigger>
      <n-tag type="info" size="small" style="margin-left: 10px;">
        {{ `${t('app.subnets')} ${enableCount}/${routeCount}` }}
      </n-tag>
    </template>
    <RouteTable :routes="routes" hide-node-name />
  </n-popover>
</template>

<style scoped>

</style>
