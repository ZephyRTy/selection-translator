const fs = require('fs');
const path = require('path');
const { ZipArchive } = require('archiver');

const distDir = path.resolve(__dirname, '..', 'dist');
const outFile = path.resolve(__dirname, '..', 'selection-translator.zip');

if (!fs.existsSync(distDir)) {
  console.error('dist/ 目录不存在，请先运行 npm run build');
  process.exit(1);
}

const output = fs.createWriteStream(outFile);
const archive = new ZipArchive({ zlib: { level: 9 } });

output.on('close', () => {
  const kb = (archive.pointer() / 1024).toFixed(1);
  console.log('打包完成: ' + outFile + ' (' + kb + ' KB)');
});

archive.on('error', (err) => {
  console.error('打包失败:', err.message);
  process.exit(1);
});

archive.pipe(output);
archive.directory(distDir, false);
archive.finalize();
