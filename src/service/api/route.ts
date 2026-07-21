import type { NodeData } from '@/service/api/node'

export interface RouteData {
  key: string
  node: NodeData
  prefix: string
  approved: boolean
  exitRoute: boolean
}

export function deriveRoutes(nodes: NodeData[]): RouteData[] {
  return nodes.flatMap(node => node.availableRoutes.map(prefix => ({
    key: `${node.id}:${prefix}`,
    node,
    prefix,
    approved: node.approvedRoutes.includes(prefix),
    exitRoute: prefix === '0.0.0.0/0' || prefix === '::/0',
  })))
}

export function buildApprovedRoutes(
  node: NodeData,
  prefix: string,
  approved: boolean,
): string[] {
  const routes = new Set(node.approvedRoutes)
  if (approved) {
    routes.add(prefix)
  }
  else {
    routes.delete(prefix)
  }
  return [...routes]
}
