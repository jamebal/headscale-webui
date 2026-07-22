import { getRequestInstance } from '../http/instances'
import type { User } from './user'
import type { PreAuthKeyData } from './preAuthKeys'

const request = getRequestInstance()

export interface FormNode {
  user: string | null
  key: string | null
}

export type RegisterMethod
  = | 'REGISTER_METHOD_UNSPECIFIED'
    | 'REGISTER_METHOD_AUTH_KEY'
    | 'REGISTER_METHOD_CLI'
    | 'REGISTER_METHOD_OIDC'

export interface NodeData {
  id: string
  machineKey: string
  nodeKey: string
  discoKey: string
  ipAddresses: string[]
  name: string
  user: User
  lastSeen: string
  expiry: string
  preAuthKey?: PreAuthKeyData
  createdAt: string
  registerMethod: RegisterMethod
  givenName: string
  online: boolean
  approvedRoutes: string[]
  availableRoutes: string[]
  subnetRoutes: string[]
  tags: string[]
}

export function fetchNodeList(user: string) {
  return request.Get<Service.ResponseResult<{ nodes: NodeData[] }>>('/api/v1/node', {
    params: new URLSearchParams({ user }).toString(),
  })
}

export function registerNode(param: FormNode) {
  const params = new URLSearchParams()
  if (param.user !== null) {
    params.set('user', param.user)
  }
  if (param.key !== null) {
    params.set('key', param.key)
  }
  return request.Post<Service.ResponseResult<{ node: NodeData }>>(`/api/v1/node/register?${params.toString()}`)
}

export function renameNode(param: { nodeId: string, newName: string }) {
  return request.Post<Service.ResponseResult<{ node: NodeData }>>(
    `/api/v1/node/${encodeURIComponent(param.nodeId)}/rename/${encodeURIComponent(param.newName)}`,
  )
}

export function deleteNode(nodeId: string) {
  return request.Delete<Service.ResponseResult<Record<string, never>>>(`/api/v1/node/${encodeURIComponent(nodeId)}`)
}

export function expireNode(nodeId: string) {
  return request.Post<Service.ResponseResult<{ node: NodeData }>>(`/api/v1/node/${encodeURIComponent(nodeId)}/expire`)
}

export function setTagsOfNode(nodeId: string, data: { tags: string[] }) {
  return request.Post<Service.ResponseResult<{ node: NodeData }>>(`/api/v1/node/${encodeURIComponent(nodeId)}/tags`, data)
}

export function setApprovedRoutes(nodeId: string, routes: string[]) {
  return request.Post<Service.ResponseResult<{ node: NodeData }>>(
    `/api/v1/node/${encodeURIComponent(nodeId)}/approve_routes`,
    { routes },
  )
}

export function backFillIps() {
  return request.Post<Service.ResponseResult<{ changes: string[] }>>('/api/v1/node/backfillips?confirmed=true')
}
