# 小账本（pocket-ledger）

个人自用的移动端记账 PWA，包含两套独立账本：

- **餐补账**：设置月度预算 / 保底 / 自由额度（默认 600 / 450 / 150），按**当月实际天数**折算日均；默认周期为每月 1 号到月末，可设置周期起始日，也可用日历自定义当前 / 未来周期（自定义周期的预算与自由额度按天数比例折算）。正常阶段按日均正常累计，余额跌到 −自由额度时提醒「无自由额度」并切换到日均保底阶段。每月自动恢复，也可手动恢复；负数清零、正数带入下期。
- **规划账**：规划一笔支出，可多笔花、逐月补回，并记录额外汇入。
- **统计**：餐补按「恢复周期」统计，规划账按月统计；附周期净额趋势。
- 视觉：莫兰迪配色 + 圆团子 / 小盆栽卡通形象，支持深色模式与轻动效。
- 数据仅保存在本机浏览器（localStorage），无账号、无云同步；v1 数据会首次打开时自动迁移到 v2。

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
2. 先到仓库 Settings → Pages → Build and deployment → Source 选择 **GitHub Actions**。
3. 推送 `main` 分支：
   ```bash
   git remote add origin https://github.com/<你的GitHub用户名>/pocket-ledger.git
   git push -u origin main
   ```
4. 等待 Actions 完成后，访问 `https://<你的GitHub用户名>.github.io/pocket-ledger/`。

如果第一次部署时还没启用 Pages，工作流会失败；启用后到 Actions 页面重新运行一次即可。

## 安装到手机主屏幕

Chrome 打开上述地址 → 右上角菜单 → **添加到主屏幕**。之后可离线使用。

## 数据说明

所有数据保存在本机浏览器的 localStorage 中，清除浏览器数据或卸载浏览器会丢失记录。
