import type { DialogApiInjection } from 'naive-ui/lib/dialog/src/DialogProvider'
import { useAppStore } from '@/store/app'
import {deleteRoute} from "@/service";

const appStore = useAppStore()

export function showDeleteRouteDialog(
  dialog: DialogApiInjection,
  t: (key: string) => string,
  routeId: string,
  prefix: string,
) {
  const d = dialog.warning({
    title: t('common.delete'),
    content: `${t('common.delete')} ${t('app.route')}【 ${prefix} 】, ${t('common.areYouSure')}`,
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      d.loading = true
      const result = await deleteRoute(routeId)
      if (!result || !result.isSuccess) {
        return
      }
      appStore.sendMessage({ event: 'refreshRouteList', data: {} })
      window.$message.success(`${t('common.delete')} ${t('common.success')}`)
      d.loading = false
    },
  })
}
