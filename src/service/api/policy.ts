import { getRequestInstance } from '../http/instances'

const request = getRequestInstance()

export interface Policy {
  policy: string
  updatedAt: string
}

export function fetchPolicy() {
  return request.Get<Service.ResponseResult<Policy>>('/api/v1/policy')
}

export function setPolicy(policy: string) {
  return request.Put<Service.ResponseResult<any>>('/api/v1/policy', { policy })
}
