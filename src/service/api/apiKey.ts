import { getRequestInstance } from '../http/instances'

const request = getRequestInstance()

export interface ApiKeyData {
  id: string
  prefix: string
  expiration: string
  createdAt: string
  lastSeen: string
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
