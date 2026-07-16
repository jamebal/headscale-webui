import { useRouteStore } from './router'
import { useTabStore } from './tab'
import { fetchLogin } from '@/service'
import { router } from '@/router'
import {
  clearSessionApiKey,
  getSessionApiKey,
  local,
  saveConnectionConfig,
  setSessionApiKey,
} from '@/utils'

interface AuthStatus {
  userInfo: Api.Login.Info | null
  token: string
}
export const useAuthStore = defineStore('auth-store', {
  state: (): AuthStatus => {
    return {
      userInfo: local.get('userInfo'),
      token: getSessionApiKey(),
    }
  },
  getters: {
    /** 是否登录 */
    isLogin(state) {
      return Boolean(state.token)
    },
  },
  actions: {
    /* 登录退出，重置用户信息等 */
    async logout() {
      const route = unref(router.currentRoute)
      // 清除本地缓存
      this.clearAuthStorage()
      // 清空路由、菜单等数据
      const routeStore = useRouteStore()
      routeStore.resetRouteStore()
      // 清空标签栏数据
      const tabStore = useTabStore()
      tabStore.clearAllTabs()
      // 重置当前存储库
      this.$reset()
      // 重定向到登录页
      if (route.meta.requiresAuth) {
        router.push({
          name: 'login',
          query: {
            redirect: route.fullPath,
          },
        })
      }
    },
    clearAuthStorage() {
      clearSessionApiKey()
      local.remove('userInfo')
      this.token = ''
      this.userInfo = null
    },

    /* 用户登录 */
    async login(serverUrl: string, baseDomain: string, apiKey?: string) {
      // 登录表单迁移完成前兼容旧的两个参数调用
      const resolvedBaseDomain = apiKey === undefined ? '' : baseDomain
      const resolvedApiKey = apiKey ?? baseDomain
      saveConnectionConfig(serverUrl, resolvedBaseDomain)
      setSessionApiKey(resolvedApiKey)
      this.token = resolvedApiKey

      try {
        const result = await fetchLogin()
        if (!result || !result.isSuccess) {
          this.clearAuthStorage()
          return
        }
        // 处理登录信息
        await this.handleLoginInfo(result.data.users[0])
      }
      catch (e) {
        this.clearAuthStorage()
        console.warn('[Login Error]:', e)
      }
    },

    /* 处理登录返回的数据 */
    async handleLoginInfo(data: Api.Login.Info) {
      local.set('userInfo', data)
      this.userInfo = data

      // 添加路由和菜单
      const routeStore = useRouteStore()
      await routeStore.initAuthRoute()

      // 进行重定向跳转
      const route = unref(router.currentRoute)
      const query = route.query as { redirect?: string }
      await router.push({
        path: query.redirect || '/',
      })
    },
  },
})
