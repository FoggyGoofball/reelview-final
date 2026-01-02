const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function log(msg) {
  const line = `[prepare-spa] ${new Date().toISOString()} - ${msg}`;
  console.log(line);
}

async function run() {
  try {
    const electronDir = path.resolve(__dirname, '..'); // fresh-migrated/electron
    const repoRoot = path.resolve(electronDir, '..', '..'); // reelview root
    const spaDir = path.join(repoRoot, 'spa'); // spa/ at repo root (React Router + Vite)
    const spaDist = path.join(spaDir, 'dist');
    const targetAppDir = path.join(electronDir, 'app');

    log(`electronDir=${electronDir}`);
    log(`repoRoot=${repoRoot}`);
    log(`spaDir=${spaDir}`);
    log(`spaDist=${spaDist}`);
    log(`targetAppDir=${targetAppDir}`);

    // Check if spa dist already exists
    if (!fs.existsSync(spaDist)) {
      // Need to build SPA first
      log('SPA dist not found, running build...');
      execSync('npm run build', { cwd: spaDir, stdio: 'inherit', shell: true });
    } else {
      log('SPA dist found, skipping build (use npm run build in spa/ to rebuild)');
    }

    // Remove existing target and copy dist
    if (fs.existsSync(targetAppDir)) {
      log('Removing existing app directory...');
      fs.rmSync(targetAppDir, { recursive: true, force: true });
    }

    log('Copying spa/dist to electron app directory...');
    // fs.cpSync available on Node 16+, fallback to manual copy
    if (fs.cpSync) {
      fs.cpSync(spaDist, targetAppDir, { recursive: true });
    } else {
      // naive recursive copy
      const copyRecursive = (src, dest) => {
        const entries = fs.readdirSync(src, { withFileTypes: true });
        fs.mkdirSync(dest, { recursive: true });
        for (const ent of entries) {
          const srcPath = path.join(src, ent.name);
          const destPath = path.join(dest, ent.name);
          if (ent.isDirectory()) copyRecursive(srcPath, destPath);
          else fs.copyFileSync(srcPath, destPath);
        }
      };
      copyRecursive(spaDist, targetAppDir);
    }

    log('SPA prepared and copied successfully.');
  } catch (err) {
    console.error('[prepare-spa] Error:', err);
    process.exit(1);
  }
}

run();
