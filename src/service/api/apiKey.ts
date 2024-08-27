import type { TimeUnit } from 'echarts/types/src/util/time'
import { getRequestInstance } from '../http/instances'

const request = getRequestInstance()

export interface ApiKeyData {
  id: string
  prefix: string
  expiration: TimeUnit
  createdAt: TimeUnit
  lastSeen: TimeUnit
}

export function fetchApiKeyList() {
  return request.Get<Service.ResponseResult<{ apiKeys: ApiKeyData[] }>>(`/api/v1/apikey`)
}

export function createApiKey(expiration: string) {
  return request.Post<Service.ResponseResult<{ apiKey: string }>>(`/api/v1/apikey`, { expiration })
}

export function expireApiKey(prefix: string) {
  return request.Post<Service.ResponseResult<{ apiKeys: string }>>(`/api/v1/apikey/expire`, { prefix })
}

export function deleteApiKey(prefix: string) {
  return request.Delete<Service.ResponseResult<{ apiKeys: string }>>(`/api/v1/apikey/${prefix}`)
}
