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
import { assignObject } from 'flex-tools/object/assignObject';
import { type FlexVars  } from "./flexvars";
import { replaceAll } from "flex-tools/string/replaceAll";
import { FlexFilterAbortError, FlexFilterIgnoreError,FlexFilterEmptyError, FlexFilterError } from "./errors";
import { escapeRegexpStr } from "./utils"
import { isNumber } from "flex-tools/typecheck/isNumber"
import { safeParseJson } from "flex-tools/object/safeParseJson"
import { addTagHelperFlags, removeTagHelperFlags } from "./tagHelper"
import { FilterBehaviors,  FlexFilter, FlexFilterContext } from "./types";


/**
 * 
使用正则表达式对原始文本内容进行解析匹配后得到的方便处理的数组

@remarks

例如：filters="| aaa(1,1) | bbb "

统一解析为

[
    [aaa,[1,1]],         // [<过滤器名称>,[args,...]]
    [<过滤器名称>,[<参数>,<参数>,...]]
]

filters="| aaa(1,1,"dddd") | bbb "

特别注意：
- 目前对参数采用简单的split(",")来解析，因此如果参数中包括了逗号等会影响解析的字符时，可能导致错误
例如aaa(1,1,"dd,,dd")形式的参数
在此场景下基本够用了，如果需要支持更复杂的参数解析，可以后续考虑使用正则表达式来解析
- 如果参数是{},[]，则尝试解决为对象和数组，但是里面的内容无法支持复杂和嵌套数据类型

@param {String} filters  

@returns  [ [<过滤器名称>,[<参数>,<参数>,...],[<过滤器名称>,[<参数>,<参数>,...]],...]
*/
export type FilterInputChain = ([string, string[]])[]
export function parseFilters(filtersStr: string): FilterInputChain {
    if (!filtersStr) return [];
    // 1. 先解析为 ["aaa()","bbb"]形式
    let result = filtersStr.trim().substring(1).trim().split("|").map((r) => r.trim());
    // 2. 解析过滤器参数
    return result.map((filter: string) => {
        if (filter == "") return null;
        let firstIndex = filter.indexOf("(");
        let lastIndex = filter.lastIndexOf(")");
        if (firstIndex !== -1 && lastIndex !== -1) { //参数的过滤器   
            // 带参数的过滤器: 取括号中的参数字符串部分
            const strParams = filter.substring(firstIndex + 1, lastIndex).trim();
            // 解析出过滤器的参数数组
            let params = parseFilterParams(strParams);
            // 返回[<过滤器名称>,[<参数>,<参数>,...]
            return [filter.substring(0, firstIndex), params];
        } else { // 不带参数的过滤器               
            return [filter, []];
        }
    }).filter((filter) => Array.isArray(filter)) as FilterInputChain
}

/**
 * 生成可以解析指定标签的正则表达式
 * 
 * @remarks
 * 
 * getNestingParamsRegex()     -- 能解析{}和[]
 * getNestingParamsRegex(["<b>","</b>"]),
 * 
 * @param  {...any} tags 
 * @returns 
 */
function getNestingParamsRegex(...tags: ([string, string])[]) {
    if (tags.length == 0) {
        tags.push(["{", "}"])
        tags.push(["[", "]"])
    }
    const tagsRegexs = tags.map(([beginTag, endTag]) => {
        return `(${escapeRegexpStr(beginTag)}1%.*?%1${escapeRegexpStr(endTag)})`
    })
    return filterNestingParamsRegex.replace("__TAG_REGEXP__", tagsRegexs.length > 0 ? tagsRegexs.join("|") + "|" : "")
}


// 提取匹配("a",1,2,'b',{..},[...]),不足：当{}嵌套时无法有效匹配
//  const filterParamsRegex = /((([\'\"])(.*?)\3)|(\{.*?\})|(\[.*?\])|([\d]+\.?[\d]?)|((true|false|null)(?=[,\b\s]))|([\w\.]+)|((?<=,)\s*(?=,)))(?<=\s*[,\)]?\s*)/g;

// 支持解析嵌套的{}和[]参数， 前提是：字符串需要经addTagHelperFlags操作后，会在{}[]等位置添加辅助字符
// 解析嵌套的{}和[]参数基本原理：在{}[]等位置添加辅助字符，然后使用正则表达式匹配，匹配到的字符串中包含辅助字符，然后再去除辅助字符
const filterNestingParamsRegex = String.raw`((([\'\"])(.*?)\3))|__TAG_REGEXP__([\d]+\.?[\d]?)|((true|false|null)(?=[,\b\s]))|([\w\.]+)|((?<=,)\s*(?=,))(?<=\s*[,\)]?\s*)`

/**
 * 解析过滤器的参数
 * 
 * @remarks
 * 
 *  采用正则表达式解析
 *  支持number,boolean,null,String,{},[]的参数，可以识别嵌套的{}和[]
 *  
 * @param {*} strParams    过滤器参数字符串，即filter(<...参数....>)括号里面的参数，使用,分割 
 * @returns {Array}  返回参数值数组 []
 */
function parseFilterParams(strParams: string): any[] {
    let params:any[] = [];
    let matched;
    // 1. 预处理： 处理{}和[]嵌套问题,增加嵌套标识
    strParams = addTagHelperFlags(strParams)
    try {
        let regex = new RegExp(getNestingParamsRegex(), "g")
        while ((matched = regex.exec(strParams)) !== null) {
            // 这对于避免零宽度匹配的无限循环是必要的
            if (matched.index === regex.lastIndex) {
                regex.lastIndex++;
            }
            let value: any = matched[0]
            if (value.trim() == '') {
                value = undefined
            } else if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
                value = value.substring(1, value.length - 1)
                value = removeTagHelperFlags(value)
            } else if ((value.startsWith("{") && value.endsWith("}")) || (value.startsWith('[') && value.endsWith(']'))) {
                try {
                    value = removeTagHelperFlags(value)
                    value = safeParseJson(value)
                } catch { }
            } else if (["true", "false", "null"].includes(value)) {
                value = JSON.parse(value)
            } else if (isNumber(value)) {
                value = parseFloat(value)
            } else {
                value = removeTagHelperFlags(String(value))
            }
            params.push(value)
        }
    } catch { }
    return params
}

 
 

 // 用来提取字符里面的插值变量参数 , 支持管道符 { var | filter | filter }
 // 支持参数： { var | filter(x,x,..) | filter } 
 // v2: 由于一些js引擎(如react-native Hermes )不支持命名捕获组而导致运行时不能使用，所以此处移除命名捕获组
//  const varWithPipeRegexp =	/\{\s*(\w+)?((\s*\|\s*\w*(\(.*\)){0,1}\s*)*)\s*\}/g;

 // v3: 增加否定前置断言，用来过滤掉转义字符\{和\}，从而避免转义字符\{和\}被当成插值变量的问题
 //    匹配前后缀字符，用来提取前后缀字符
 // const varWithPipeRegexp =	/(?<!\\)\{(,\s*)?\s*(\w+)?((\s*\|\s*\w*(\(.*\)){0,1}\s*)*)\s*(\s*,)?\}/g;
 const varWithPipeRegexp =	/(?<!\\)\{([\S]+\s)?\s*(\w+)?((\s*\|\s*\w*(\(.*?\)){0,1}\s*)*)\s*(\s[\S]+)?\}/gm;

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
export function forEachInterpolatedVars(this:FlexVars, str:string, replacer: (name:string,prefix:string,suffix:string,filters:FilterInputChain,matched:string)=>string, options = {}) {
     let newStr = str, matched;
     let opts = Object.assign({replaceAll: true },options);

     const regex =varWithPipeRegexp

     regex.lastIndex = 0;
     while ((matched = regex.exec(newStr)) !== null) {
         // 这对于避免零宽度匹配的无限循环是必要的
         if (matched.index === regex.lastIndex) {
            regex.lastIndex++;
         }        
         const varname = matched[2] || "";
         const prefix = (matched[1] || "").trim();
         const suffix = (matched[6] || "").trim();
         let oldLen:number = newStr.length     // 记一下长度
         // 解析过滤器器和参数 = [<formatterName>,[<formatterName>,[<arg>,<arg>,...]]]
         const filters = parseFilters(matched[3] || "");
         if (isFunction(replacer)) {             
            const finalValue = replacer(varname,prefix, suffix, filters,matched[0]);
            if (opts.replaceAll) {
                newStr = replaceAll(newStr,matched[0], finalValue);
            } else {
                newStr = newStr.replace(matched[0], finalValue);
            }
            // 由于执行替换可能导致字符串发生变化，必须调整匹配位置，否则可能导致错误或无限循环
            regex.lastIndex+=newStr.length-oldLen
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
  * @param {FilterInputChain} filters  经过解析过的过滤器器参数链 ，多个过滤器器函数(经过包装过的)顺序执行，前一个输出作为下一个过滤器器的输入
  *  formatters [ [<过滤器器名称>,[<参数>,<参数>,...],[<过滤器器名称>,[<参数>,<参数>,...]],...]\
  * @param {{value,name,template,match}}   
  * 
  */ 
export function executeFilters(this:FlexVars, filterDefines:FilterInputChain, context:FlexFilterContext) {
    let value = context.value
    if (filterDefines.length > 0){
        // 1. 返回过滤器函数数组处理器
        const filterHandlers = getFilterHandlers.call(this,filterDefines,context)          
        // 2. 分别执行过滤器器函数
        for (let filter of filterHandlers) {
            try{
                value = filter.call(this,value);		 
            }catch(e:any){
                if(e instanceof FlexFilterEmptyError){
                    throw e
                }else if(e instanceof FlexFilterError){
                    if(e.value!=null) value = e.value
                    if(e instanceof FlexFilterAbortError) break  
                }else{
                    throw e
                }
            }        
        }
    }     
    if(!this.options.isEmpty(value)){
        value = `${context.prefix}${value}${context.suffix}`
    }
     return value;
}


/**
 * 
 * 当过滤器返回空值时的处理行为
 * 
 * @remarks 
 */
 function checkEmptyValue(this:FlexVars,value:any,args:Record<string,any>,filter:FlexFilter,context:FlexFilterContext){
    if(!this.options.isEmpty(value)) return value
    const emptyHandler = context.onEmpty || filter.onEmpty || this.options.onEmpty
    if(typeof(emptyHandler)!="function") return value
    const r = emptyHandler.call(this,value,args,context)     
    if(r instanceof Error){
        throw r
    }else if(r == FilterBehaviors.Abort){
        throw new FlexFilterAbortError()
    }else if(r == FilterBehaviors.Ignore){
        throw new FlexFilterIgnoreError()
    }else if(r == FilterBehaviors.Throw){
        throw new FlexFilterEmptyError()
    }else{
        throw new FlexFilterAbortError(r)        
    }    
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
function executeErrorHandler(this:FlexVars,error:Error,value:any,args:Record<string,any>,filter:FlexFilter,context:FlexFilterContext){
    const errorHandler =context.onError || filter.onError || this.options.onError
    if(typeof(errorHandler)!="function") return value
    const r =  errorHandler.call(this,error,value,args,context)             
    if(r instanceof Error){
        throw r
    }else if(r == FilterBehaviors.Abort){
        throw new FlexFilterAbortError()
    }else if(r == FilterBehaviors.Ignore){
        throw new FlexFilterIgnoreError()
    }else if(r == FilterBehaviors.Throw){
        throw error
    }else{
        throw new FlexFilterAbortError(r)        
    }    
}


/**
 * 
 * 包括过滤器函数
 * 
 * @param name      过滤器名称 
 * @param args      传入的参数
 * @param nex    过滤器处理函数
 */
function wrapperFilter(this:FlexVars, filter:FlexFilter, args:any[], context:FlexFilterContext){
    
    // 1. 处理参数
    const finalArgs:Record<string,any> = Object.assign({},typeof(filter.default) === 'function' ? filter.default() : filter.default )

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
        try{
            context.args = args
            // 执行过滤器
            result = filter.next.call(this,value,finalArgs,context)
            // 执行空值处理函数
            result = checkEmptyValue.call(this,result,finalArgs,filter,context) 
        }catch(e:any){
            e.filter = filter.name;    
            if(e instanceof FlexFilterError) {
                throw e        
            }else{ 
                this.log(`当执行过滤器器<${context.match}:${filter.name}>时出错:${e.stack}`)
            }
            return executeErrorHandler.call(this,e,value,finalArgs,filter,context)
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
    let filters =filterDefines.map(([name,args])=>[this.getFilter.call(this,name),args])// 找出有效的过滤器
    .filter(([filter])=>filter!= null) as FilterInfos    
    // 过滤无效的过滤器并排序
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
 function getFilterHandlers(this:FlexVars,filterDefines:FilterInputChain,context:FlexFilterContext) {
    
    const filters:([FlexFilter,any[]])[] = getSortedFilters.call(this,filterDefines)
    const filderHandlers:any[]=[]  
    for (let [filter,args] of filters){
        filderHandlers.push(wrapperFilter.call(this,filter,args,context))    
    }

    return filderHandlers;
 }
  
 