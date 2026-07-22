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

const routeCount = computed(() => localRoutes.value.length)
const enableCount = computed(() => localRoutes.value.filter(route => route.approved).length)

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
        {{ `${t('app.subnets')} ${enableCount}/${routeCount}` }}
      </n-tag>
    </template>
    <RouteTable :routes="localRoutes" hide-node-name @routes-updated="handleRoutesUpdated" />
  </n-popover>
</template>

<style scoped>

</style>
