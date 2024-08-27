import { getRequestInstance } from '../http/instances'

const request = getRequestInstance()

export interface User {
  id: number
  name: string
  createdAt: string
}

export function fetchUserList() {
  return request.Get<Service.ResponseResult<{ users: User[] }>>('/api/v1/user')
}

export function fetchUser(username: string) {
  return request.Get<Service.ResponseResult<{ user: User }>>(`/api/v1/user/${username}`)
}

export function createUser(username: string) {
  return request.Post<Service.ResponseResult<{ user: User }>>('/api/v1/user', { name: username})
}

export function deleteUser(username: string) {
  return request.Delete<Service.ResponseResult<any>>(`/api/v1/user/${username}`)
}

export function renameUser(oldName: string, newName: string) {
  return request.Post<Service.ResponseResult<any>>(`/api/v1/user/${oldName}/rename/${newName}`)
}
