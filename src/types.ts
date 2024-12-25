import type { FlexVars } from "./flexvars"; 


// 当过滤器执行出错时的处理方式
export const FilterBehaviors  = {
    Abort:Symbol('Abort'),
    Throw:Symbol('Throw'),
    Ignore:Symbol('Ignore'),
}
 
export interface FlexFilterContext {
    name     : string,                           // 过滤器器名称
    value    : any                               // 当前变量的输入值
    template : string,                           // 当前模板字符串，即整个字符串
    match    : string,                           // 当前匹配到的变量原始字符串  
    prefix   : string,                           // 当前变量的前缀
    suffix   : string,                           // 当前变量的后缀    
    onError? : (this:FlexVars,error:Error,value:any,args:Record<string,any>,context:FlexFilterContext)=>FilterBehaviorType | Error | string;     
    onEmpty? : (this:FlexVars,value:any,args:Record<string,any>,context:FlexFilterContext)=>FilterBehaviorType  | Error | string ;
    args     : any[]
} 

export type FilterBehaviorType = typeof FilterBehaviors[keyof typeof FilterBehaviors]

export type FilterErrorHandler = (this:FlexVars,error:Error,value:any,args:Record<string,any>,context:FlexFilterContext)=>FilterBehaviorType | string;     
export type FilterEmptyHandler = (this:FlexVars,value:any,args:Record<string,any>,context:FlexFilterContext)=>FilterBehaviorType | string 



export type FilexFilterErrorBehavior = 'throw' | 'ignore' | 'break' 

export interface FlexFilter<Args extends Record<string,any> = Record<string,any>>{
    name       : string
    // 过滤器执行优先级
    // normal：普通过滤器，按照声明顺序执行
    // before： 无论该过滤器放在哪里，都会在普通过滤器之前执行
    // after：总是在最后面执行
    priority?  : 'normal' | 'before' | 'after'   
    // 默认参数值
    default?   : Args | (()=>Args)     
    // 可选的，声明参数顺序，如果是变参的，则需要传入null
    args?: (keyof Args)[] | null 
    // 过滤处理函数，用来实现过滤器的具体逻辑
    next       : (value:any,args:Args,context:FlexFilterContext)=>string | null | undefined  
    // 当执行过滤器时出错时的处理函数, BREAK:中止后续过滤器执行, THROW:抛出异常, IGNORE:忽略继续执行后续过滤器
    onError?   : FilterErrorHandler
    // 当过滤器执行返回空值时的处理函数,空值是指null,undefined 
    onEmpty?   : FilterEmptyHandler
}

