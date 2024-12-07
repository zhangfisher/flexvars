# 快速开始

## 第1步. 安装


::: code-group 

```bash [pnpm]
pnpm add flexvars 
```

```bash [yarn] 
yarn add flexvars 
```


```bash [npm]
npm install flexvars
```

:::

## 第2步. 初始化库

```ts
import { FlexVars } from 'flexvars';

// 创建一个FlexVars实例
const flexvars = new FlexVars();

// Hello, FlexVars!
console.log(flexvars.replace('Hello, {name}!', { name: 'FlexVars' })) 

```

## 第3步. 使用过滤器

过滤器采用类似管道符的方式，对变量值进行链式处理。

```ts
flexvars.addFilter({
    name:"add",
    args:["suffix"],
    default:{suffix:"!"},
    next: (value,args) => {
            return value + args.suffix;
        }
});
// Hello, FlexVars!!!*
console.log(flexvars.replace("Hello, {name|add|add|add|add('*')}", { name: 'FlexVars' })) 
// Hello, FlexVars!!!*
console.log(flexvars.replace("Hello, {name|add|add|add|add({suffix:'*'})}", { name: 'FlexVars' })) 
```

- 以上创建了一个名称为`add`的过滤器，该过滤器提供了一个参数`suffix`，默认值为`!`，该过滤器的作用是在变量值后面添加`suffix`参数的值。
- 上例中连续调用了4次`add`过滤器，其中3次使用了默认参数，最后一次使用了自定义参数`'*'`,所以最后的结果为`Hello, FlexVars!!!*`。
- 过滤器本质上是一个函数，支持位置参数和字典参数，即`add("!")`和`add({suffix:"!"})`是等价的。



## 第4步. 使用前缀后缀

支持为插值变量指定前缀和后缀，前缀和后缀可以是一个或多个字符。

```ts

// Hello, (FlexVars)
console.log(flexvars.replace("Hello, {( name )}", { name: 'FlexVars' })) 

// Hello, 
console.log(flexvars.replace("Hello, {( name )}")) 
//Location: 
console.log(flexvars.replace("Location: {, module }{, function }{, line }")) 
//Location: module=x
console.log(flexvars.replace("Location: {module= module }{,func= function }{,line= line }", {module:"x"})) 
//Location: module=x,func=main
console.log(flexvars.replace("Location: {module= module }{,func= function }{,line= line }", {module:"x",function:"main"})) 
//Location: module=x,func=main,line=120
console.log(flexvars.replace("Location: {module= module }{,func= function }{,line= line }", {module:"x",function:"main",line:120})) 
```

- 当变量是空值时，前缀和后缀不会被输出。


