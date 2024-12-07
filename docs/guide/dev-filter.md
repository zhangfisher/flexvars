# 开发过滤器

## 创建过滤器

- **使用`FlexVars.addFilter`方法创建过滤器。**

```ts
const addFilter =flexvars.addFilter({
    name:"add",
    args:["step"],
    default:{step:1},
    next(value:any,args:Record<string,any>,context:FlexFilterContext){
        return parseInt(value)+args.step
    }
})
```

- **在构建FlexVars时传入**

```ts
const flexvars = new FlexVars({
    filters:{
        add:{
            args:["step"],
            default:{step:1},
            next(value:any,args:Record<string,any>,context:FlexFilterContext){
                return parseInt(value)+args.step
            }
        }
    }    
})
```

## 类型定义

完整的过滤器类型定义如下：

```ts
export interface FlexFilter<T extends Record<string,any> = Record<string,any>>{
    name?:string
    // 过滤器执行优先级
    // normal：普通过滤器，按照声明顺序执行
    // before： 无论该过滤器放在哪里，都会在普通过滤器之前执行
    // after：总是在最后面执行
    priority?: 'normal' | 'before' | 'after'   
    // 默认参数值
    default?:T        
    // 可选的，声明参数顺序，如果是变参的，则需要传入null
    args?: (keyof T)[] | null
    // 声明该过滤器的参数在context中的路径，支持简单的使用.的路径语法 
    configKey?: string    
    // 过滤处理函数，用来实现过滤器的具体逻辑
    next:(value:any,args:T,context:FlexFilterContext)=>string | null | undefined  
    // 当执行过滤器时出错时的处理函数, BREAK:中止后续过滤器执行, THROW:抛出异常, IGNORE:忽略继续执行后续过滤器
    onError?:FilterErrorHandler
    // 当过滤器执行返回空值时的处理函数,空值是指null,undefined 
    onEmpty?: FilterEmptyHandler
}
```

## 优先级

过滤通过`priority`参数指定执行优先级。

- `priority='before'`：代表该过滤器总是在普通过滤器之前执行。
- `priority='after'`：代表该过滤器总是在普通过滤器之后执行。
- `priority='normal'`：代表该过滤器按照声明顺序执行。


## 参数处理

- 每个过滤器均可以指定`0-N`个参数，参数的声明顺序通过`args`参数指定。比如:`args=["step","start"]`，则第一个参数为`step`，第二个参数为`start`，当使用位置传参方式时`{ value | filter(1,2)}`，使用字典传参时`{ value | filter({step:1,start:22})}`。
- 参数的默认值通过`default`参数指定
- 在`next`函数中，可以通过`args`参数获取传入的参数值,该参数值的类型为`Record<string,any>`。

## 变量上下文

处理插值变量时会生成一个对应的上下文对象。

```ts
export interface FlexVariableContext {
    name:string,                        // 插企过滤器器名称
    value:any                           // 当前变量的输入值，即通过replace(template,..args)传入的值
    template:string,                    // 当前模板字符串，即整个字符串
    match:string,                       // 当前匹配到的变量原始字符串  
    prefix:string,                      // 当前变量的前缀
    suffix:string,                      // 当前变量的后缀    
    onError?:(this:FlexVars,error:Error,value:any,args:Record<string,any>,context:FlexFilterContext)=>FilterBehaviorType | Error | string;     
    onEmpty?:(this:FlexVars,value:any,args:Record<string,any>,context:FlexFilterContext)=>FilterBehaviorType  | Error | string ;
}
```
 
## 过滤器上下文

当执行变量过滤器时，会生成一个对应的过滤器上下文对象。

过滤器上下文对象继承自变量上下文对象，同时还包含了一些额外的属性。

```ts
export interface FlexFilterContext extends FlexVariableContext{
    getConfig:()=>Record<string,any>    // 指定过滤器的配置参数
}
```

**过滤器上下文对象**作为`next`函数的最后一个参数传入，开发过滤器时可以实现一些复杂的功能。


## 可配置过滤器

有时我们需要对过滤器的行为进行配置，提供更加灵活的使用方式。

比如在开发`VoerkaI18n`时，需要开发一个`currency`过滤器，可以根据切换不同的语言来，指定货币的前缀、后缀、符号等。

`FlexVars`提供了一个可配置过滤器的功能，方法如下：

1. **指定配置数据源**

在构建`FlexVars`实例时，可以指定一个`config`参数作为配置数据源。

```ts
const flexvars = new FlexVars({
    config:{
        currency:{
            prefix:"RMB",
            sign:"￥",
            suffix:"元"            
        }
    }
})

```
2. **读取配置数据**

```ts
import { assignObject } from "flex-tools/object/assignObject"
const flexvars.addFilter({
    name:"currency",
    args:["sign","prefix","suffix"],    
    // 指定该过滤器的配置数据在config的路径
    configKey:"currency",            
    next(value:any,args:Record<string,any>,context:FlexFilterContext){
        // 获取配置数据
        const cfgs = context.getConfig() 
        // 优先使用参数值，其次使用配置值
        args = assignObject(cfgs,args)
        return `${args.prefix}${args.sign}${value}${args.suffix}`
    }
})

```

3. **切换语言**

```ts

flexvars.replace("{ value | currency}") // = RMB￥100元
flexvars.replace("{ value | currency('人民币')}",100) // =人民币￥100元
// 切换语言
flexvars.options.config.currency={
    prefix:"USD",
    sign:"$",
    suffix:""  
}
// 重新执行时，会使用新的配置数据
flexvars.replace("{ value | currency}") // $100

```
