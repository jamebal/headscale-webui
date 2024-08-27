import type { TimeUnit } from 'echarts/types/src/util/time'
import { getRequestInstance } from '../http/instances'
import type { NodeData } from '@/service/api/node'

const request = getRequestInstance()

export interface RouteData {
  id: number
  node: NodeData
  prefix: string
  advertised: string
  enabled: string
  isPrimary: string
  createdAt: TimeUnit
  updatedAt: TimeUnit
  deletedAt: TimeUnit
}

export function fetchRouteList() {
  return request.Get<Service.ResponseResult<any>>('/api/v1/routes')
}
