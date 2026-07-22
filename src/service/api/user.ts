import { getRequestInstance } from '../http/instances'

const request = getRequestInstance()

export interface User {
  id: string
  name: string
  createdAt: string
  displayName?: string
  email?: string
  providerId?: string
  provider?: string
  profilePicUrl?: string
}

export interface CreateUserRequest {
  name: string
  displayName?: string
  email?: string
  pictureUrl?: string
}

export function fetchUserList() {
  return request.Get<Service.ResponseResult<{ users: User[] }>>('/api/v1/user')
}

export function createUser(data: CreateUserRequest) {
  return request.Post<Service.ResponseResult<{ user: User }>>('/api/v1/user', data)
}

export function deleteUser(id: string) {
  return request.Delete<Service.ResponseResult<Record<string, never>>>(`/api/v1/user/${encodeURIComponent(id)}`)
}

export function renameUser(id: string, newName: string) {
  return request.Post<Service.ResponseResult<{ user: User }>>(
    `/api/v1/user/${encodeURIComponent(id)}/rename/${encodeURIComponent(newName)}`,
  )
}
