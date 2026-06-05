# imgpush

剪贴板图片上传至 GitHub 图床的 CLI 工具，自动推送并返回 jsDelivr CDN 链接。

## 安装

```bash
cd D:\workspace\images
npm install
npm link
```

安装后即可在任意终端使用 `imgpush` 命令。

## 用法

### 1. 剪贴板模式 — `imgpush -C [文件名]`

截图后执行，从剪贴板读取图片上传：

```bash
imgpush -C label-management      # 保存为 label-management.png
imgpush --clipboard demo         # 同上，完整写法
```

流程：
1. 截图（图片存入剪贴板）
2. 执行命令
3. 选择目标仓库目录（或创建新目录）
4. 自动 git add / commit / push
5. CDN 链接自动复制到剪贴板

### 2. 文件模式 — `imgpush <文件名>`

通过文件名检索已有图片并重新推送：

```bash
imgpush demo           # 自动匹配 demo.png / demo.jpg 等
imgpush old-image.png  # 精确查找
```

- **不含后缀**：自动按 `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`, `.bmp`, `.ico` 顺序匹配
- **含后缀**：精确查找

### 3. 帮助 — `imgpush --help`

显示使用说明和配置信息。

## CDN 链接格式

```
https://cdn.jsdelivr.net/gh/Bicoyoo/images@main/{仓库目录}/{文件名}
```

链接会自动复制到剪贴板，粘贴即用。

## 仓库目录

图片存放在 `D:\workspace\images` 下的子目录中，每个子目录代表一个仓库分类：

```
images/
├── SchoolAdminWeb/    # 项目 A 的图片
├── Test/              # 测试图片
└── ...
```

运行命令时会列出所有可用目录供选择，也可选择 `0` 创建新目录。

## 技术栈

- Node.js（无外部框架依赖，仅依赖 `commander`）
- Windows PowerShell（剪贴板读写 + Git 操作）

## 环境要求

- Windows（PowerShell 5+）
- Node.js 16+
- Git
