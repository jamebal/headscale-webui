import { createAlova } from 'alova'
import VueHook, { type VueHookType } from 'alova/vue'
import adapterFetch from 'alova/fetch'
import { createServerTokenAuthentication } from 'alova/client'
import {
  handleResponseError,
  handleServiceResult,
} from './handle'
import {
  DEFAULT_ALOVA_OPTIONS,
} from './config'
import { local } from '@/utils'
import { router } from '@/router'

const { onAuthRequired } = createServerTokenAuthentication<VueHookType>({
  // 添加token到请求头
  assignToken: (method) => {
    method.config.headers.Authorization = `Bearer ${local.get('accessToken')}`
  },
})

async function readStreamAsText(response: Response) {
  const reader = response?.body?.getReader()
  if (!reader) {
    return ''
  }
  const decoder = new TextDecoder()
  let result = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    result += decoder.decode(value, { stream: true })
  }

  // Decode any remaining bytes
  result += decoder.decode()

  return result
}

async function toLogin() {
  local.remove('accessToken')
  local.remove('refreshToken')
  local.remove('userInfo')
  await router.push('/login')
}

// docs path of alova.js https://alova.js.org/
export function createAlovaInstance(
  alovaConfig: Service.AlovaConfig,
) {
  const _alovaConfig = { ...DEFAULT_ALOVA_OPTIONS, ...alovaConfig }
  return createAlova({

    statesHook: VueHook,
    requestAdapter: adapterFetch(),
    cacheFor: null,
    baseURL: local.get('serverUrl') || _alovaConfig.baseURL,
    timeout: _alovaConfig.timeout,

    beforeRequest: onAuthRequired((method) => {
      if (method.meta?.isFormPost) {
        method.config.headers['Content-Type'] = 'application/x-www-form-urlencoded'
        method.data = new URLSearchParams(method.data as URLSearchParams).toString()
      }
      alovaConfig.beforeRequest?.(method)
    }),
    responded: ({
      // 请求成功的拦截器
      onSuccess: async (response, method) => {
        const { status } = response
        if (status === 401) {
          await toLogin()
        }
        if (status === 200) {
          // 返回blob数据
          if (method.meta?.isBlob)
            return response.blob()
          // 返回json数据
          const apiData = await response.json()
          return handleServiceResult(apiData)
        }
        if (status === 500) {
          const res = await readStreamAsText(response)
          if (res?.toLowerCase() === 'unauthorized') {
            await toLogin()
          }
        }
        // 接口请求失败
        const errorResult = handleResponseError(response)
        return handleServiceResult(errorResult, false)
      },
      onError: (error) => {
        handleResponseError(error)
      },
      onComplete: async (_method) => {
        // 处理请求完成逻辑
      },
    }),
  })
}
