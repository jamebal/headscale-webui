import { createAlovaInstance } from './alova'
import { serviceConfig } from '@/../service.config'
import { local } from '@/utils'
import { generateProxyPattern } from '@/../build/proxy'

const { url } = generateProxyPattern(serviceConfig[import.meta.env.MODE])

// 工厂函数，用于创建 Alova 实例
export function createRequestInstance() {
  return createAlovaInstance({
    baseURL: local.get('serverUrl') || url.value,
  })
}

export function createBlankInstance() {
  return createAlovaInstance({
    baseURL: '',
  })
}
