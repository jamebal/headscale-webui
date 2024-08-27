import { mapEntries } from 'radash';
export function generateProxyPattern(envConfig) {
    return mapEntries(envConfig, (key, value) => {
        return [
            key,
            {
                value,
                proxy: `/proxy-${key}`,
            },
        ];
    });
}
/**
 * @description: 生成vite代理字段
 * @param {*} envConfig - 环境变量配置
 */
export function createViteProxy(envConfig) {
    const proxyMap = generateProxyPattern(envConfig);
    return mapEntries(proxyMap, (key, value) => {
        return [
            value.proxy,
            {
                target: value.value,
                changeOrigin: true,
                rewrite: (path) => path.replace(new RegExp(`^${value.proxy}`), ''),
            },
        ];
    });
}
