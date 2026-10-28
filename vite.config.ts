import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
  plugins:[react(),VitePWA({
    registerType:'prompt',
    injectRegister:null,
    manifest:{name:'ContextOS — Personal Workspace',short_name:'ContextOS',description:'A local-first workspace for notes, projects and connected context.',start_url:'/',scope:'/',display:'standalone',background_color:'#101014',theme_color:'#f16a42',icons:[{src:'/icons/icon-192.png',sizes:'192x192',type:'image/png'},{src:'/icons/icon-512.png',sizes:'512x512',type:'image/png'}]},
    workbox:{mode:'development',globPatterns:['**/*.{js,css,html,png,svg,ico}'],navigateFallback:'/index.html',cleanupOutdatedCaches:true}
  })],
  server:{port:1420,strictPort:true},clearScreen:false
});
