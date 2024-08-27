<script setup lang="ts">
import type { FormInst } from 'naive-ui'
import { local } from '@/utils'
import { useAuthStore } from '@/store'

const authStore = useAuthStore()

const { t } = useI18n()
const rules = computed(() => {
  return {
    account: {
      required: true,
      trigger: 'blur',
      message: t('login.accountRuleTip'),
    },
    pwd: {
      required: true,
      trigger: 'blur',
      message: t('login.passwordRuleTip'),
    },
  }
})
const formValue = ref({
  account: '',
  pwd: '',
})
const isRemember = ref(false)
const isLoading = ref(false)

const formRef = ref<FormInst | null>(null)
function handleLogin() {
  formRef.value?.validate(async (errors) => {
    if (errors)
      return

    isLoading.value = true
    const { account, pwd } = formValue.value

    if (isRemember.value)
      local.set('loginAccount', { account, pwd })
    else local.remove('loginAccount')

    await authStore.login(account, pwd)
    isLoading.value = false
  })
}
onMounted(() => {
  checkUserAccount()
})
function checkUserAccount() {
  const loginAccount = local.get('loginAccount')
  if (!loginAccount)
    return

  formValue.value = loginAccount
  isRemember.value = true
}
</script>

<template>
  <div>
    <n-form ref="formRef" :rules="rules" :model="formValue" :show-label="false" size="large">
      <n-form-item path="account">
        <n-input v-model:value="formValue.account" clearable :placeholder="$t('login.accountPlaceholder')" />
      </n-form-item>
      <n-form-item path="pwd">
        <n-input v-model:value="formValue.pwd" type="password" :placeholder="$t('login.passwordPlaceholder')" clearable show-password-on="click">
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
