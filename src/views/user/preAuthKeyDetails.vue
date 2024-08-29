<script setup lang="ts">
import type { PreAuthKeyData } from '@/service'

defineProps(
  {
    preAuthKeyData: {
      type: Object as PropType<PreAuthKeyData>,
      required: true,
    },
  },
)

const { t } = useI18n()
</script>

<template>
  <n-popover trigger="click" placement="left">
    <template #trigger>
      <n-button size="small" secondary>
        {{ t('app.details') }}
      </n-button>
    </template>
    <n-descriptions label-placement="left" :column="1">
      <n-descriptions-item :label="t('app.createdTime')">
        <n-time :time="new Date(preAuthKeyData.createdAt)" />
      </n-descriptions-item>
      <n-descriptions-item :label="t('app.aclTags')">
        <n-space>
          <n-tag v-for="tag in preAuthKeyData.aclTags" :key="tag" size="small" type="info">
            {{ tag }}
          </n-tag>
        </n-space>
      </n-descriptions-item>
    </n-descriptions>
  </n-popover>
</template>

<style scoped>

</style>
