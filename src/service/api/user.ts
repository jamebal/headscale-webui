import { getRequestInstance } from '../http/instances'

const request = getRequestInstance()

export interface User {
  id: string
  name: string
  createdAt: string
}

export function fetchUserList() {
  return request.Get<Service.ResponseResult<{ users: User[] }>>('/api/v1/user')
}

export function createUser(username: string) {
  return request.Post<Service.ResponseResult<{ user: User }>>('/api/v1/user', { name: username })
}

export function deleteUser(id: string) {
  return request.Delete<Service.ResponseResult<any>>(`/api/v1/user/${id}`)
}

export function renameUser(id: string, newName: string) {
  return request.Post<Service.ResponseResult<any>>(`/api/v1/user/${id}/rename/${newName}`)
}
