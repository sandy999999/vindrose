import { mount } from 'svelte'
import App from './App.svelte'
import './lib/design/tokens.css'
import './lib/design/base.css'

const target = document.getElementById('app')

if (target) {
  mount(App, { target })
}
