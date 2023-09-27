import { defineConfig } from 'tsup'
import copy from "esbuild-copy-files-plugin";


export default defineConfig({
    entry: [
        'src/index.ts'
    ],
    format: ['esm','cjs'],
    dts: true,
    splitting: true,
    sourcemap: false,
    clean: true,
    treeshake:true,  
    minify: true,
    esbuildPlugins:[
        // @ts-ignore
        copy({
            source:['package.json','README.md','LICENSE'],
            target:"dist/"
        })
    ], 
    banner: {
        js: `/**
*        
*   ---=== FlexVars ===---
*   https://zhangfisher.github.com/flexvars
*    
*
*/`}
}) 