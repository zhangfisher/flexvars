/**
 * 解析插值字符
 * 
 * { value | x({a:1,b:2}) | y }
 * 
 * 解析过程如下：
 * 
 * 1. 先解析出{ value | formatter | formatter(...) }形式的字符串
 * 2.  
 *
 * 处理逻辑如下：
 *
 *   以"Now is { value | date | prefix('a') | suffix('b')}"为例：
 *
 *  1. 先判断一下输入是否包括{的}字符，如果是则说明可能存在插值变量，如果没有则说明一定不存在插值变量。
 *    这样做的目的是如果确认不存在插值变量时，就不需要后续的正则表表达式匹配提取过程。
 *    这对大部份没有采用插件变量的文本能提高性能。
 *  2. forEachInterpolatedVars采用varWithPipeRegexp正则表达式，先将文本提取出<变量名称>和<过滤器器部分>，
 *    即:
 *      变量名称="value"
 *      formatters = "date | prefix('a') | suffix('b')"
 *   3. 将"formatters"使用|转换为数组 ["date","prefix('a')","suffix('b')"]
 *   4. parseFormatters依次对每一个过滤器器进行遍历解析为：
 *        [
 *          ["date",[]],
 *          ["prefix",['a']],
 *          ["suffix",['b']]
 *       ]
 *   5. 然后wrapperFormatters从scope中读取对应的过滤器器定义,将之转化为
 *      [(value,config)=>{....},(value,config)=>{....},(value,config)=>{....}]
 *      为优化性能，在从过滤器器名称转换为函数过程中会进行缓存
 *   6. 最后只需要依次执行这些过滤器化器函数即可
 *
 *
 */

 import { isPlainObject } from "flex-tools/typecheck/isPlainObject"
 import { isFunction } from "flex-tools/typecheck/isFunction"
 import { FilterInputChain, parseFilters, FlexFilter } from './filter';
import { assignObject } from 'flex-tools/object/assignObject';
import { FilterEmptyBehavior, FilterErrorBehavior, FlexVars } from "./flexvars";
import { replaceAll } from "flex-tools/string/replaceAll";
import { getByPath } from "flex-tools";

 


export enum FilterResult{
    Next = 1,           // 继续执行下一个过滤器
    Break = 2,          // 停止执行后续过滤器
    Skip = 3            // 跳过当前过滤器
}

 

 // 用来提取字符里面的插值变量参数 , 支持管道符 { var | filter | filter }
 // 支持参数： { var | filter(x,x,..) | filter } 
 // v2: 由于一些js引擎(如react-native Hermes )不支持命名捕获组而导致运行时不能使用，所以此处移除命名捕获组
 const varWithPipeRegexp =	/\{\s*(\w+)?((\s*\|\s*\w*(\(.*\)){0,1}\s*)*)\s*\}/g;
 
 
 /**
*
 *  判断是否有插值变量声明
 * 
 *  @remarks
 * 
 *  考虑到通过正则表达式进行插值的替换可能较慢
 * 因此提供一个简单方法来过滤掉那些不需要进行插值处理的字符串
 * 原理很简单，就是判断一下是否同时具有{和}字符，如果有则认为可能有插值变量，如果没有则一定没有插件变量，则就不需要进行正则匹配
 * 从而可以减少不要的正则匹配
 * 注意：当返回true时并不代码一定具有插值变量，比如说字符串"{a:1}"也会返回true，但是这种情况下是没有插值变量的。
  * @param {*} str
  * @returns {boolean}  true=可能包含插值变量
  */
export function hasInterpolation(str:string):boolean {
     return str.includes("{") && str.includes("}");
 }
 
 
 

 export type InterpolatedVarReplacer = (name:string,filters:FilterInputChain,matched:string)=>string;
 
 

 /**
  * 
  * 遍历字符中的插值变量并调用replacer函数进行替换
  *  
  * @remarks
  * 
  * 遍历str中的所有插值变量传递给callback，将callback返回的结果替换到str中对应的位置
  * 
  * @param {*} str
  * @param {Function(<变量名称>,[filters],match[0])} callback
  * @param {Object} {
  *     replaceAll:   是否替换所有插值变量，当使用命名插值时应置为true，当使用位置插值时应置为false
  * }
  * @returns  返回替换后的字符串
  */
export function forEachInterpolatedVars(str:string, replacer:InterpolatedVarReplacer, options = {}) {
     let newStr = str, matched;
     let opts = Object.assign({replaceAll: true },options);
     varWithPipeRegexp.lastIndex = 0;
     while ((matched = varWithPipeRegexp.exec(newStr)) !== null) {
         // 这对于避免零宽度匹配的无限循环是必要的
         if (matched.index === varWithPipeRegexp.lastIndex) {
             varWithPipeRegexp.lastIndex++;
         }        
         const varname = matched[1] || "";
         let oldLen:number = newStr.length     // 记一下长度
         // 解析过滤器器和参数 = [<formatterName>,[<formatterName>,[<arg>,<arg>,...]]]
         const filters = parseFilters(matched[2] || "");
         if (isFunction(replacer)) {
             try {
                 const finalValue = replacer(varname, filters, matched[0]);
                 if (opts.replaceAll) {
                     newStr = replaceAll(newStr,matched[0], finalValue);
                 } else {
                     newStr = newStr.replace(matched[0], finalValue);
                 }
             } catch(e:any) {	
                throw e			
             }
             // 由于执行替换可能导致字符串发生变化，必须调整匹配位置，否则可能导致错误或无限循环
             varWithPipeRegexp.lastIndex+=newStr.length-oldLen
         }
         
     }
     return newStr;
 }
 
 /**
  * 当前插值变量过滤器的上下文对象，用来传递给过滤器函数
  */
export interface FlexVariableContext {
    name:string,                        // 插企过滤器器名称
    value:any                           // 当前变量的输入值
    template:string,                    // 当前模板字符串，即整个字符串
    match:string,                       // 当前匹配到的变量原始字符串      
    onError?:(this:FlexVars,error:Error,value:any,args:Record<string,any>,context:FlexFilterContext)=>FilterErrorBehavior | string;     
    onEmpty?:(this:FlexVars,value:any,args:Record<string,any>,context:FlexFilterContext)=>FilterEmptyBehavior | string | Error;
}

export interface FlexFilterContext extends FlexVariableContext{
    getConfig:()=>Record<string,any>    // 指定过滤器的配置参数
}

export class ThrowFilterError extends Error{ } 
// 用来传递给过滤器函数的参数
export class ReturnValueFilterError extends Error{     
    constructor(public value?:any) {
        super()
    }
} 
export class AbortFilterError extends ReturnValueFilterError{}
export class IgnoreFilterError extends ReturnValueFilterError{}


 /**
  * 执行过滤器器并返回结果
  *
  * 过滤器器this指向当前scope，并且最后一个参数是当前scope过滤器器的$config
  *
  * 这样过滤器器可以读取$config
  *
  * @param {*} value
  * @param {FilterInputChain} filters  经过解析过的过滤器器参数链 ，多个过滤器器函数(经过包装过的)顺序执行，前一个输出作为下一个过滤器器的输入
  *  formatters [ [<过滤器器名称>,[<参数>,<参数>,...],[<过滤器器名称>,[<参数>,<参数>,...]],...]\
  * @param {{value,name,template,match}}   
  * 
  */ 
export function executeFilters(this:FlexVars, filterDefines:FilterInputChain[], context:FlexVariableContext) {
     if (filterDefines.length === 0) return context.value;
     // 1. 返回过滤器函数数组处理器
     const filterHandlers = getFilterHandlers.call(this,filterDefines,context)          
     let value = context.value
     // 2. 分别执行过滤器器函数
     for (let filter of filterHandlers) {
        try{
            value = filter.call(this,value);		 
        }catch(e:any){
            if(e instanceof AbortFilterError){
                if(e.value!=null) value = e.value
                break
            }else if(e instanceof IgnoreFilterError){
                if(e.value!=null) value = e.value
            }else{
                throw e
            }
        }        
     }
     return value;
 }


/**
 * 
 * 当过滤器返回空值时的处理行为
 * 
 * @remarks 
 */
 function executeEmptyHandler(this:FlexVars,value:any,args:any[],filter:FlexFilter,context:FlexFilterContext){
    const emptyHandler = context.onEmpty || filter.onEmpty || this.options.onEmpty
    if(typeof(emptyHandler)!="function") return value
    return emptyHandler.call(this,value,args,context) 
}
 /**
  *  当执行过滤器器出错时的处理行为
  * 
  *  @remarks
  * 
  *     默认会忽略错误，继续执行后续的过滤器器
  * 
  * @param this 
  * @param value 
  * @param args 
  * @param context 
  */
function executeErrorHandler(this:FlexVars,error:Error,value:any,args:any[],filter:FlexFilter,context:FlexFilterContext){
    const errorHandler =context.onError || filter.onError || this.options.onError
    if(typeof(errorHandler)!="function") return value
    return  errorHandler.call(this,error,value,args,context)             
}


/**
 * 
 * 包括过滤器函数
 * 
 * @param name      过滤器名称 
 * @param args      传入的参数
 * @param nex    过滤器处理函数
 */
function wrapperFilter(this:FlexVars,filter:FlexFilter,args:any[], context:FlexVariableContext){
    
    // 1. 处理参数
    let finalArgs:Record<string,any> =Object.assign({},filter.default)    
    if(args.length==1 && isPlainObject(args[0])){   // 采用字典传参数方式
        assignObject(finalArgs,args[0])
    }else{// 位置传参数方式
        // 根据args中声明的参数名称顺序依次存入
        if(filter.args && filter.args?.length>0){
            filter.args.forEach((argName:string,index:number)=>{
                if(args[index]!==undefined) finalArgs[argName] = args[index]
            })
        }
    }
    // 
    return (value:any)=>{
        let result:any 
        // 同一个变量的过滤器器共享同一个上下文，除了getConfig不一样外
        let filterContext = Object.assign(context,{
            getConfig:()=>filter.configKey ? getByPath(this.options.config,filter.configKey) : this.options.config
        }) as FlexFilterContext
        try{
            // 如果输入值为空，则执行空值处理函数
            if(this.options.isEmpty(value)){
                result = executeEmptyHandler.call(this,value,finalArgs,filter,filterContext)
            }
            // 执行过滤器
            result = filter.next.call(this,value,finalArgs,filterContext)
        }catch(e:any){
            e.filter = filter.name;            
            this.log(`当执行过滤器器<${context.match}:${filter.name}>时出错:${e.stack}`)
            return executeErrorHandler.call(this,e,value,finalArgs,filter,filterContext)
        }
        return result
    }
}

/**
 * 对过滤器进行排序
 * 
 * @remarks
 * 
 *   1. 优先级为before的过滤器排在前面
 *   2. 优先级为after的过滤器排在后面
 *   3. 优先级为normal的过滤器排在中间
 * 
 * @param this 
 * @param filterDefines 
 * @returns 
 */
function getSortedFilters(this:FlexVars,filterDefines:FilterInputChain) : ([FlexFilter,any[]])[]  {
    type FilterInfos = ([FlexFilter,string[]])[] 
    const afterFilters:FilterInfos = []
    let filters =filterDefines.map(([name,args])=>[this.getFilter(name),args])// 找出有效的过滤器
    .filter(([filter])=>filter!= null) as FilterInfos    
    // 过滤无效的过滤器
    filters = filters.reduce<FilterInfos>((prev:FilterInfos,[filter,args])=>{            // 处理优先级排序
        if(filter){
            if(filter.priority=='before'){
                prev.unshift([filter,args])
            }else if(filter.priority=='after'){
                afterFilters.push([filter,args])
            }else{
                prev.push([filter,args])
            }
        }
        return prev
    },[])  
    return filters.concat(afterFilters)  
}
 
 /**
  * 
  *   包装过滤器包装为函数数组
  * 
  * @remarks
  *
  *  经parseFilters解析t('{}')中的插值表达式中的过滤器器后会得到
  *  [[<过滤器器名称>,[参数,参数,...]]，[<过滤器器名称>,[参数,参数,...]]]数组
  *
  *  本函数将之传换为转化为调用函数链，形式如下：
  *  [(v)=>{...},(v)=>{...},(v)=>{...}]
  *
  *  并且会自动将当前激活语言的过滤器器配置作为最后一个参数配置传入,这样过滤器器函数就可以读取其配置参数
  *
  * @param {*} scope
  * @param {*} activeLanguage
  * @param {*} filterDefines
  * @returns {Array}   [(v)=>{...},(v)=>{...},(v)=>{...}]
  *
  */
 function getFilterHandlers(this:FlexVars,filterDefines:FilterInputChain,context:FlexVariableContext) {
    
    const filters:([FlexFilter,any[]])[] = getSortedFilters.call(this,filterDefines)
    const filderHandlers:any[]=[]  
    for (let [filter,args] of filters){
        filderHandlers.push(wrapperFilter.call(this,filter,args,context))    
    }

    return filderHandlers;
 }
  
 



//  function executeErrorHandler(this:FlexVars,error:Error,value:any,args:any[],filter:FlexFilter,context:FlexFilterContext){
//     const errorHandler =context.onError || filter.onError || this.options.onError
//     if(typeof(errorHandler)!="function") return value
//     try{
//         let r =  errorHandler.call(this,error,value,args,context)             
//         if(r==FilterErrorBehavior.Ignore){
//             return value        // 返回上一次的结果，相当于本次过滤器没有执行
//         }else if(r==FilterErrorBehavior.Throw){
//             throw new ThrowFilterError()      
//         }else if(r==FilterErrorBehavior.Abort){ // 中断后续所有过滤器的执行
//             throw new AbortFilterError()
//         }else if(r instanceof Error){ // 返回空字符串
//             throw r
//         }else{ // 返回值时
//             throw new ReturnValueFilterError(r)
//         }
//     }catch(e:any){
//         if(e instanceof ThrowFilterError){
//             throw error        
//         }else if( e instanceof AbortFilterError){
//             throw e
//         }else{
//             this.log(`执行过滤器<{${filter.name}(${value})}>错误处理函数时时出错: ${e.stack}`)
//             throw e
//         }   
//     }     
// }