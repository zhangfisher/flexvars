# 空值处理

当经过插值处理后，如果结果是一个空值时，可以进行一些特殊处理。

空值出现在以下两种情况:

- 在调用`replace`方法未提供变量或变量为空
- 执行过滤器时，过滤器返回空值

## 空值检测

`flwxvars.options.isEmpty`配置项用于检测空值，如果返回`true`则表示空值，否则表示非空值。

- 默认情况下，`flwxvars.options.isEmpty=(value)=>value==null || value ===''`，当值为`null`或`undefined`或`''`时被认为是空值。
- 如果你想要自定义空值检测规则，可以通过`flwxvars.options.isEmpty`配置项来实现。

```ts
flwxvars.options.isEmpty=(value)=>value==null || value=="" || parseInt(value)==0
```


## 输入空值

当调用`replace`方法时没有为插值变量指定值时，可以通过`missing`配置项来指定处理方式。

```ts
// 没有为插值变量指定值，也没有指定missing配置项
flexvars.replace(`hello {name}`) // == hello

// 默认显示为空字符串
flexvars.options.missing ='default'
expect(flexvars.replace("I am {}")).toBe("I am ")
expect(flexvars.replace("{}{}{}","a","b")).toBe("ab")
expect(flexvars.replace("{}{}{}",["a"])).toBe("a")

// ignore，保留原样输出
flexvars.options.missing='ignore'
expect(flexvars.replace("I am {}")).toBe("I am {}")
expect(flexvars.replace("{}{}{}","a","b")).toBe("ab{}")
expect(flexvars.replace("{}{}{}",["a"])).toBe("a{}{}")

//  使用某个值替换
flexvars.options.missing=()=>'*'
expect(flexvars.replace("I am {}")).toBe("I am *")
expect(flexvars.replace("{}{}{}","a","b")).toBe("ab*")
expect(flexvars.replace("{}{}{}",["a"])).toBe("a**")
```

- `missing`取值为`'default' | 'ignore' |  ((nameOrIndex:string|number)=>any) `
- `missing`默认值为`default`，当插值变量的值为空时，会将其替换为空字符串。
- `missing`取值为`ignore`时，当插值变量的值为空时，会保留原样输出。
- `missing`取值为函数时，当插值变量的值为空时，会将其替换为函数返回值，你可以为不同名称或位置的变量指定默认值。
- 输入空值处理在执行过滤器之前进行处理。

## 过滤器空值处理

当执行过滤器时，如果过滤器返回空值，可以通过`onEmpty`配置项来指定处理方式。

**可以通过三个方式指定`onEmpty`函数：**

- `flexvars.options.onEmpty`：全局空值处理函数
- `flexvars.filters.<过滤器>.onEmpty`: 指定过滤器的空值处理函数，优先级高于全局空值处理函数
- `空值处理过滤器`: 直接在插值变量中使用`empty`过滤器即可，例如：`{name  | empty | empty}`, **优先级最高**，并且在过滤器链中可以放在任意位置，如`{ |add|empty|add|add|add}`,`{ |add|add|add|add|empty }`,`{ |empty|add|add|add|add }`,`{ |add|add|add|empty|add }`等效的。


**`onEmpty`函数签名如下：**

```ts
(this:FlexVars,value:any,args:Record<string,any>,context:FlexFilterContext)=>FilterBehaviorType  | Error | string  
```

可以看到，**空值处理逻辑**和**错误处理逻辑**基本一致，大体如下：

- 提供`Ignore`、`Throw`、`Abort`三种处理方式
- 允许在遇到空值时抛出错误
- 可以返回一个字符串，表示使用该字符串替换空值



## 默认空值行为

执行过滤器返回空值时，默认行为是`FilterBehaviors.Ignore`，即忽略错误并继续执行后续过滤器。


## 空值处理示例

更多的示例详见[单元测试用例](https://github.com/zhangfisher/flexvars/blob/master/src/__tests__/index.test.ts)


