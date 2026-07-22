import type { DialogApiInjection } from 'naive-ui/lib/dialog/src/DialogProvider'
import { deletePreAuthKey } from '@/service/api/preAuthKeys'
import { useAppStore } from '@/store/app'

const appStore = useAppStore()

export function showDeletePreAuthKeyDialog(
  dialog: DialogApiInjection,
  t: (key: string) => string,
  id: string,
  key: string,
) {
  const instance = dialog.warning({
    title: t('common.delete'),
    content: `${t('common.delete')} ${t('app.preAuthKey')}【 ${key} 】, ${t('common.areYouSure')}`,
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      instance.loading = true
      const result = await deletePreAuthKey(id)
      if (!result?.isSuccess) {
        instance.loading = false
        return
      }
      appStore.sendMessage({ event: 'refreshPreAuthKeyList', data: {} })
      window.$message.success(`${t('common.delete')} ${t('common.success')}`)
      instance.loading = false
    },
  })
}
