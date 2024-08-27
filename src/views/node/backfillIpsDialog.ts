import type { DialogApiInjection } from 'naive-ui/lib/dialog/src/DialogProvider'
import { backFillIps } from '@/service/api/node'

export function showBackfillipsDialog(
  dialog: DialogApiInjection,
  t: (key: string) => string,
) {
  const d = dialog.warning({
    title: t('app.backfillips'),
    contentStyle: { whiteSpace: 'pre-wrap' },
    content: t('app.backfillipsConfirm'),
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      d.loading = true
      const result = await backFillIps()
      if (!result || !result.isSuccess) {
        return
      }
      window.$message.success(`${t('common.operation')} ${t('common.success')}`)
      d.loading = false
    },
  })
}
