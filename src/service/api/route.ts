import { getRequestInstance } from '../http/instances'
import type { NodeData } from '@/service/api/node'

const request = getRequestInstance()

export interface RouteData {
  id: string
  node: NodeData
  prefix: string
  advertised: boolean
  enabled: boolean
  isPrimary: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string
}

export function fetchRouteList() {
  return request.Get<Service.ResponseResult<{ routes: RouteData[] }>>('/api/v1/routes')
}

export function deleteRoute(routeId: string) {
  return request.Delete<Service.ResponseResult<any>>(`/api/v1/routes/${routeId}`)
}

export function disableRoute(routeId: string) {
  return request.Post<Service.ResponseResult<any>>(`/api/v1/routes/${routeId}/disable`)
}

export function enableRoute(routeId: string) {
  return request.Post<Service.ResponseResult<any>>(`/api/v1/routes/${routeId}/enable`)
}
