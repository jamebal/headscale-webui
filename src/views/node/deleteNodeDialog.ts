import type { DialogApiInjection } from 'naive-ui/lib/dialog/src/DialogProvider'
import type { NodeData } from '@/service/api/node'
import { deleteNode } from '@/service/api/node'
import { useAppStore } from '@/store/app'

const appStore = useAppStore()

export function showDeleteNodeDialog(
  dialog: DialogApiInjection,
  t: (key: string) => string,
  nodeData: NodeData,
) {
  const d = dialog.warning({
    title: t('app.deleteNode'),
    content: `${t('common.delete')} ${t('app.node')}【 ${nodeData.givenName} 】, ${t('common.areYouSure')}`,
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      d.loading = true
      const result = await deleteNode(nodeData.id)
      if (!result || !result.isSuccess) {
        return
      }
      appStore.sendMessage({ event: 'refreshNodeList', data: {} })
      window.$message.success(`${t('app.deleteNode')} ${t('common.success')}`)
      d.loading = false
    },
  })
}
