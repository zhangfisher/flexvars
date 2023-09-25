
import { FilterErrorBehavior } from "./flexvars"
import type { FlexFilterContext } from "./parser"
import type { FlexFilter } from './filter';

/**
 * 默认的处理过滤器
 * 
 * - 当过滤器执行出错时会调用该过滤器
 * - 该过滤器可以使用在过滤器链的任意位置
 * - 该过滤器的输入值是上一个过滤器的出错对象
 * - 在过滤器链的上只能有一个
 * 
 * "{value | add | error('throw')}"
 * 
 */
export const defaultErrorFilter = {
    name:"error",
    priority:"before",              // 前置过滤器
    args:["operate","message"],
    default:{operate:"ignore"},
    next(value,args,context){
        const operate = args.operate.toLowerCase()
        context.onError = (error:Error,value:any,args:Record<string,any>,context:FlexFilterContext)=>{
            if(!(error instanceof Error))  return error            
            if(operate=='throw'){
                if(args.message){
                    return new Error(args.message)
                }else{
                    return error
                }                
            }else if(operate=='abort'){
                return FilterErrorBehavior.Abort
            }else if(operate=='ignore'){
                return FilterErrorBehavior.Ignore
            }else{
                return value
            }
        }       
        return value 
    }
} as FlexFilter
