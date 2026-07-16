<script setup lang="ts">
import type { FormInst } from 'naive-ui'
import {
  isValidBaseDomain,
  local,
  normalizeBaseDomain,
} from '@/utils'
import { useAuthStore } from '@/store'

const authStore = useAuthStore()

const { t } = useI18n()
const rules = computed(() => {
  return {
    serverUrl: {
      required: true,
      trigger: 'blur',
      message: t('login.accountRuleTip'),
    },
    baseDomain: {
      trigger: ['input', 'blur'],
      validator: (_rule: unknown, value: string) => {
        return isValidBaseDomain(value)
          ? true
          : new Error(t('login.baseDomainRuleTip'))
      },
    },
    apiKey: {
      required: true,
      trigger: 'blur',
      message: t('login.passwordRuleTip'),
    },
  }
})
const formValue = ref({
  serverUrl: local.get('serverUrl') || '',
  baseDomain: local.get('baseDomain') || '',
  apiKey: '',
})
const isLoading = ref(false)

const formRef = ref<FormInst | null>(null)
function handleLogin() {
  formRef.value?.validate(async (errors) => {
    if (errors)
      return

    isLoading.value = true
    const { serverUrl, baseDomain, apiKey } = formValue.value
    await authStore.login(
      serverUrl.trim(),
      normalizeBaseDomain(baseDomain),
      apiKey,
    )
    isLoading.value = false
  })
}
</script>

<template>
  <div>
    <n-form ref="formRef" :rules="rules" :model="formValue" :show-label="false" size="large">
      <n-form-item path="serverUrl">
        <n-input v-model:value="formValue.serverUrl" clearable :placeholder="$t('login.accountPlaceholder')" />
      </n-form-item>
      <n-form-item path="baseDomain">
        <n-input v-model:value="formValue.baseDomain" clearable :placeholder="$t('login.baseDomainPlaceholder')" />
      </n-form-item>
      <n-form-item path="apiKey">
        <n-input
          v-model:value="formValue.apiKey"
          type="password"
          autocomplete="off"
          :placeholder="$t('login.passwordPlaceholder')"
          clearable
          show-password-on="click"
        >
          <template #password-invisible-icon>
            <icon-park-outline-preview-close-one />
          </template>
          <template #password-visible-icon>
            <icon-park-outline-preview-open />
          </template>
        </n-input>
      </n-form-item>
      <n-space vertical :size="20">
        <n-button block type="primary" size="large" :loading="isLoading" :disabled="isLoading" @click="handleLogin">
          {{ $t('login.signIn') }}
        </n-button>
      </n-space>
    </n-form>
  </div>
</template>

<style scoped></style>
