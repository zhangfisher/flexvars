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
export interface FlexFilter<Args extends Record<string,any> = Record<string,any>,Context=FlexVars>{
    name?      : string
    // 过滤器执行优先级
    // normal：普通过滤器，按照声明顺序执行
    // before： 无论该过滤器放在哪里，都会在普通过滤器之前执行
    // after：总是在最后面执行
    priority?  : 'normal' | 'before' | 'after'   
    // 默认参数值
    default?   : Args | (()=>Args)     
    // 可选的，声明参数顺序，如果是变参的，则需要传入null
    args?      : (keyof Args)[] | null 
    // 过滤处理函数，用来实现过滤器的具体逻辑
    next       : (this:Context,value:string,args:Args,context:FlexFilterContext)=>string | null | undefined  
    // 当执行过滤器时出错时的处理函数, BREAK:中止后续过滤器执行, THROW:抛出异常, IGNORE:忽略继续执行后续过滤器
    onError?   : FilterErrorHandler
    // 当过滤器执行返回空值时的处理函数,空值是指null,undefined 
    onEmpty?   : FilterEmptyHandler
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


 
## 过滤器上下文

过滤器`next`函数的`this`参数指向`FlexVars`实例对象。
 
 
 ## 变量上下文

处理插值变量时会生成一个对应的上下文对象。

```ts
type FlexFilterVariableContext<Context extends Dict = Dict> = {
    name     : string,                           // 过滤器器名称
    value    : any                               // 当前变量的输入值
    template : string,                           // 当前模板字符串，即整个字符串
    match    : string,                           // 当前匹配到的变量原始字符串  
    prefix   : string,                           // 当前变量的前缀
    suffix   : string,                           // 当前变量的后缀    
    onError?: (this: FlexVars, error: Error, value: any, args: Dict, context: FlexFilterVariableContext<Context>) => FilterBehaviorType | Error | string;
    onEmpty?: (this: FlexVars, value: any, args: Dict, context: FlexFilterVariableContext<Context>) => FilterBehaviorType | Error | string;
    args     : any[]
} &  Context
```

