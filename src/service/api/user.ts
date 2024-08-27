import type { TimeUnit } from 'echarts/types/src/util/time'
import { getRequestInstance } from '../http/instances'

const request = getRequestInstance()

export interface User {
  id: number
  name: string
  createdAt: TimeUnit
}

export function fetchUserList() {
  return request.Get<Service.ResponseResult<any>>('/api/v1/user')
}
