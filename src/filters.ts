
/**
 * 默认的处理过滤器
 * 
 * "{value | add | error('throw')}"
 * 
 */
export const defaultErrorFilter = {
    name:"error",
    args:["operate","message"],
    default:{operate:"ignore"},
    // value===>上一个过滤器触发的错误对象
    handle(value,args,context){
        return ()=>{
            if(!(value instanceof Error))  return value
            const operate = args.operate.toLowerCase()
            if(operate=='throw'){
                if(args.message){
                    throw new Error(args.message)  
                }else{
                    throw value
                }
            }else if(operate=='abort'){
                
            }else if(operate=='ignore'){
                return context.match
            }else{
                return value
            }
        }
        
    }
}