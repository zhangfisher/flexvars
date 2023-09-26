
// 用来传递给过滤器函数的参数
export class FlexFilterError extends Error{     
    constructor(public value?:any) {
        super()
    }
} 
export class FlexFilterThrowError extends FlexFilterError{ } 
export class FlexFilterAbortError extends FlexFilterError{}
export class FlexFilterIgnoreError extends FlexFilterError{}
export class FlexFilterEmptyError extends FlexFilterError{ }