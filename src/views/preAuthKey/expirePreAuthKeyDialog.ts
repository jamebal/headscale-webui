import type { DialogApiInjection } from 'naive-ui/lib/dialog/src/DialogProvider'
import { expirePreAuthKey } from '@/service/api/preAuthKeys'
import { useAppStore } from '@/store/app'

const appStore = useAppStore()

export function showExpirePreAuthKeyDialog(
  dialog: DialogApiInjection,
  t: (key: string) => string,
  id: string,
  key: string,
) {
  const instance = dialog.warning({
    title: t('app.expire'),
    content: `${t('app.expire')} ${t('app.preAuthKey')}【 ${key} 】, ${t('common.areYouSure')}`,
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      instance.loading = true
      const result = await expirePreAuthKey(id)
      if (!result?.isSuccess) {
        instance.loading = false
        return
      }
      appStore.sendMessage({ event: 'refreshPreAuthKeyList', data: {} })
      window.$message.success(`${t('app.expire')} ${t('common.success')}`)
      instance.loading = false
    },
  })
}
