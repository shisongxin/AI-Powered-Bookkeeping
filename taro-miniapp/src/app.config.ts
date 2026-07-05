export default {
  pages: [
    'pages/login/index',
    'pages/analysis/index',
    'pages/bills/list',
    'pages/bills/add',
    'pages/bills/detail/index',
    'pages/chat/index',
    'pages/categories/index',
    'pages/mine/index',
    'pages/register/index',
    'pages/budget/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTitleText: 'AI记账',
    navigationBarTextStyle: 'black',
    backgroundColor: '#faf7f5'
  },
  tabBar: {
    color: '#999999',
    selectedColor: '#fbbf24',
    backgroundColor: '#ffffff',
    borderStyle: 'white',
    list: [
      { pagePath: 'pages/analysis/index', text: '流水分析' },
      { pagePath: 'pages/bills/list', text: '账单明细' },
      { pagePath: 'pages/chat/index', text: 'AI记账' },
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
