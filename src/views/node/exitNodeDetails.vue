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

const enabled = computed(() => {
  return props.routes.find(r => r.enabled)
})

const { t } = useI18n()
</script>

<template>
  <n-popover trigger="hover" placement="bottom">
    <template #trigger>
      <n-tag type="info" size="small" style="margin-left: 10px;">
        {{ `${t('app.exit_node')}` }} <NovaIcon v-if="!enabled" icon="carbon:warning" class="text-size-sm" />
      </n-tag>
    </template>
    <RouteTable :routes="routes" exit-node hide-node-name />
  </n-popover>
</template>

<style scoped>
.text-size-sm {
  font-size: 10px !important;
}
</style>
