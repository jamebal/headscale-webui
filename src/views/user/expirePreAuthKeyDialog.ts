import type { DialogApiInjection } from 'naive-ui/lib/dialog/src/DialogProvider'
import { useAppStore } from '@/store/app'
import { expirePreAuthKey } from '@/service'

const appStore = useAppStore()

export function showExpirePreAuthKeyDialog(
  dialog: DialogApiInjection,
  t: (key: string) => string,
  user: string,
  key: string,
) {
  const d = dialog.warning({
    title: t('app.expire'),
    content: `${t('app.expire')} ${t('app.preAuthKey')}【 ${key} 】, ${t('common.areYouSure')}`,
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      d.loading = true
      const result = await expirePreAuthKey(user, key)
      if (!result || !result.isSuccess) {
        return
      }
      appStore.sendMessage({ event: 'refreshPreAuthKeyList', data: {} })
      window.$message.success(`${t('app.expire')} ${t('common.success')}`)
      d.loading = false
    },
  })
}
