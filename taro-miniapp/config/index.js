const path = require('path')

const config = {
  projectName: 'ai-bookkeeping-miniapp',
  date: '2026-06-27',
  designWidth: 750,
  deviceRatio: {
    640: 1.17,
    750: 1,
    828: 0.905
  },
  sourceRoot: 'src',
  outputRoot: 'dist',
  plugins: [
    '@tarojs/plugin-framework-react',
    '@tarojs/plugin-platform-weapp'
  ],
  defineConstants: {},
  copy: {
    patterns: [],
    options: {}
  },
  framework: 'react',
  compiler: 'webpack5',
  mini: {
    postcss: {
      pxtransform: {
        enable: true,
        config: {}
      },
      url: {
        enable: true,
        config: {
          limit: 1024
        }
      },
      cssModules: {
        enable: false,
        config: {
          namingPattern: 'module',
          generateScopedName: '[name]__[local]___[hash:base64:5]'
        }
      }
    }
  },
  h5: {
    publicPath: '/',
    staticDirectory: 'static',
    postcss: {
      autoprefixer: {
        enable: true,
        config: {}
      },
      cssModules: {
        enable: false,
        config: {
          namingPattern: 'module',
          generateScopedName: '[name]__[local]___[hash:base64:5]'
        }
      }
    }
  },
  alias: {
    '@': path.resolve(__dirname, '..', 'src')
  },
  webpackChain(chain) {
    chain.resolve.extensions
      .add('.css')
      .add('.wxss')
      .add('.scss')
      .add('.less')

    // Configure babel-loader with TypeScript and React presets
    const babelLoader = chain.module.rule('script').use('babelLoader')
    babelLoader.tap((options) => {
      return {
        ...options,
        presets: [
          ['@babel/preset-typescript', { isTSX: true, allExtensions: true }],
          ['@babel/preset-react', { runtime: 'automatic' }]
        ]
      }
    })
  }
}

module.exports = function (merge) {
  if (process.env.NODE_ENV === 'development') {
    return merge({}, config, require('./dev'))
  }
  return merge({}, config, require('./prod'))
}

