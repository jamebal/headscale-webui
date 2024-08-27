<script setup lang="ts">
import type { NodeData } from '@/service/api/node'

defineProps(
  {
    nodeData: {
      type: Object as PropType<NodeData>,
      required: true,
    },
  },
)

const { t } = useI18n()
</script>

<template>
  <n-popover trigger="click" placement="left">
    <template #trigger>
      <n-button size="small">
        {{ t('app.details') }}
      </n-button>
    </template>
    <n-descriptions label-placement="left" :column="1">
      <n-descriptions-item :label="t('app.createdTime')">
        <n-time :time="new Date(nodeData.createdAt)" />
      </n-descriptions-item>
      <n-descriptions-item :label="t('app.lastSeen')">
        <n-time :time="new Date(nodeData.lastSeen)" />
      </n-descriptions-item>
      <n-descriptions-item :label="t('app.registerMethod')">
        {{ nodeData.registerMethod }}
      </n-descriptions-item>
      <n-descriptions-item :label="t('app.forcedTags')">
        <n-space>
          <n-tag v-for="tag in nodeData.forcedTags" :key="tag" size="small" type="info">
            {{ tag }}
          </n-tag>
        </n-space>
      </n-descriptions-item>
      <n-descriptions-item :label="t('app.invalidTags')">
        <n-space>
          <n-tag v-for="tag in nodeData.invalidTags" :key="tag" size="small" type="info">
            {{ tag }}
          </n-tag>
        </n-space>
      </n-descriptions-item>
      <n-descriptions-item :label="t('app.validTags')">
        <n-space>
          <n-tag v-for="tag in nodeData.validTags" :key="tag" size="small" type="info">
            {{ tag }}
          </n-tag>
        </n-space>
      </n-descriptions-item>
      <n-descriptions-item :label="t('app.expiry')">
        <n-time :time="new Date(nodeData.expiry)" />
      </n-descriptions-item>
    </n-descriptions>
  </n-popover>
</template>

<style scoped>

</style>
