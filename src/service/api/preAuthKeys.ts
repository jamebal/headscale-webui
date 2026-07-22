import { getRequestInstance } from '../http/instances'
import type { User } from './user'

const request = getRequestInstance()

export interface PreAuthKeyFormData {
  user: string | null
  reusable: boolean | false
  ephemeral: boolean | false
  expiration: string | null
  aclTags: string[] | null
}

export interface PreAuthKeyData {
  id: string
  user: User
  key: string
  reusable: boolean
  ephemeral: boolean
  used: boolean
  expiration: string
  createdAt: string
  aclTags: string[]
}

export function fetchPreAuthKeyList() {
  return request.Get<Service.ResponseResult<{ preAuthKeys: PreAuthKeyData[] }>>('/api/v1/preauthkey')
}

export function createPreAuthKey(preAuthKeyData: PreAuthKeyFormData) {
  return request.Post<Service.ResponseResult<{ preAuthKey: PreAuthKeyData }>>(`/api/v1/preauthkey`, preAuthKeyData)
}

export function expirePreAuthKey(id: string) {
  return request.Post<Service.ResponseResult<Record<string, never>>>('/api/v1/preauthkey/expire', { id })
}

export function deletePreAuthKey(id: string) {
  const params = new URLSearchParams({ id })
  return request.Delete<Service.ResponseResult<Record<string, never>>>(
    `/api/v1/preauthkey?${params.toString()}`,
  )
}

export function filterPreAuthKeysByUser(keys: PreAuthKeyData[], userId: string) {
  return keys.filter(key => key.user.id === userId)
}
