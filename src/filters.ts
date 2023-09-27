
import { FlexFilterAbortError, FlexFilterEmptyError, FlexFilterError, FlexFilterIgnoreError } from "./errors";
import { FlexFilter,FlexFilterContext } from './types';
/**
 * 默认的处理过滤器
 * 
 * - 当过滤器执行出错时会调用该过滤器
 * - 该过滤器可以使用在过滤器链的任意位置
 * - 该过滤器的输入值是上一个过滤器的出错对象
 * - 在过滤器链的上只能有一个
 * 
 *  * error                    // 返回空字符串 不再执行后续的过滤器，默认行为
 * // 提供默认值，继续执行后续的过滤器
 * error('ignore')          
 * error('ignore','')          
 * error('ignore','无')          
 * // 
 * error("abort")           // 中止后续过滤器执行，并返回空字符串
 * error("abort","xxx")     // 中止后续过滤器执行，并返回xxx
 * 
 * error("throw")           // 抛出异常
 * error("throw","eeee")    // 抛出异常,error.message=eeee
 * 
 * 
 */
export const defaultErrorFilter = {
    name:"error",
    priority:"before",              // 前置过滤器
    args:["operate","value"],
    default:{operate:"ignore"},
    next(value,args,context){
        const operate = args.operate.toLowerCase()
        const inputValue = args.value
        context.onError = (error:Error,value:any,args:Record<string,any>,context:FlexFilterContext)=>{
            if(!(error instanceof Error))  throw error
            if(error instanceof FlexFilterError) throw error
            if(operate=='throw'){
                if(inputValue){
                    throw new Error(inputValue)
                }else{
                    throw error
                }                
            }else if(operate=='abort'){
                throw new FlexFilterAbortError(inputValue)
            }else if(operate=='ignore'){
                throw new FlexFilterIgnoreError(inputValue)
            }else{
                return value
            }
        }       
        return value 
    }
} as FlexFilter



/**
 * 默认的空值处理过滤器
 * 
 * @remarks
 * 
 * empty   == empty('abort')  ==empty('abort','')                  // 返回空字符串 不再执行后续的过滤器，默认行为
 * // 提供默认值，继续执行后续的过滤器
 * empty('ignore')          
 * empty('ignore','')          
 * empty('ignore','无')          
 * // 
 * empty("abort")           // 中止后续过滤器执行，并返回空字符串
 * empty("abort","xxx")     // 中止后续过滤器执行，并返回xxx
 * 
 * empty("throw")           // 抛出异常
 * empty("throw","eeee")    // 抛出异常,error.message=eeee
 * 
 * 
 */
export const defaultEmptyFilter = {
    name:"empty",
    priority:"before",              // 前置过滤器
    args:["operate","value"],
    default:{operate:"abort",value:''},
    next(value,args,context){
        const operate = args.operate.toLowerCase()
        const inputValue = args.value
        context.onEmpty = (value:any,args:Record<string,any>,context:FlexFilterContext)=>{
            if(operate=='throw'){
                throw new FlexFilterEmptyError()
            }else if(operate=='abort'){
                throw  new FlexFilterAbortError(inputValue)
            }else if(operate=='ignore'){
                throw  new FlexFilterIgnoreError()
            }else{
                return operate
            }
        }
        return value 
    }
} as FlexFilter
