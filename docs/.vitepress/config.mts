import path from 'path';
import { defineConfig } from 'vitepress'   

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "FlexVars",
  description: "字符串插值处理工具库",
  base: '/flexvars/', 
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    outline: {
      label: "目录",
      level: [2, 5]
    },
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: '首页', link: '/' },
      { text: '指南', link: '/intro/about' }, 
      { text: '开源推荐', link: 'https://zhangfisher.github.io/repos/' },
    ],
    sidebar: [
        {
          text: '开始',          
          collapsed: false,
          items: [
            { text: '关于', link: '/intro/about' },
            { text: '安装', link: '/intro/install' },
            { text: '快速入门', link: '/intro/get-started' },
            { text: '更新历史', link: '/history' } 
          ]
        },
        {
          text: '指南',          
          collapsed: false,
          items: [
            { text: '插值替换', link: '/guide/replace' },
            { text: '插值语法', link: '/guide/syntax' },
            { text: '过滤器', link: '/guide/filter' },
            { text: '错误处理', link: '/guide/error' },
            { text: '空值处理', link: '/guide/empty' } ,
            { text: '前缀和后缀', link: '/guide/prefix-suffix' } ,
            { text: '开发过滤器', link: '/guide/dev-filter' } 

          ]
        } 
      ], 
    socialLinks: [
      { icon: 'github', link: 'https://github.com/zhangfisher/flexvars/' }
    ]
  }, 
  vue: {
    template: {
      compilerOptions: {
        whitespace: 'preserve'
      }
    }
  } 
})
