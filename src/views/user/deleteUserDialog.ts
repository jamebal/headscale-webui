import type { DialogApiInjection } from 'naive-ui/lib/dialog/src/DialogProvider'
import { useAppStore } from '@/store/app'
import { deleteUser } from '@/service'

const appStore = useAppStore()

export function showDeleteUserDialog(
  dialog: DialogApiInjection,
  t: (key: string) => string,
  username: string,
) {
  const d = dialog.warning({
    title: t('common.delete'),
    content: `${t('common.delete')} ${t('app.user')}【 ${username} 】, ${t('common.areYouSure')}`,
    positiveText: t('common.confirm'),
    negativeText: t('common.cancel'),
    onPositiveClick: async () => {
      d.loading = true
      const result = await deleteUser(username)
      if (!result || !result.isSuccess) {
        return
      }
      appStore.sendMessage({ event: 'refreshUserList', data: {} })
      window.$message.success(`${t('common.delete')} ${t('common.success')}`)
      d.loading = false
    },
  })
}
