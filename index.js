#!/usr/bin/env node

const { execSync, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

const IMAGES_DIR = 'D:\\workspace\\images';
const CDN_BASE = 'https://cdn.jsdelivr.net/gh/Bicoyoo/images@main';

/**
 * 以管理员权限运行 PowerShell 并返回输出
 */
function runPowershell(script) {
  const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  });

  if (result.status !== 0) {
    const err = result.stderr.trim();
    throw new Error(`PowerShell 执行失败:\n${err || result.error?.message}`);
  }

  return result.stdout.trim();
}

/**
 * 从剪贴板读取图片（Base64 PNG 格式）
 */
function getClipboardImage() {
  const psScript = `
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing

    $img = [System.Windows.Forms.Clipboard]::GetImage()
    if ($img -eq $null) {
      Write-Error "剪贴板中没有图片"
      exit 1
    }

    $ms = New-Object System.IO.MemoryStream
    $img.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $bytes = $ms.ToArray()
    $base64 = [Convert]::ToBase64String($bytes)
    Write-Output $base64
  `;

  return runPowershell(psScript);
}

/**
 * 获取所有可用的仓库子目录
 */
function getRepoDirs() {
  if (!fs.existsSync(IMAGES_DIR)) {
    throw new Error(`图片仓库目录不存在: ${IMAGES_DIR}`);
  }

  const items = fs.readdirSync(IMAGES_DIR, { withFileTypes: true });
  return items
    .filter(item => item.isDirectory() && !['.git', 'node_modules'].includes(item.name))
    .map(item => item.name);
}

/**
 * 交互式选择仓库目录
 */
async function selectRepoDir(dirs) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = (question) =>
    new Promise((resolve) => rl.question(question, resolve));

  console.log('\n📁 可选的图片仓库目录:');
  dirs.forEach((dir, index) => {
    console.log(`  ${index + 1}. ${dir}`);
  });
  console.log('  0. 创建新目录\n');

  const answer = await ask('请选择仓库编号: ');
  rl.close();

  const choice = parseInt(answer, 10);

  if (choice === 0) {
    const name = await ask('请输入新目录名称: ');
    readline.createInterface({ input: process.stdin, output: process.stdout }).close();
    const newDir = path.join(IMAGES_DIR, name);
    if (!fs.existsSync(newDir)) {
      fs.mkdirSync(newDir, { recursive: true });
      console.log(`✅ 已创建目录: ${name}`);
    }
    return name;
  }

  if (choice > 0 && choice <= dirs.length) {
    return dirs[choice - 1];
  }

  throw new Error('无效的选择');
}

/**
 * Git add / commit / push
 */
function gitPush(filename) {
  console.log('\n📤 推送至 GitHub...');

  try {
    execSync('git add .', { cwd: IMAGES_DIR, stdio: 'ignore' });
    execSync(`git commit -m "chore: add image ${filename}"`, { cwd: IMAGES_DIR, stdio: 'ignore' });
    execSync('git push', { cwd: IMAGES_DIR, stdio: 'ignore' });
    console.log('✅ 推送成功');
  } catch (error) {
    const output = (error.stdout?.toString() || '') + (error.stderr?.toString() || '');
    if (output.includes('nothing to commit')) {
      console.log('⚠️  无变更内容，跳过推送');
    } else {
      throw error;
    }
  }
}

/**
 * 复制文本到剪贴板 (Windows PowerShell)
 */
function copyToClipboard(text) {
  runPowershell(`[System.Windows.Forms.Clipboard]::SetText('${text.replace(/'/g, "''")}')`);
}

/**
 * 生成 jsDelivr CDN 链接
 */
function generateCdnUrl(repoDir, filename) {
  return `${CDN_BASE}/${repoDir}/${filename}`;
}

/**
 * 显示帮助信息
 */
function showHelp() {
  console.log(`
📦 imgpush - 剪贴板图片上传至 GitHub 图床

用法:
  imgpush --clipboard [文件名]    从剪贴板读取图片并上传
  imgpush -C [文件名]            同上（简写模式）
  imgpush <文件名>               通过文件名检索已有图片并上传
  imgpush --help                 显示此帮助信息

三个指令说明:
  1. imgpush --clipboard [文件名]
     - 从系统剪贴板读取图片（需提前截图）
     - 保存到指定仓库目录，文件名默认为 "image"
     - 自动执行 git add / commit / push
     - 返回 jsDelivr CDN 访问链接

  2. imgpush -C [文件名]
     - --clipboard 的简写形式，功能完全一致
     - 例如: imgpush -C my-screenshot

  3. imgpush <文件名>
     - 通过文件名在所有仓库目录中检索已有图片
     - 找到后重新推送至 GitHub（可切换仓库目录）
     - 适用于已存在但需重新发布的图片

示例:
  imgpush -C label-management      # 剪贴板图片，保存为 label-management.png
  imgpush --clipboard demo         # 剪贴板图片，保存为 demo.png
  imgpush old-image.png            # 检索 old-image.png 并重新推送

配置:
  图片仓库目录: ${IMAGES_DIR}
  CDN 基础地址: ${CDN_BASE}
`);
}

/**
 * 主流程 - 剪贴板模式
 */
async function handleClipboard(filename) {
  try {
    console.log('📋 正在从剪贴板读取图片...');
    const base64 = getClipboardImage();

    // 确保 .png 后缀
    if (!filename.endsWith('.png')) {
      filename += '.png';
    }

    // 获取并选择仓库目录
    const dirs = getRepoDirs();
    if (dirs.length === 0) {
      throw new Error('未找到可用的仓库目录，请先在 ' + IMAGES_DIR + ' 下创建子目录');
    }

    const repoDir = await selectRepoDir(dirs);

    // 保存图片
    const destDir = path.join(IMAGES_DIR, repoDir);
    fs.mkdirSync(destDir, { recursive: true });
    const savePath = path.join(destDir, filename);
    fs.writeFileSync(savePath, Buffer.from(base64, 'base64'));
    console.log(`✅ 图片已保存: ${savePath}`);

    // Git 推送
    gitPush(filename);

    // 输出 CDN 链接
    const cdnUrl = generateCdnUrl(repoDir, filename);
    copyToClipboard(cdnUrl);
    console.log(`\n🔗 CDN 链接:\n${cdnUrl}\n✅ 已自动复制到剪贴板`);
  } catch (error) {
    console.error(`\n❌ 错误: ${error.message}`);
    process.exit(1);
  }
}

/**
 * 主流程 - 文件模式
 */
async function handleFile(filename) {
  try {
    const dirs = getRepoDirs();
    let foundPath = null;
    let foundRepo = null;

    // 检索文件
    for (const dir of dirs) {
      const filePath = path.join(IMAGES_DIR, dir, filename);
      if (fs.existsSync(filePath)) {
        foundPath = filePath;
        foundRepo = dir;
        break;
      }
    }

    if (!foundPath) {
      throw new Error(`未找到文件: ${filename}\n请在以下目录中查找: ${dirs.join(', ')}`);
    }

    // 选择目标仓库
    const repoDir = await selectRepoDir(dirs);

    // 同一目录直接返回链接
    if (repoDir === foundRepo) {
      console.log('⚠️  文件已在目标仓库中');
      const cdnUrl = generateCdnUrl(repoDir, filename);
      copyToClipboard(cdnUrl);
      console.log(`🔗 CDN 链接:\n${cdnUrl}\n✅ 已自动复制到剪贴板`);
      return;
    }

    // 复制到目标仓库
    const destPath = path.join(IMAGES_DIR, repoDir, filename);
    fs.copyFileSync(foundPath, destPath);
    console.log(`✅ 已复制到: ${destPath}`);

    gitPush(filename);

    const cdnUrl = generateCdnUrl(repoDir, filename);
    copyToClipboard(cdnUrl);
    console.log(`\n🔗 CDN 链接:\n${cdnUrl}\n✅ 已自动复制到剪贴板`);
  } catch (error) {
    console.error(`\n❌ 错误: ${error.message}`);
    process.exit(1);
  }
}

/**
 * 入口
 */
async function main() {
  const args = process.argv.slice(2);

  // 帮助
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }

  // 剪贴板模式
  if (args.includes('--clipboard') || args.includes('-C')) {
    const filename = args.find(a => a !== '--clipboard' && a !== '-C') || 'image';
    await handleClipboard(filename);
    return;
  }

  // 文件模式
  if (args.length > 0 && !args[0].startsWith('-')) {
    await handleFile(args[0]);
    return;
  }

  // 默认显示帮助
  showHelp();
}

main();
