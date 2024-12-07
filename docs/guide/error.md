# 错误处理

过滤器本质上就是一个简单的函数`(value)=>{}`,当执行过滤器出错时，可以配置错误处理函数来处理错误。

## 错误处理函数

当过滤器执行出错时，可以通过指定`onError`函数来处理错误。

**可以通过三个方式指定`onError`函数：**

- `flexvars.options.onError`：全局错误处理函数
- `flexvars.filters.<过滤器>.onError`: 指定过滤器的错误处理函数，优先级高于全局错误处理函数
- `错误处理过滤器`: 直接在插值变量中使用`error`过滤器即可，例如：`{name  | error | upper}`, **优先级最高**，并且在过滤器链中可以放在任意位置，如`{ |add|error|add|add|add}`,`{ |add|add|add|add|error }`,`{ |error|add|add|add|add }`,`{ |add|add|add|error|add }`等效的。

**`onError`函数签名如下：**

```ts
export type FilterErrorHandler = (this:FlexVars,error:Error,value:any,args:Record<string,any>,context:FlexVariableContext)=>FilterBehaviorType | string;     
```

## 忽略错误

忽略错误并继续执行后续过滤器, 可以有两种处理方式：

- **直接忽略**

直接忽略错误，继续执行后续过滤器。

```ts
// `add`是一个对输入转换为数字加`1`的过滤器。`throw`过滤器会抛出错误。
flexvars.options.onError = (error,value,args,context)=>FilterBehaviors.Ignore
expect(flexvars.replace("{|add|add|throw|add|add}",0)).toBe("4")
xpect(flexvars.replace("{|throw}",0)).toBe("0")     
```

以上例子中，`throw`过滤器抛出错误被忽略，后续继续执行`add`过滤器，因此返回值为`4`。

- **忽略并返回值**

忽略错误时返回一个值来代替执行链中的值输入到下一个过滤器中，然后继续执行后续过滤器。

```ts
// `add`是一个对输入转换为数字加`1`的过滤器。`throw`过滤器会抛出错误。
flexvars.options.onError = ()=>{
    throw new FlexFilterIgnoreError("999")
}
expect(flexvars.replace("{|add|add|throw|add}",0)).toBe("1000")
```

以上例子中，执行`|add|add`后，值为2，然后`throw`错误后，值为`999`，最后执行`|add`过滤器，值为`1000`。


## 中止错误

终止后续过滤器的执行并返回当前值,同样有两种处理方式：


- **直接中止**

直接中止后续过滤器的执行并返回当前值。

```ts
// `add`是一个对输入转换为数字加`1`的过滤器。`throw`过滤器会抛出错误。
expect(flexvars.replace("{|add|add|throw|add|add}",0)).toBe("2")
```

以上例子中，`throw`过滤器抛出错误，终止后续过滤器的执行，最后成功执行的过滤器是第二个`add`过滤器，因此返回值为`2`。

- **中止并返回值**

```ts
// `add`是一个对输入转换为数字加`1`的过滤器。`throw`过滤器会抛出错误。
flexvars.options.onError = ()=>{
    throw new FlexFilterAbortError("999")
}
expect(flexvars.replace("{|add|add|throw|add}",0)).toBe("999")
```

## 抛出错误

当过滤器执行出错时，可以抛出错误，抛出的错误会被`flexvars.replace`函数捕获并抛出。

```ts
flexvars.addFilter({
    name:"throw",
    next(value,args,context){
        throw new MyError("出错了")
    }
})
flexvars.onError = ()=>FilterBehaviors.Throw
expect(()=>flexvars.replace("{|add|add|throw|add|add}",0)).toThrow(MyError)
```

## 默认错误行为

执行过滤器出错时，默认行为是`FilterBehaviors.Ignore`，即忽略错误并继续执行后续过滤器。


## 处理示例

更多的示例详见[单元测试用例](https://github.com/zhangfisher/flexvars/blob/master/src/__tests__/index.test.ts)
 