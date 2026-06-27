export default {
  pages: [
    'pages/index/index',
    'pages/bills/list',
    'pages/bills/add',
    'pages/bills/detail',
    'pages/analysis/index',
    'pages/mine/index',
    'pages/login/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTitleText: 'AI记账',
    navigationBarTextStyle: 'black',
    backgroundColor: '#f5f5f5'
  },
  tabBar: {
    color: '#999999',
    selectedColor: '#07c160',
    backgroundColor: '#ffffff',
    borderStyle: 'white',
    list: [
      { pagePath: 'pages/index/index', text: '首页' },
      { pagePath: 'pages/bills/list', text: '账单' },
      { pagePath: 'pages/analysis/index', text: '分析' },
      { pagePath: 'pages/mine/index', text: '我的' }
    ]
  },
  networkTimeout: {
    request: 30000,
    connectSocket: 30000,
    uploadFile: 60000,
    downloadFile: 60000
  }
}
