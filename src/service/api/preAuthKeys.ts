import { getRequestInstance } from '../http/instances'

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
  user: string
  key: string
  reusable: boolean
  ephemeral: boolean
  used: boolean
  expiration: string
  createdAt: string
  aclTags: string[]
}

export function fetchPreAuthKeyList(user: string) {
  return request.Get<Service.ResponseResult<{ preAuthKeys: PreAuthKeyData[] }>>(`/api/v1/preauthkey?user=${user}`)
}

export function createPreAuthKey(preAuthKeyData: PreAuthKeyFormData) {
  return request.Post<Service.ResponseResult<{ preAuthKey: PreAuthKeyData }>>(`/api/v1/preauthkey`, preAuthKeyData)
}

export function expirePreAuthKey(user: string, key: string) {
  return request.Post<Service.ResponseResult<any>>(`/api/v1/preauthkey/expire`, { user, key })
}
