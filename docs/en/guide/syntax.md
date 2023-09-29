# 变量语法

## 完整语法

字符串插值变量使用`{...}`包裹，完整语法如下：

![](../images/syntax.png)


## 命名变量

为变量名称指定一个名称，可以使用字典传入变量值。

```ts
// 命名插值变量， 可以使用字典传入变量值
"I am {name}, I am {age} years old."  
// 使用了过滤器
"I am {name | upper }, I am {age} years old."  

```

## 匿名变量

匿名插值变量不需要指定名称，需要采用位置插值方式传入变量值。

```ts

"I am {}, I am {} years old." 
// 匿名插值变量，需要采用位置插值方式传入变量值
"Error while parsing {} at {}"
// 匿名插值变量， 使用了过滤器
"Error while parsing {} at {|date}"

```

## 位置插值

位置插值是指通过调用参数的顺序来指定插值变量的值。

```ts
import { FlexVars } from 'flexvars';
const flexvars = new FlexVars();

// 参数与插值变量按顺序一一对应
flexvars.replace("Hello, {}{}{}", 1,2,3); // Hello, 123
// 当第一个参数是数组且只有一个参数时，数组的每一项与插值变量按顺序一一对应
flexvars.replace("Hello, {}{}{}",[1,2,3]); // Hello, 123

```
## 字典插值

当入参只有一个参数且是`{...}`时，可以通过字典的键值来赋值，也可以采用位置插值传参方式。

```ts
import { FlexVars } from 'flexvars';
const flexvars = new FlexVars();
// I am fisher, I am 24 years old.
flexvars.replace("I am {name}, I am {age} years old.",{name:'fisher',age:24}); 
// 命名插值变量，也 可以使用字典传入变量值
flexvars.replace("I am {name}, I am {age} years old.",'fisher',24); 

``` 
