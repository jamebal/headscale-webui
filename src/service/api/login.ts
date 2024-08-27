import { getRequestInstance, recreateInstances } from '../http/instances'

export function fetchLogin() {
  recreateInstances()
  const request = getRequestInstance()
  return request.Get<Service.ResponseResult<any>>('/api/v1/user')
}
