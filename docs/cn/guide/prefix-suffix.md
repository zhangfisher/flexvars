# 前缀和后缀

支持为插值处理结果添加前缀和后缀进行修饰。

## 前缀

- 约定紧随插值变量开始符`{`的**非空字符串**为前缀
- 前缀必须尾随一个空格
- 当指定命名变量时，前缀与变量名称之间必须有空格。
- 前缀是可选的
- 前缀字符串会被附加到变量结果的最前面，当插值变量处理结果为空时，前缀不显示.

```ts

// 显示前缀
flexvars.replace("I am {Mr. name}","fisher"); // I am Mr.fisher
// 由于没有指定name变量，所以前缀不显示
flexvars.replace("I am {Mr. name}"); // I am 
                          
// 只指定变量名称，没有前缀
flexvars.replace("I am {name}","fisher"); // I am fisher

```
 

## 后缀

- 约定紧随插值变量结束符`}`的**非空字符串**为后缀 
- 后缀必须前置一个空格
- 后缀是可选的
- 后缀字符串会被附加到变量结果的最后面，当插值变量处理结果为空时，后缀不显示.

```ts

// 显示后缀
flexvars.replace("我每月收入{ 元}",1); // 我每月收入1元
// 指定是变量名称
flexvars.replace("我每月收入{value 元}",1); // 我每月收入1元

// 由于没有指定value变量，所以后缀不显示
flexvars.replace("我每月收入{ 元}"); // 我每月收入

// 指定是变量名称
flexvars.addFilter({
    name:"double", 
    next:(value) => parseInt(value) * 2
});
flexvars.replace("我每月收入{value|double 元}",2); // 我每月收入4元

```

## 示例

```ts
    expect(flexvars.replace("X{, |null|empty}",0)).toBe("X")
    expect(flexvars.replace("X{|null|empty() ,}",0)).toBe("X")
    expect(flexvars.replace("X{, |add|null|add|empty}",0)).toBe("X")
    expect(flexvars.replace("X{$: |add|empty|add|null|add}",0)).toBe("X")
    
    // 默认是中止执行返回指定值     
    expect(flexvars.replace("X{: |null|empty('空')}",0)).toBe("X:空")
    expect(flexvars.replace("X{: |null|empty('空')}",0)).toBe("X:空")
    expect(flexvars.replace("X{=( |add|null|add|empty('空') )}",0)).toBe("X=(空)")
    expect(flexvars.replace("X{=( |add|empty('空')|add|null|add )}",0)).toBe("X=(空)")
```