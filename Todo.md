## bug

### 未修复

### 已修复

- 使用 staticCall 返回的 tokenId 是滞后的导致出现 revert not approved
  可以考虑记录地址 balance，然后根据 balance 查询链上 tokenId 获得新 mint 的 tokenId

## 需要添加的功能

### 未添加

### 以添加

- 定期收集费用
- 费用累计足够高就添加流动性到原来的头寸

## 需要考虑的

- 费用收集与流动性添加时需要如何对冲
