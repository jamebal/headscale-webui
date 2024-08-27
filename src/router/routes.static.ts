export const staticRoutes: AppRoute.RowRoute[] = [
  {
    name: 'nodes',
    path: '/node',
    title: 'nodes',
    requiresAuth: true,
    icon: 'carbon:radio-button-checked',
    componentPath: '/node/index.vue',
    id: 1,
    pid: null,
  },
  {
    name: 'apiKeys',
    path: '/apiKey',
    title: 'apiKeys',
    requiresAuth: true,
    icon: 'carbon:api-key',
    componentPath: '/apiKey/index.vue',
    id: 2,
    pid: null,
  },
]
