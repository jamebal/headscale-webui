import type { DialogApiInjection } from 'naive-ui/lib/dialog/src/DialogProvider'
import { deleteApiKey } from '@/service/api/apiKey'
import { useAppStore } from '@/store/app'

const appStore = useAppStore()

export function showDeleteApiKeyDialog(
  dialog: DialogApiInjection,
  t: (key: string) => string,
  prefix: string,
) {
  const d = dialog.warning({
    title: t('common.delete'),
    content: `${t('common.delete')} ApiKey【 ${prefix} 】, ${t('common.areYouSure')}`,
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      d.loading = true
      const result = await deleteApiKey(prefix)
      if (!result || !result.isSuccess) {
        return
      }
      appStore.sendMessage({ event: 'refreshApiKeyList', data: {} })
      window.$message.success(`${t('common.delete')} ${t('common.success')}`)
      d.loading = false
    },
  })
}
