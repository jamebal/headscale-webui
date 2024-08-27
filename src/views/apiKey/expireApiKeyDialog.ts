import type { DialogApiInjection } from 'naive-ui/lib/dialog/src/DialogProvider'
import { expireApiKey } from '@/service/api/apiKey'
import { useAppStore } from '@/store/app'

const appStore = useAppStore()

export function showExpireApiKeyDialog(
  dialog: DialogApiInjection,
  t: (key: string) => string,
  prefix: string,
) {
  const d = dialog.warning({
    title: t('app.expire'),
    content: `${t('app.expire')} ApiKey【 ${prefix} 】, ${t('common.areYouSure')}`,
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      d.loading = true
      const result = await expireApiKey(prefix)
      if (!result || !result.isSuccess) {
        return
      }
      appStore.sendMessage({ event: 'refreshApiKeyList', data: {} })
      window.$message.success(`${t('app.expire')} ${t('common.success')}`)
      d.loading = false
    },
  })
}
