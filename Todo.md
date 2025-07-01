## bug

### 未修复

### 已修复

- 在 burn 之后没有清除 tokenId 并且等待 burn 的交易过块，首先由于没有等待过块导致出现 replacement transaction underpriced 错误，并且由于创建失败并未重置 tokenId 导致进入死循环
- 使用 staticCall 返回的 tokenId 是滞后的导致出现 revert not approved
  可以考虑记录地址 balance，然后根据 balance 查询链上 tokenId 获得新 mint 的 tokenId

## 需要添加的功能

### 未添加

### 以添加

- 定期收集费用
- 费用累计足够高就添加流动性到原来的头寸

## 需要考虑的

- 费用收集与流动性添加时需要如何对冲
