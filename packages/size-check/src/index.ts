import { h, createApp } from '@vue/runtime-dom'

// 这就是所谓的基于vue的hello world

// The bare minimum code required for rendering something to the screen
createApp({
  render: () => h('div', 'hello world!')
}).mount('#app')
