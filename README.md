# 小账本（pocket-ledger）

个人自用的移动端记账 PWA，包含两套独立账本：

- **餐补账**：每天 20 元餐补（可改），记录实际餐费，结余逐日累计。
- **规划账**：规划一笔支出，可多笔花、逐月补回，并记录额外汇入。
- **统计**：两套账的按月汇总与趋势图。
- 数据仅保存在本机浏览器（localStorage），无账号、无云同步。

## 开发

```bash
npm install
npm run dev          # 本地开发
npm run test         # 监听模式测试
npm run test:run     # 单次运行测试
npm run build        # 类型检查 + 生产构建
npm run preview      # 预览构建产物
```

## 手机试用（同一 Wi-Fi）

```bash
npm run dev -- --host
```

手机浏览器打开终端输出的局域网地址即可。

## 部署到 GitHub Pages

1. 在 GitHub 创建仓库 `pocket-ledger`（公开或私有均可，Pages 需要公开或 Pro）。
2. 推送 `main` 分支：
   ```bash
   git remote add origin https://github.com/<你的GitHub用户名>/pocket-ledger.git
   git push -u origin main
   ```
3. 仓库 Settings → Pages → Build and deployment → Source 选择 **GitHub Actions**。
4. 等待 Actions 完成后，访问 `https://<你的GitHub用户名>.github.io/pocket-ledger/`。

## 安装到手机主屏幕

Chrome 打开上述地址 → 右上角菜单 → **添加到主屏幕**。之后可离线使用。

## 数据说明

所有数据保存在本机浏览器的 localStorage 中，清除浏览器数据或卸载浏览器会丢失记录。
