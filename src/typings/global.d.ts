/* 存放数据库实体表类型， 具体内容在 ./entities */
declare namespace Entity {
}

/* 各类接口返回的数据类型， 具体内容在 ./api */
declare namespace Api {

}

interface Window {
  $loadingBar: import('naive-ui').LoadingBarApi
  $dialog: import('naive-ui').DialogApi
  $message: import('naive-ui').MessageApi
  $notification: import('naive-ui').NotificationApi
}

declare const AMap: any
declare const BMap: any

declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent
  export default component
}

declare namespace NaiveUI {
  type ThemeColor = 'default' | 'error' | 'primary' | 'info' | 'success' | 'warning'
}

declare namespace Storage {
  interface Session {
    dict: DictMap
    accessToken: string
  }

  interface Local {
    /* 存储用户信息 */
    userInfo: Api.Login.Info
    serverUrl: string
    baseDomain: string
    /** @deprecated 仅用于认证存储迁移期间的旧代码兼容 */
    accessToken: string
    /** @deprecated 仅用于认证存储迁移期间的旧代码兼容 */
    refreshToken: string
    /** @deprecated 仅用于认证存储迁移期间的旧代码兼容 */
    loginAccount: {
      account: string
      pwd: string
    }
    /* 存储当前语言 */
    lang: App.lang
  }
}

declare namespace App {
  type lang = 'zhCN' | 'enUS'
}

interface DictMap {
  [key: string]: Entity.Dict[]
}
