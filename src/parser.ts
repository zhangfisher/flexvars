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
 import { FilterDefineChain, parseFilters, FlexFilter,  FilexFilterErrorBehavior } from './filter';
import { assignObject } from 'flex-tools/object/assignObject';
import type { FlexVars } from "./flexvars";
import { replaceAll } from "flex-tools/string/replaceAll";

 


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
 
 
 
 export type InterpolatedVarReplacer = (varname:string,filters:FilterDefineChain,matched:string)=>string;
 // [<formatterName>,[<formatterName>,[<arg>,<arg>,...]]]
 export type VarFilters = [string,[string,any[]]];
 
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
             } catch {				
                 break;// callback函数可能会抛出异常，如果抛出异常，则中断匹配过程
             }
             // 由于执行替换可能导致字符串发生变化，必须调整匹配位置，否则可能导致错误或无限循环
             varWithPipeRegexp.lastIndex+=newStr.length-oldLen
         }
         
     }
     return newStr;
 }
 
   
 /**
  * 执行过滤器器并返回结果
  *
  * 过滤器器this指向当前scope，并且最后一个参数是当前scope过滤器器的$config
  *
  * 这样过滤器器可以读取$config
  *
  * @param {*} value
  * @param {FilterDefineChain} filters  经过解析过的过滤器器参数链 ，多个过滤器器函数(经过包装过的)顺序执行，前一个输出作为下一个过滤器器的输入
  *  formatters [ [<过滤器器名称>,[<参数>,<参数>,...],[<过滤器器名称>,[<参数>,<参数>,...]],...]
  */
export function executeFilter(this:FlexVars, filterDefines:FilterDefineChain[], value:any, template:string) {
     if (filterDefines.length === 0) return value;
     const filterFuncs = wrapperFilters.call(this,filterDefines) as FilterFuncs[];
     let result = value;
     // 3. 分别执行过滤器器函数
     for (let filter of filterFuncs) {
         try {
             result = filter.call(this,result);		
         } catch (e:any) {           
             e.filter = filter.name;
             this.log(`当执行过滤器器<${(filter as any).$name}>时出错: ${template},${e.stack}`)
         }
     }
     return result;
 }


 type FilterFuncs = (this:FlexVars,value:string)=>string;

 
 
 /**
  * 
  *   包装过滤器器包装为函数数组
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
  * @param {*} filters
  * @returns {Array}   [(v)=>{...},(v)=>{...},(v)=>{...}]
  *
  */
 function wrapperFilters(this:FlexVars,filters:FilterDefineChain) {
     let wrappedFilters:FilterFuncs[] = [];
     // 依次遍历过滤器器链中的过滤器器名称和参数，将其包装为函数
     // 添加全局预设的过滤器，前面的过滤器器优先级高于后面的过滤器器
    Object.entries(this.beforeFilters).forEach(([name,filter])=>{
        wrappedFilters.push((value:string) =>(filter as Function).call(this,value,undefined,this.context))
    })
    for (let [name, args] of filters) {
         let filter =this.getFilter(name) 
         let wrapperedfilter;		
         if (isFunction(filter)) {
             wrapperedfilter = (value:string) =>{
                 return (filter as Function).call(this, value, args,this.context)
             }
         } else {
             // 过滤器器无效或者没有定义时，查看当前值是否具有同名的原型方法，如果有则执行调用
             // 比如padStart过滤器是String的原型方法，不需要配置就可以直接作为过滤器器调用
             wrapperedfilter = (value:any) => {
                 if (isFunction(value[name])) {
                     return String(value[name](...args));
                 } else {
                     return value
                 }
             };
         };  
        // 为过滤器器函数添加一个name属性，用来标识当前过滤器器的名称
        (wrapperedfilter as any).name = filter?.name || name;
        wrappedFilters.push(wrapperedfilter);
     }
     Object.entries(this.afterFilters).forEach(([name,filter])=>{
        wrappedFilters.push((value:string) =>(filter as Function).call(this,value,undefined,this.context))
    })
     return wrappedFilters;
 }
  
 
 /**
  * 
   * 对字符串进行插值替换，
   * 
   * @remarks
   *    replaceInterpolatedVars("<模板字符串>",{变量名称:变量值,变量名称:变量值,...})
   *    replaceInterpolatedVars("<模板字符串>",[变量值,变量值,...])
   *    replaceInterpolatedVars("<模板字符串>",变量值,变量值,...])
   * 
  - 当只有两个参数并且第2个参数是{}时，将第2个参数视为命名变量的字典
      replaceInterpolatedVars("this is {a}+{b},{a:1,b:2}) --> this is 1+2
  - 当只有两个参数并且第2个参数是[]时，将第2个参数视为位置参数
      replaceInterpolatedVars"this is {}+{}",[1,2]) --> this is 1+2
  - 普通位置参数替换
      replaceInterpolatedVars("this is {a}+{b}",1,2) --> this is 1+2
  - 
  this == scope == { formatters: {}, ... }



  * @param {*} template 
  * @returns 
  */
//  export function replaceInterpolatedVars(this:FlexVars,template:string, ...args:any[]) {

//     if(typeof(this.log)!=="function"){
//         this.log = console.log
//     }

//     // 没有变量插值则的返回原字符串
//     if (args.length === 0 || !hasInterpolation(template)) return template;
 
//     // ****************************变量插值****************************
//     if (args.length === 1 && isPlainObject(args[0])) {
//          // 读取模板字符串中的插值变量列表
//          // [[var1,[filter,filter,...],match],[var2,[filter,filter,...],match],...}
//          let varValues = args[0];
//          return forEachInterpolatedVars(template,(varname:string, filters, match) => {
//                  let value = varname in varValues ? varValues[varname] : "";
//                  return executeFilter.call(this,filters,value,template);
//              }
//          );
//      } else {
//         // ****************************位置插值****************************
//         // 如果只有一个Array参数，则认为是位置变量列表，进行展开
//         const params =args.length === 1 && Array.isArray(args[0]) ? [...args[0]] : args;
//         //if (params.length === 0) return template; // 没有变量则不需要进行插值处理，返回原字符串
//         let i = 0;
//         return forEachInterpolatedVars(template,(varname:string, formatters, match) => {
//                  return executeFilter.call(this,formatters,params.length > i ? params[i++] : undefined,template);
//              },
//              { replaceAll: false }
//         );
//     }     
//  } 
  