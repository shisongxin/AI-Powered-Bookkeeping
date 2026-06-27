import { useDidShow } from '@tarojs/taro'
import './app.css'

function App(props) {
  useDidShow(() => {
    console.log('App launched')
  })
  return props.children
}

export default App
