# 过滤器

过滤器采用类似管道链式调用的方式，将插值变量的值传入过滤器链中进行依次处理，前一个过滤器的输出作为下一个过滤器的输入，最终输出处理后的值替换原始变量值。

## 完整语法

> { `varname` | `filter1` | `filter2` | ... | `filterN` }\
> { `varname` | `filter1` | `filter2(arg1,arg2,...)` | ... | `filterN` }\
> { `varname` | `filter1` | `filter2({key1:value2,...,key:value2})` | ... | `filterN` }

- 过滤器名称区分大小写
- 多个过滤器通过管道符`|`连接起来, 从左到右依次执行,前一个过滤器的输出作为后一个过滤器的输入。例如: `{name | upper | lower}`，相当于执行`lower(upper(name))`。


## 创建过滤器

使用过滤器之前，需要先创建过滤器并注册到`FlexVars`实例中。

创建过滤器有两种方式：

- **使用`FlexVars.addFilter`方法创建过滤器。**

```ts

// 创建过滤器

const addFilter =flexvars.addFilter({
    name:"add",
    args:["step"],
    default:{step:1},
    next(value:any,args:Record<string,any>,context:FlexFilterContext){
        return parseInt(value)+args.step
    }
})
```

以上创建了一个名称为`add`过滤器并注册到`FlexVars`实例中,解释如下：

- `name`：过滤器名称，必填项，区分大小写。
- `args=["step"]`：代表了过滤器支持一个叫`step`的参数。
- `default:{step:1}`：代表了过滤器的默认参数值为`1`。
- `next`：包含过滤器的基本逻辑，必填项，该函数接收三个参数：
  - `value`：插值变量的值。
  - `args`：调用过滤器时传入的参数，在本例中`{step:1}`。
  - `context`：过滤器上下文，包含了`FlexVars`实例和当前插值变量的上下文。

创建完成后，可以通过`flexvars.getFilter("add")`获取到该过滤器，然后就可以在`flexvars.replace`方法调用该过滤器了。

- **在构建FlexVars时传入**

```ts

const flexvars = new FlexVars({
    filters:{
        add:{
            args:["step"],
            default:{step:1},
            next(value:any,args:Record<string,any>,context:FlexFilterContext){
                return parseInt(value)+args.step
            }
        }
    }    
})
``` 

**注**：更新详细的开发文档请参考[开发指南](./dev-filter.md)。

## 调用过滤器

过滤器通过插值变量名称后使用管道符`|`调用，例如：`{name | upper}`，相当于执行`upper(<name值>)`。当采用匿名插值变量时，`{ | upper}`，相当于执行`upper(<变量值>)`。

每个过滤器本质上是一个函数，支持`3`种传参方式：

- **无参调用**：

不指定参数时可以省略括号，例如：`{name | upper}`，相当于执行`upper(name)`。

- **位置传参**：

参数通过逗号分隔, 例如：`{name | substring(0,3)}`，相当于执行`substring(name,0,3)`。

- **字典传参**：

参数通过键值对的方式传入， 例如：`{name | substring({start:0,end:3})}`，相当于执行`substring(name,0,3)`。

**说明：**

- 过滤器参数只支持基本数据类型，不支持函数、类、Symbol等复杂类型。
- 每一个过滤器均同时支持无参、位置传参、字典传参三种方式。
- 不同过滤器的参数是不同的，需要查看具体的过滤器说明。

## 动态过滤器

除了在构建`FlexVars`实例时传入`filters`和使用`FlexVars.addFilter`方法创建过滤器外，还可以指定一个`getFilter`方法，来动态获取过滤器。

```ts
const flexvars = new FlexVars({
    getFilter:(name:stirng)=>{
        return {
            name,
            args:["step"],
            default:{step:1},
            next(value:any,args:Record<string,any>,context:FlexFilterContext){
                return parseInt(value)+args.step
            }
        }
    }
})
```

或者仅仅返回一个`next`函数。

```ts
const flexvars = new FlexVars({
    getFilter:(name:stirng)=>{
        return (value:any,args:Record<string,any>,context:FlexFilterContext)=>{
                return parseInt(value)+args.step
        }
    }
})
```
## 原型方法过滤器

原型过滤器是一种特殊的过滤器，它不需要注册到`FlexVars`实例中，而是直接调用`String`原型链方法。

```ts

flexvars.replace("hello { | toUpperCase }","voerkai18n") // == "hello VOERKAI18N"

```

