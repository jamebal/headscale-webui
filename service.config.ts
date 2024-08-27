/** 不同请求服务的环境配置 */
export const serviceConfig: Record<ServiceEnvType, Record<string, string>> = {
  dev: {
    url: 'http://localhost:8080',
  },
  test: {
    url: 'http://localhost:8080',
  },
  prod: {
    url: 'http://localhost:8080',
  },
}
