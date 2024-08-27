import { getRequestInstance } from '../http/instances'

const request = getRequestInstance()

export interface User {
  id: number
  name: string
  createdAt: string
}

export function fetchUserList() {
  return request.Get<Service.ResponseResult<any>>('/api/v1/user')
}
