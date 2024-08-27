import { ERROR_NO_TIP_STATUS, ERROR_STATUS } from './config'

type ErrorStatus = keyof typeof ERROR_STATUS

/**
 * @description: 处理请求成功，但返回后端服务器报错
 * @param {Response} response
 * @return {*}
 */
export async function handleResponseError(response: Response) {
  const error: Service.RequestError = {
    errorType: 'Response Error',
    code: 0,
    message: ERROR_STATUS.default,
    data: null,
  }
  const apiResponse: { message: string } = await response.json()
  const errorCode: ErrorStatus = response.status as ErrorStatus
  const message = apiResponse.message || ERROR_STATUS.default
  Object.assign(error, { code: errorCode, message })

  showError(error)

  return error
}

/**
 * @description: 统一成功和失败返回类型
 * @param {any} data
 * @param {boolean} isSuccess
 * @return {*} result
 */
export function handleServiceResult(data: any, isSuccess: boolean = true) {
  return {
    isSuccess,
    errorType: null,
    data,
  }
}

export function showError(error: Service.RequestError) {
  // 如果error不需要提示,则跳过
  const code = Number(error.code)
  if (ERROR_NO_TIP_STATUS.includes(code))
    return

  window.$message.error(error.message)
}
