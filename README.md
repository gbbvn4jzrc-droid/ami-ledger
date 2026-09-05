# ami记账 PWA v1.0

这是给 iPhone 自用的 PWA 版 ami记账。

## 不需要
- Mac
- Xcode
- Apple Developer 年费
- 7 天重新签名

## 当前功能
- 收入 / 支出记账
- 分类、支付方式、日期、备注
- 月预算
- 账单搜索与筛选
- 每日趋势
- 分类占比
- CSV 导出
- 完整 JSON 备份 / 恢复
- 深色模式
- 离线缓存
- iPhone 主屏幕安装
- 无广告、无订阅、无第三方分析

## 数据存储
账单保存在 iPhone Safari / PWA 的 IndexedDB 本地数据库。
应用代码不会主动把账单上传到开发者服务器。

重要：
浏览器本地存储不是永久备份。
请定期使用「设置 → 导出完整 JSON 备份」。

## 为什么直接双击 index.html 不行？
PWA 的 Service Worker 和“添加到主屏幕”需要通过 HTTPS 网站访问。
所以需要把整个文件夹部署到一个静态网站托管平台。

## iPhone 安装
部署完成后：

1. iPhone 用 Safari 打开网站
2. 点击 Safari 的「分享」
3. 选择「添加到主屏幕」
4. 名称保持「ami记账」
5. 点击「添加」

以后就从桌面图标进入。

## 文件
- index.html：App
- styles.css：界面
- app.js：记账与本地数据库
- service-worker.js：离线支持
- manifest.webmanifest：PWA 安装信息
- icon-*.png：App 图标
- privacy.html：隐私说明
