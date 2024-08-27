import { createRequestInstance } from './index'

let request = createRequestInstance()

export function getRequestInstance() {
  return request
}

// 重新创建实例时的更新函数
export function recreateInstances() {
  request = createRequestInstance()
}
