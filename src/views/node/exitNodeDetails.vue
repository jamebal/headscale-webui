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

const localRoutes = ref<RouteData[]>([...props.routes])

const enabled = computed(() => {
  return localRoutes.value.find(route => route.approved)
})

watch(() => props.routes, (routes) => {
  localRoutes.value = [...routes]
}, { deep: true })

function handleRoutesUpdated(routes: RouteData[]) {
  localRoutes.value = routes
}

const { t } = useI18n()
</script>

<template>
  <n-popover trigger="hover" placement="bottom">
    <template #trigger>
      <n-tag type="info" size="small" style="margin-left: 10px;">
        {{ `${t('app.exit_node')}` }} <NovaIcon v-if="!enabled" icon="carbon:warning" class="text-size-sm" />
      </n-tag>
    </template>
    <RouteTable :routes="localRoutes" exit-node hide-node-name @routes-updated="handleRoutesUpdated" />
  </n-popover>
</template>

<style scoped>
.text-size-sm {
  font-size: 10px !important;
}
</style>
