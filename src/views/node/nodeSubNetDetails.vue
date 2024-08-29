<script setup lang="ts">
import type { NodeData } from '@/service/api/node'
import RouteTable from '@/views/route/routeTable.vue'

const props = defineProps(
  {
    nodeData: {
      type: Object as PropType<NodeData>,
      required: true,
    },
  },
)

const routeCount = props.nodeData.routes?.length
const enableCount = props.nodeData.routes?.filter(route => route?.enabled)?.length

const { t } = useI18n()
</script>

<template>
  <n-popover trigger="click" placement="bottom">
    <template #trigger>
      <n-tag type="info" size="small" style="margin-left: 10px;">
        {{ `${t('app.subnets')} ${enableCount}/${routeCount}` }}
      </n-tag>
    </template>
    <RouteTable :routes="nodeData.routes" hide-node-name />
  </n-popover>
</template>

<style scoped>

</style>
