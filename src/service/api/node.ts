import { getRequestInstance } from '../http/instances'
import type { User } from './user'
import type { RouteData } from '@/service'

const request = getRequestInstance()

export interface FormNode {
  user: string | null
  key: string | null
}

export interface NodeData {
  id: string
  name: string
  user: User
  ipAddresses: Array<string>
  routes: Array<RouteData>
  online: boolean
  givenName: string
  validTags: Array<string>
  invalidTags: Array<string>
  forcedTags: Array<string>
  registerMethod: string
  createdAt: string
  preAuthKey: string
  expiry: string
  lastSeen: string
  machineKey: string
  nodeKey: string
  discoKey: string
}

export function fetchNodeList(user: string) {
  return request.Get<Service.ResponseResult<any>>(`/api/v1/node?user=${user}`)
}

export function registerNode(param: FormNode) {
  return request.Post<Service.ResponseResult<any>>(`/api/v1/node/register?user=${param.user}&key=${param.key}`)
}

export function renameNode(param: any) {
  return request.Post<Service.ResponseResult<any>>(`/api/v1/node/${param.nodeId}/rename/${param.newName}`)
}

export function deleteNode(nodeId: string) {
  return request.Delete<Service.ResponseResult<any>>(`/api/v1/node/${nodeId}`)
}

export function expireNode(nodeId: string) {
  return request.Post<Service.ResponseResult<any>>(`/api/v1/node/${nodeId}/expire`)
}

export function moveNode(user: string, nodeId: string) {
  return request.Post<Service.ResponseResult<any>>(`/api/v1/node/${nodeId}/user?user=${user}`)
}

export function setTagsOfNode(nodeId: string, data: { tags: string[] }) {
  return request.Post<Service.ResponseResult<any>>(`/api/v1/node/${nodeId}/tags`, data)
}

export function backFillIps() {
  return request.Post<Service.ResponseResult<any>>('/api/v1/node/backfillips?confirmed=true')
}
